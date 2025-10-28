import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { MarketEngine, CandleSchema, PriceTickSchema, type Candle, type PriceTick } from './market-engine';
import { storage } from './storage';
import { z } from 'zod';

// ✅ WebSocket message schemas for validation
const WSSubscribeSchema = z.object({
  type: z.literal('subscribe'),
});

const WSSubscribePairSchema = z.object({
  type: z.literal('subscribe_pair'),
  pair: z.string().min(1),
});

// ✅ Typed WebSocket messages
export interface WSPriceTickMessage {
  type: 'otc_price_tick';
  data: PriceTick;
}

export interface WSCandleUpdateMessage {
  type: 'candle_update';
  data: {
    pair: string;
    candle: Candle;
    isNewCandle: boolean;
  };
}

export interface WSAssetsMessage {
  type: 'assets';
  data: any[];
}

export type WSMessage = WSPriceTickMessage | WSCandleUpdateMessage | WSAssetsMessage;

export class WebSocketHandler {
  private wss: WebSocketServer;
  private connectedClients: Set<WebSocket> = new Set();
  private marketEngine: MarketEngine;
  private priceUpdateInterval: NodeJS.Timeout | null = null;

  constructor(
    httpServer: Server,
    marketEngine: MarketEngine
  ) {
    this.marketEngine = marketEngine;
    
    // Create WebSocket server
    this.wss = new WebSocketServer({ 
      server: httpServer, 
      path: '/ws' 
    });

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  private handleConnection(ws: WebSocket): void {
    this.connectedClients.add(ws);
    console.log('Client connected to WebSocket. Total clients:', this.connectedClients.size);

    ws.on('message', (message) => {
      this.handleMessage(ws, message);
    });

    ws.on('close', () => {
      this.connectedClients.delete(ws);
      console.log('Client disconnected from WebSocket. Total clients:', this.connectedClients.size);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.connectedClients.delete(ws);
    });
  }

  private async handleMessage(ws: WebSocket, message: any): Promise<void> {
    try {
      const data = JSON.parse(message.toString());

      // Handle subscribe
      if (data.type === 'subscribe') {
        WSSubscribeSchema.parse(data);
        
        // Only send data if market engine is ready
        if (!this.marketEngine.isReady()) {
          console.log('Market engine not ready yet, skipping subscribe response');
          return;
        }

        // Send assets
        const assets = await storage.getAllAssets();
        this.sendMessage(ws, {
          type: 'assets',
          data: assets,
        });

        // Send current candles for all pairs
        const pairs = this.marketEngine.getAllMarkets();
        const candles: Record<string, Candle> = {};
        
        pairs.forEach(pair => {
          const candle = this.marketEngine.getCurrentCandle(pair);
          if (candle) {
            // Validate before adding
            try {
              candles[pair] = CandleSchema.parse(candle);
            } catch (e) {
              console.error(`Invalid candle for ${pair}:`, e);
            }
          }
        });

        // Only send if we have valid candles
        if (Object.keys(candles).length > 0) {
          this.sendMessage(ws, {
            type: 'current_candles',
            data: {
              candles,
              candleInterval: 60,
            },
          });
        }
      }

      // Handle subscribe to specific pair
      if (data.type === 'subscribe_pair') {
        const validated = WSSubscribePairSchema.parse(data);
        const candle = this.marketEngine.getCurrentCandle(validated.pair);
        
        if (candle && ws.readyState === WebSocket.OPEN) {
          // Validate before sending
          const validatedCandle = CandleSchema.parse(candle);
          
          this.sendMessage(ws, {
            type: 'current_candle',
            data: {
              pair: validated.pair,
              candle: validatedCandle,
              candleInterval: 60,
            },
          });
        }
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  }

  private sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    }
  }

  private broadcast(message: WSMessage): void {
    const messageStr = JSON.stringify(message);
    
    this.connectedClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (error) {
          console.error('Error broadcasting to client:', error);
          this.connectedClients.delete(client);
        }
      } else {
        this.connectedClients.delete(client);
      }
    });
  }

  // Start price updates
  startPriceUpdates(): void {
    if (this.priceUpdateInterval) {
      return; // Already running
    }

    console.log('🚀 Starting price updates (1 update per second)');

    this.priceUpdateInterval = setInterval(() => {
      if (!this.marketEngine.isReady()) {
        return;
      }

      const pairs = this.marketEngine.getAllMarkets();
      
      pairs.forEach(pair => {
        try {
          // Get volatility for this pair
          const volatility = MarketEngine.getVolatility(pair);
          
          // Generate price tick
          const tick = this.marketEngine.generatePriceTick(pair, volatility);
          
          // Validate tick
          const validatedTick = PriceTickSchema.parse(tick);
          
          // Broadcast tick
          this.broadcast({
            type: 'otc_price_tick',
            data: validatedTick,
          });

          // Update candle
          const { candle, isNewCandle } = this.marketEngine.updateCandle(pair, validatedTick);
          
          // Validate candle
          const validatedCandle = CandleSchema.parse(candle);
          
          // Broadcast candle update
          this.broadcast({
            type: 'candle_update',
            data: {
              pair,
              candle: validatedCandle,
              isNewCandle,
            },
          });
        } catch (error) {
          console.error(`Error updating ${pair}:`, error);
        }
      });
    }, 1000); // Update every second
  }

  // Stop price updates
  stopPriceUpdates(): void {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
      console.log('Stopped price updates');
    }
  }

  // Close all connections
  close(): void {
    this.stopPriceUpdates();
    this.connectedClients.forEach(client => {
      client.close();
    });
    this.wss.close();
  }
}
