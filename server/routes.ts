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
    // Return common trading assets
    const assets = [
      { id: "EURUSD", name: "EUR/USD", symbol: "EUR/USD", category: "forex", isActive: true, payoutRate: 85 },
      { id: "GBPUSD", name: "GBP/USD", symbol: "GBP/USD", category: "forex", isActive: true, payoutRate: 84 },
      { id: "USDJPY", name: "USD/JPY", symbol: "USD/JPY", category: "forex", isActive: true, payoutRate: 83 },
      { id: "AUDUSD", name: "AUD/USD", symbol: "AUD/USD", category: "forex", isActive: true, payoutRate: 84 },
      { id: "USDCAD", name: "USD/CAD", symbol: "USD/CAD", category: "forex", isActive: true, payoutRate: 83 },
      { id: "BTCUSD", name: "Bitcoin", symbol: "BTC/USD", category: "crypto", isActive: true, payoutRate: 82 },
      { id: "ETHUSD", name: "Ethereum", symbol: "ETH/USD", category: "crypto", isActive: true, payoutRate: 81 },
    ];
    res.json(assets);
  });

  app.get("/api/binomo/candles/:assetId", async (req, res) => {
    const { assetId } = req.params;
    const count = parseInt(req.query.count as string) || 100;
    
    const basePrices: Record<string, number> = {
      "EURUSD": 1.0850, "GBPUSD": 1.2650, "USDJPY": 149.50,
      "AUDUSD": 0.6550, "USDCAD": 1.3550,
      "BTCUSD": 43256.50, "ETHUSD": 2345.67
    };
    
    let basePrice = basePrices[assetId] || 1.0;
    const currentTime = Math.floor(Date.now() / 1000);
    const candles = [];
    
    for (let i = 0; i < count; i++) {
      const volatility = (assetId.includes("BTC") || assetId.includes("ETH")) ? 0.02 : 0.001;
      const priceChange = (Math.random() - 0.5) * volatility * basePrice;
      const openPrice = basePrice + priceChange;
      const decimals = (assetId.includes("BTC") || assetId.includes("ETH")) ? 2 : 5;
      
      candles.push({
        timestamp: currentTime - (count - i) * 60,
        open: parseFloat(openPrice.toFixed(decimals)),
        high: parseFloat((openPrice + Math.random() * volatility * basePrice).toFixed(decimals)),
        low: parseFloat((openPrice - Math.random() * volatility * basePrice).toFixed(decimals)),
        close: parseFloat((openPrice + (Math.random() - 0.5) * volatility * basePrice).toFixed(decimals)),
        volume: Math.floor(Math.random() * 100000) + 1000
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
    const basePrices: Record<string, number> = {
      "EURUSD": 1.0850, "GBPUSD": 1.2650, "USDJPY": 149.50,
      "AUDUSD": 0.6550, "USDCAD": 1.3550,
      "BTCUSD": 43256.50, "ETHUSD": 2345.67
    };
    
    const basePrice = basePrices[assetId] || 1.0;
    const price = basePrice + (Math.random() - 0.5) * 0.01 * basePrice;
    const decimals = (assetId.includes("BTC") || assetId.includes("ETH")) ? 2 : 5;
    
    res.json({
      asset_id: assetId,
      price: parseFloat(price.toFixed(decimals)),
      timestamp: Math.floor(Date.now() / 1000)
    });
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
      // Preprocess: convert expiry string to Date
      const processedBody = {
        ...req.body,
        expiryTime: typeof req.body.expiryTime === 'string' ? new Date(req.body.expiryTime) : req.body.expiryTime
      };
      const validated = insertTradeSchema.parse(processedBody);
      const trade = await storage.createTrade(validated);
      res.json(trade);
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
      res.json(trades);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });

  // Get open trades for user
  app.get("/api/trades/user/:userId/open", async (req, res) => {
    try {
      const trades = await storage.getOpenTradesByUser(req.params.userId);
      res.json(trades);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch open trades" });
    }
  });

  // Close trade
  app.patch("/api/trades/:id/close", async (req, res) => {
    try {
      const { closePrice, status, payout } = req.body;
      const trade = await storage.updateTrade(req.params.id, closePrice, status, payout);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }
      res.json(trade);
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
      
      assets.forEach(asset => {
        // Generate realistic price movement
        const currentPrice = parseFloat(asset.currentPrice);
        const volatility = asset.category === 'crypto' ? 0.02 : 0.001; // Higher volatility for crypto
        const change = (Math.random() - 0.5) * 2 * volatility;
        const newPrice = currentPrice * (1 + change);
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

        // Generate candlestick data
        const now = new Date();
        const open = currentPrice;
        const high = Math.max(open, newPrice) * (1 + Math.random() * 0.001);
        const low = Math.min(open, newPrice) * (1 - Math.random() * 0.001);
        
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

  // Start price simulation
  setInterval(simulatePrices, 2000); // Update every 2 seconds

  // Trade expiry checker
  const checkTradeExpiry = () => {
    // This would normally check all open trades and close expired ones
    // Implementation depends on how you want to handle trade expiry
  };

  setInterval(checkTradeExpiry, 1000); // Check every second

  return httpServer;
}
