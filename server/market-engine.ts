import { z } from 'zod';

// ✅ Zod schemas for strict validation - NO null values allowed
export const CandleSchema = z.object({
  time: z.number().int().positive(),
  open: z.number().finite(),
  high: z.number().finite(),
  low: z.number().finite(),
  close: z.number().finite(),
}).refine(data => data.high >= data.low, {
  message: "High must be >= Low"
}).refine(data => data.high >= Math.max(data.open, data.close), {
  message: "High must be >= max(open, close)"
}).refine(data => data.low <= Math.min(data.open, data.close), {
  message: "Low must be <= min(open, close)"
});

export const PriceTickSchema = z.object({
  pair: z.string().min(1),
  time: z.number().int().positive(),
  price: z.number().finite().positive(),
});

export type Candle = z.infer<typeof CandleSchema>;
export type PriceTick = z.infer<typeof PriceTickSchema>;

interface MarketState {
  pair: string;
  currentPrice: number;
  currentCandle: Candle;
  candleStartTime: number;
  candleInterval: number; // in seconds
  momentum: number;
  priceHistory: number[];
}

export class MarketEngine {
  private markets: Map<string, MarketState> = new Map();
  private isInitialized = false;

  constructor(private candleInterval: number = 60) {}

  // Initialize a market with starting price
  initializeMarket(pair: string, startPrice: number): void {
    if (typeof startPrice !== 'number' || isNaN(startPrice) || startPrice <= 0) {
      throw new Error(`Invalid start price for ${pair}: ${startPrice}`);
    }

    const currentTime = Math.floor(Date.now() / 1000);
    
    const initialCandle: Candle = {
      time: currentTime,
      open: startPrice,
      high: startPrice,
      low: startPrice,
      close: startPrice,
    };

    // Validate the candle
    CandleSchema.parse(initialCandle);

    this.markets.set(pair, {
      pair,
      currentPrice: startPrice,
      currentCandle: initialCandle,
      candleStartTime: currentTime,
      candleInterval: this.candleInterval,
      momentum: 0,
      priceHistory: [startPrice],
    });
  }

  // Generate next price tick with realistic movement
  generatePriceTick(pair: string, volatility: number = 0.0003): PriceTick {
    const market = this.markets.get(pair);
    if (!market) {
      throw new Error(`Market ${pair} not initialized`);
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const last = market.currentPrice;

    // Realistic price movement with momentum
    const randomChange = (Math.random() - 0.5) * volatility * 2;
    market.momentum = market.momentum * 0.85 + randomChange * 0.15;
    
    // Mean reversion
    const recentAvg = market.priceHistory.slice(-10).reduce((a, b) => a + b, 0) / Math.min(market.priceHistory.length, 10);
    const meanReversionForce = (recentAvg - last) * 0.02;
    
    const priceChange = last * (market.momentum + meanReversionForce);
    let newPrice = last + priceChange;

    // Ensure price stays positive and reasonable
    const minPrice = last * 0.95;
    const maxPrice = last * 1.05;
    newPrice = Math.max(minPrice, Math.min(maxPrice, newPrice));

    // Update price history
    market.priceHistory.push(newPrice);
    if (market.priceHistory.length > 50) {
      market.priceHistory.shift();
    }

    market.currentPrice = newPrice;

    const tick: PriceTick = {
      pair,
      time: currentTime,
      price: newPrice,
    };

    // Validate before returning
    return PriceTickSchema.parse(tick);
  }

  // Update candle with new price tick
  updateCandle(pair: string, tick: PriceTick): { candle: Candle; isNewCandle: boolean } {
    const market = this.markets.get(pair);
    if (!market) {
      throw new Error(`Market ${pair} not initialized`);
    }

    // Validate tick
    PriceTickSchema.parse(tick);

    const currentTime = tick.time;
    const price = tick.price;
    const elapsedTime = currentTime - market.candleStartTime;

    let isNewCandle = false;

    // Check if we need to start a new candle
    if (elapsedTime >= market.candleInterval) {
      // Finalize current candle
      const completedCandle = { ...market.currentCandle };
      
      // Start new candle
      market.candleStartTime = currentTime;
      market.currentCandle = {
        time: currentTime,
        open: market.currentCandle.close, // Use previous close as new open
        high: price,
        low: price,
        close: price,
      };
      
      isNewCandle = true;
    } else {
      // Update current candle
      market.currentCandle.close = price;
      market.currentCandle.high = Math.max(market.currentCandle.high, price);
      market.currentCandle.low = Math.min(market.currentCandle.low, price);
      market.currentCandle.time = market.candleStartTime; // Keep original start time
    }

    // Validate candle before returning
    const validatedCandle = CandleSchema.parse(market.currentCandle);

    return {
      candle: validatedCandle,
      isNewCandle,
    };
  }

  // Get current candle for a market
  getCurrentCandle(pair: string): Candle | null {
    const market = this.markets.get(pair);
    if (!market) {
      return null;
    }
    
    // Validate before returning
    return CandleSchema.parse(market.currentCandle);
  }

  // Get all markets
  getAllMarkets(): string[] {
    return Array.from(this.markets.keys());
  }

  // Mark as initialized
  markInitialized(): void {
    this.isInitialized = true;
  }

  // Check if initialized
  isReady(): boolean {
    return this.isInitialized && this.markets.size > 0;
  }

  // Get volatility based on asset type
  static getVolatility(pair: string): number {
    if (pair.includes('BTC') || pair.includes('ETH') || pair.includes('crypto')) {
      return 0.0008; // Higher volatility for crypto
    } else if (pair.includes('GOLD') || pair.includes('SILVER')) {
      return 0.0004; // Medium volatility for commodities
    } else if (pair.includes('JPY')) {
      return 0.00015; // Very low volatility for JPY pairs
    } else {
      return 0.0003; // Normal forex volatility
    }
  }
}
