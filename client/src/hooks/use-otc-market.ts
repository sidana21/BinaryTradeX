import { useState, useEffect, useRef, useCallback } from 'react';
import { z } from 'zod';

// ✅ Strict Zod schemas for validation - NO null values allowed
const CandleDataSchema = z.object({
  time: z.number().int().positive().finite(),
  open: z.number().finite(),
  high: z.number().finite(),
  low: z.number().finite(),
  close: z.number().finite(),
}).refine(data => {
  return !isNaN(data.time) && 
         !isNaN(data.open) &&
         !isNaN(data.high) &&
         !isNaN(data.low) &&
         !isNaN(data.close);
}, {
  message: "All candle values must be valid numbers"
}).refine(data => {
  return data.high >= data.low;
}, {
  message: "High must be >= Low"
});

const PriceTickSchema = z.object({
  pair: z.string().min(1),
  time: z.number().int().positive().finite(),
  price: z.number().finite().positive(),
});

export type CandleData = z.infer<typeof CandleDataSchema>;
export type PriceTick = z.infer<typeof PriceTickSchema>;

interface UseOtcMarketOptions {
  pair: string;
  candleInterval?: number; // in seconds
  onPriceUpdate?: (price: number) => void;
}

interface UseOtcMarketReturn {
  candles: CandleData[];
  currentPrice: number | null;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
}

export function useOtcMarket({
  pair,
  candleInterval = 60,
  onPriceUpdate,
}: UseOtcMarketOptions): UseOtcMarketReturn {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const currentCandleRef = useRef<CandleData | null>(null);
  const candleStartTimeRef = useRef<number>(0);
  const isInitializedRef = useRef(false);

  // Validate and add candle
  const validateAndAddCandle = useCallback((candle: any): CandleData | null => {
    try {
      return CandleDataSchema.parse(candle);
    } catch (e) {
      console.error('Invalid candle data:', candle, e);
      return null;
    }
  }, []);

  // Load historical candles
  const loadHistoricalCandles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/price-data/${pair}_OTC/with-current`);
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      
      // Validate all candles
      const validatedCandles: CandleData[] = [];
      
      if (data.candles && Array.isArray(data.candles)) {
        data.candles.forEach((candle: any) => {
          const validated = validateAndAddCandle(candle);
          if (validated) {
            validatedCandles.push(validated);
          }
        });
      }
      
      setCandles(validatedCandles);
      
      // Set current candle if available
      if (data.currentCandle) {
        const validated = validateAndAddCandle(data.currentCandle);
        if (validated) {
          currentCandleRef.current = validated;
          candleStartTimeRef.current = data.currentCandle.startTime || validated.time;
          setCurrentPrice(validated.close);
        }
      } else if (validatedCandles.length > 0) {
        const lastCandle = validatedCandles[validatedCandles.length - 1];
        setCurrentPrice(lastCandle.close);
        candleStartTimeRef.current = lastCandle.time;
      }
      
      isInitializedRef.current = true;
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading candles:', err);
      setError(err instanceof Error ? err.message : 'Failed to load candles');
      setIsLoading(false);
    }
  }, [pair, validateAndAddCandle]);

  // Handle price tick
  const handlePriceTick = useCallback((tick: any) => {
    try {
      // Validate tick
      const validatedTick = PriceTickSchema.parse(tick);
      
      if (validatedTick.pair !== pair || !isInitializedRef.current) {
        return;
      }
      
      const { time: currentTime, price } = validatedTick;
      setCurrentPrice(price);
      onPriceUpdate?.(price);
      
      const elapsedTime = currentTime - candleStartTimeRef.current;
      
      // Check if we need to start a new candle
      if (!currentCandleRef.current || elapsedTime >= candleInterval) {
        // Finalize previous candle if exists
        if (currentCandleRef.current) {
          const finalizedCandle = { ...currentCandleRef.current };
          setCandles(prev => {
            const updated = [...prev, finalizedCandle];
            // Keep only last 300 candles
            return updated.slice(-300);
          });
        }
        
        // Start new candle
        const openPrice = currentCandleRef.current?.close || price;
        candleStartTimeRef.current = currentTime;
        
        currentCandleRef.current = {
          time: currentTime,
          open: openPrice,
          high: Math.max(openPrice, price),
          low: Math.min(openPrice, price),
          close: price,
        };
        
        // Validate new candle
        const validated = validateAndAddCandle(currentCandleRef.current);
        if (!validated) {
          console.error('Failed to create valid new candle');
          currentCandleRef.current = null;
        }
      } else {
        // Update current candle
        if (currentCandleRef.current) {
          currentCandleRef.current.close = price;
          currentCandleRef.current.high = Math.max(currentCandleRef.current.high, price);
          currentCandleRef.current.low = Math.min(currentCandleRef.current.low, price);
          
          // Re-validate
          const validated = validateAndAddCandle(currentCandleRef.current);
          if (!validated) {
            console.error('Current candle became invalid after update');
          }
        }
      }
    } catch (err) {
      console.error('Error handling price tick:', err);
    }
  }, [pair, candleInterval, onPriceUpdate, validateAndAddCandle]);

  // Setup WebSocket
  useEffect(() => {
    // Reset state when pair changes
    isInitializedRef.current = false;
    currentCandleRef.current = null;
    setCandles([]);
    setCurrentPrice(null);
    
    // Load historical data
    loadHistoricalCandles();
    
    // Setup WebSocket
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const socketUrl = `${protocol}://${location.host}/ws`;
    
    console.log(`🔌 Connecting to WebSocket for ${pair}:`, socketUrl);
    
    const ws = new WebSocket(socketUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log(`✅ WebSocket connected for ${pair}`);
      setIsConnected(true);
      setError(null);
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'otc_price_tick') {
          handlePriceTick(message.data);
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    };
    
    ws.onerror = (err) => {
      console.error(`⚠️ WebSocket error for ${pair}:`, err);
      setError('WebSocket connection error');
      setIsConnected(false);
    };
    
    ws.onclose = () => {
      console.log(`❌ WebSocket disconnected for ${pair}`);
      setIsConnected(false);
    };
    
    return () => {
      ws.close();
    };
  }, [pair, loadHistoricalCandles, handlePriceTick]);

  // Get all candles including current one
  const allCandles = currentCandleRef.current 
    ? [...candles, currentCandleRef.current]
    : candles;

  return {
    candles: allCandles,
    currentPrice,
    isLoading,
    isConnected,
    error,
  };
}
