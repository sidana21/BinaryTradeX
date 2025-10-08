import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Asset, Trade } from '@shared/schema';

interface TradingChartProps {
  asset: Asset | null;
  timeframe: string;
  onTimeframeChange: (timeframe: string) => void;
  openTrades?: Trade[];
  tradeHistory?: Trade[];
}

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradeMarker {
  price: number;
  timestamp: number;
  type: 'entry' | 'exit';
  tradeType: 'CALL' | 'PUT';
  status?: 'won' | 'lost' | 'open';
  tradeId: string;
}

export function TradingChart({ asset, timeframe, onTimeframeChange, openTrades = [], tradeHistory = [] }: TradingChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [markers, setMarkers] = useState<TradeMarker[]>([]);
  const lastUpdateTimeRef = useRef<number>(0);
  const priceUpdateRef = useRef<number>(0);

  // Fetch candle data from API
  const { data: candleData, isLoading } = useQuery<Candle[]>({
    queryKey: [`/api/binomo/candles/${asset?.id}/${timeframe}`],
    enabled: !!asset,
  });

  // Update candles when new data is fetched
  useEffect(() => {
    if (candleData) {
      setCandles(candleData);
    }
  }, [candleData]);

  // Process trades into markers
  useEffect(() => {
    if (!asset) return;
    
    const newMarkers: TradeMarker[] = [];
    
    // Process all trades for current asset
    const allTrades = [...openTrades, ...tradeHistory].filter(trade => trade.assetId === asset.id);
    
    allTrades.forEach(trade => {
      // Entry marker
      newMarkers.push({
        price: parseFloat(trade.openPrice),
        timestamp: new Date(trade.createdAt || Date.now()).getTime(),
        type: 'entry',
        tradeType: trade.type as 'CALL' | 'PUT',
        status: trade.status as 'won' | 'lost' | 'open',
        tradeId: trade.id
      });
      
      // Exit marker (only if trade is closed)
      if (trade.closePrice && trade.status !== 'open') {
        newMarkers.push({
          price: parseFloat(trade.closePrice),
          timestamp: new Date(trade.expiryTime).getTime(),
          type: 'exit',
          tradeType: trade.type as 'CALL' | 'PUT',
          status: trade.status as 'won' | 'lost' | 'open',
          tradeId: trade.id
        });
      }
    });
    
    setMarkers(newMarkers);
  }, [asset, openTrades, tradeHistory]);

  // Update last candle with current price (throttled to 10000ms for smoother updates)
  useEffect(() => {
    if (!asset) return;

    // Reset on asset/timeframe change
    lastUpdateTimeRef.current = 0;
    priceUpdateRef.current = parseFloat(asset.currentPrice);
    
    const updateInterval = setInterval(() => {
      const currentTime = Date.now();
      const timeSinceLastUpdate = currentTime - lastUpdateTimeRef.current;
      
      // Only update if at least 10000ms (10 seconds) have passed
      if (timeSinceLastUpdate < 10000) {
        return;
      }

      lastUpdateTimeRef.current = currentTime;
      const currentPrice = priceUpdateRef.current;
      
      setCandles(prevCandles => {
        if (prevCandles.length === 0) return prevCandles;
        const updatedCandles = [...prevCandles];
        const lastCandle = updatedCandles[updatedCandles.length - 1];
        
        // Update the last candle's close price and adjust high/low if needed
        lastCandle.close = currentPrice;
        lastCandle.high = Math.max(lastCandle.high, currentPrice);
        lastCandle.low = Math.min(lastCandle.low, currentPrice);
        
        return updatedCandles;
      });
    }, 2000); // Check every 2 seconds but only update every 10 seconds

    return () => clearInterval(updateInterval);
  }, [asset?.id, timeframe, candles.length]);

  // Update price ref when asset price changes
  useEffect(() => {
    if (asset) {
      priceUpdateRef.current = parseFloat(asset.currentPrice);
    }
  }, [asset?.currentPrice]);

  // Draw the chart
  useEffect(() => {
    if (!canvasRef.current || !asset || candles.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas with dark background
    ctx.fillStyle = 'hsl(220, 25%, 10%)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate price range including marker prices
    const prices = candles.flatMap(c => [c.high, c.low]);
    const markerPrices = markers.map(m => m.price);
    const allPrices = [...prices, ...markerPrices].filter(p => !isNaN(p) && isFinite(p));
    const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 100;
    const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
    const priceRange = maxPrice - minPrice || 1;
    const padding = priceRange * 0.1;

    // Calculate candle dimensions
    const leftMargin = 80;
    const rightMargin = 20;
    const topMargin = 20;
    const bottomMargin = 30;
    const chartWidth = canvas.width - leftMargin - rightMargin;
    const chartHeight = canvas.height - topMargin - bottomMargin;
    
    const visibleCandles = Math.min(candles.length, 80);
    const candleWidth = Math.max(4, chartWidth / visibleCandles - 3);
    const candleSpacing = chartWidth / visibleCandles;
    const startIndex = Math.max(0, candles.length - visibleCandles);

    // Scale price to canvas Y coordinate
    const scalePrice = (price: number) => {
      return topMargin + chartHeight - ((price - (minPrice - padding)) / (priceRange + padding * 2)) * chartHeight;
    };

    // Scale timestamp to X coordinate
    const scaleTime = (timestamp: number) => {
      if (candles.length === 0) return leftMargin;
      const firstCandle = candles[startIndex];
      const lastCandle = candles[candles.length - 1];
      const timeRange = lastCandle.timestamp - firstCandle.timestamp;
      if (timeRange === 0) return leftMargin;
      const position = (timestamp - firstCandle.timestamp) / timeRange;
      return leftMargin + position * chartWidth;
    };

    // Draw price labels on Y-axis
    ctx.fillStyle = 'hsl(0, 0%, 60%)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    const priceSteps = 6;
    for (let i = 0; i <= priceSteps; i++) {
      const price = minPrice - padding + (priceRange + padding * 2) * (i / priceSteps);
      const y = scalePrice(price);
      ctx.fillText(price.toFixed(asset.category === 'crypto' ? 2 : 5), leftMargin - 10, y + 3);
      
      // Draw horizontal grid line
      ctx.strokeStyle = 'hsl(220, 15%, 15%)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(canvas.width - rightMargin, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw enhanced candlesticks with gradients
    candles.slice(startIndex).forEach((candle, i) => {
      const x = leftMargin + i * candleSpacing + candleSpacing / 2;
      const isGreen = candle.close >= candle.open;
      
      const openY = scalePrice(candle.open);
      const closeY = scalePrice(candle.close);
      const highY = scalePrice(candle.high);
      const lowY = scalePrice(candle.low);
      
      // Draw shadow for depth
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
      const bodyY = Math.min(openY, closeY);
      ctx.fillRect(x - candleWidth/2 + 1, bodyY + 1, candleWidth, bodyHeight);
      
      // Draw wick with thinner line
      ctx.strokeStyle = isGreen ? 'hsl(142, 76%, 50%)' : 'hsl(0, 84%, 65%)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();
      
      // Draw body with gradient
      const gradient = ctx.createLinearGradient(x - candleWidth/2, bodyY, x - candleWidth/2, bodyY + bodyHeight);
      if (isGreen) {
        gradient.addColorStop(0, 'hsl(142, 76%, 55%)');
        gradient.addColorStop(1, 'hsl(142, 76%, 40%)');
      } else {
        gradient.addColorStop(0, 'hsl(0, 84%, 70%)');
        gradient.addColorStop(1, 'hsl(0, 84%, 55%)');
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(x - candleWidth/2, bodyY, candleWidth, bodyHeight);
      
      // Add subtle border
      ctx.strokeStyle = isGreen ? 'hsl(142, 76%, 35%)' : 'hsl(0, 84%, 45%)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x - candleWidth/2, bodyY, candleWidth, bodyHeight);
    });

    // Draw trade markers and connection lines
    const tradeConnections = new Map<string, { entry: TradeMarker, exit?: TradeMarker }>();
    
    // Filter markers to visible time range
    const firstCandle = candles[startIndex];
    const lastCandle = candles[candles.length - 1];
    const visibleMarkers = markers.filter(marker => {
      return marker.timestamp >= firstCandle.timestamp && marker.timestamp <= lastCandle.timestamp;
    });
    
    visibleMarkers.forEach(marker => {
      if (marker.type === 'entry') {
        tradeConnections.set(marker.tradeId, { entry: marker });
      } else {
        const conn = tradeConnections.get(marker.tradeId);
        if (conn) {
          conn.exit = marker;
        }
      }
    });

    // Draw connection lines first
    tradeConnections.forEach((conn) => {
      if (conn.exit) {
        const entryX = scaleTime(conn.entry.timestamp);
        const entryY = scalePrice(conn.entry.price);
        const exitX = scaleTime(conn.exit.timestamp);
        const exitY = scalePrice(conn.exit.price);
        
        const color = conn.exit.status === 'won' ? 'hsl(142, 76%, 50%)' : 'hsl(0, 84%, 60%)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(entryX, entryY);
        ctx.lineTo(exitX, exitY);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      }
    });

    // Draw markers
    visibleMarkers.forEach(marker => {
      const x = scaleTime(marker.timestamp);
      const y = scalePrice(marker.price);
      
      if (marker.type === 'entry') {
        // Entry marker - circle
        const color = marker.tradeType === 'CALL' ? 'hsl(142, 76%, 50%)' : 'hsl(0, 84%, 60%)';
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Arrow inside circle
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(marker.tradeType === 'CALL' ? '↑' : '↓', x, y);
      } else {
        // Exit marker - square
        const color = marker.status === 'won' ? 'hsl(142, 76%, 50%)' : 'hsl(0, 84%, 60%)';
        
        ctx.fillStyle = color;
        ctx.fillRect(x - 5, y - 5, 10, 10);
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 5, y - 5, 10, 10);
      }
    });

    // Draw current price line
    const currentPrice = parseFloat(asset.currentPrice);
    const currentPriceY = scalePrice(currentPrice);
    ctx.strokeStyle = 'hsl(217, 91%, 65%)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(leftMargin, currentPriceY);
    ctx.lineTo(canvas.width - rightMargin, currentPriceY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw current price label with modern design
    const priceText = currentPrice.toFixed(asset.category === 'crypto' ? 2 : 5);
    ctx.font = 'bold 11px monospace';
    const textWidth = ctx.measureText(priceText).width;
    
    ctx.fillStyle = 'hsl(217, 91%, 65%)';
    ctx.fillRect(canvas.width - rightMargin - textWidth - 16, currentPriceY - 11, textWidth + 12, 22);
    
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(priceText, canvas.width - rightMargin - 8, currentPriceY);

  }, [candles, asset, markers]);

  const timeframes = [
    { key: '1m', label: '1د' },
    { key: '5m', label: '5د' },
    { key: '15m', label: '15د' },
    { key: '1h', label: '1س' },
    { key: '4h', label: '4س' },
  ];

  return (
    <div className="h-full relative">
      {/* Chart Controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="bg-card/80 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2">
          {timeframes.map(tf => (
            <button
              key={tf.key}
              onClick={() => onTimeframeChange(tf.key)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                timeframe === tf.key
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-secondary'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <button className="bg-card/80 backdrop-blur-sm rounded-lg px-3 py-2 hover:bg-secondary transition-colors">
          <i className="fas fa-chart-bar text-sm"></i>
        </button>
        <button className="bg-card/80 backdrop-blur-sm rounded-lg px-3 py-2 hover:bg-secondary transition-colors">
          <i className="fas fa-compress text-sm"></i>
        </button>
      </div>

      {/* Indicator Controls */}
      <div className="absolute top-4 right-4 z-10">
        <button className="bg-card/80 backdrop-blur-sm rounded-lg px-3 py-2 hover:bg-secondary transition-colors flex items-center gap-2">
          <i className="fas fa-chart-line text-sm"></i>
          <span className="text-xs font-medium">المؤشرات</span>
        </button>
      </div>

      {/* Chart Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full bg-card rounded-lg"
        style={{ background: 'hsl(220, 25%, 10%)' }}
      />

      {/* Price Level Indicator - removed, now drawn on canvas */}
    </div>
  );
}
