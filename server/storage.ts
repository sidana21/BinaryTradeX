import { type User, type InsertUser, type Asset, type InsertAsset, type Trade, type InsertTrade, type PriceData, type InsertPriceData, type Deposit, type InsertDeposit, type Withdrawal, type InsertWithdrawal, type Settings, type UpdateSettings, users, assets, trades, priceData as priceDataTable, deposits, withdrawals, settings as settingsTable } from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, desc, and } from 'drizzle-orm';

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: string, demoBalance: string, realBalance: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  // Assets
  getAllAssets(): Promise<Asset[]>;
  getAsset(id: string): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAssetPrice(id: string, price: string, change: string, changePercent: string): Promise<Asset | undefined>;

  // Trades
  getTrade(id: string): Promise<Trade | undefined>;
  getTradesByUser(userId: string): Promise<Trade[]>;
  getOpenTradesByUser(userId: string): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: string, closePrice: string, status: string, payout: string): Promise<Trade | undefined>;
  getAllTrades(): Promise<Trade[]>;

  // Price Data
  getPriceData(assetId: string, limit?: number): Promise<PriceData[]>;
  getPriceDataSince(assetId: string, sinceTimestamp: Date): Promise<PriceData[]>;
  addPriceData(priceData: InsertPriceData): Promise<PriceData>;
  updatePriceData(assetId: string, timestamp: Date, high: string, low: string, close: string): Promise<PriceData | undefined>;
  cleanupOldPriceData(daysToKeep: number): Promise<number>;

  // Deposits
  getDeposit(id: string): Promise<Deposit | undefined>;
  getDepositsByUser(userId: string): Promise<Deposit[]>;
  createDeposit(deposit: InsertDeposit): Promise<Deposit>;
  updateDepositStatus(id: string, status: string, completedAt?: Date): Promise<Deposit | undefined>;
  getAllDeposits(): Promise<Deposit[]>;

  // Withdrawals
  getWithdrawal(id: string): Promise<Withdrawal | undefined>;
  getWithdrawalsByUser(userId: string): Promise<Withdrawal[]>;
  createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal>;
  updateWithdrawalStatus(id: string, status: string, processedAt?: Date, transactionHash?: string, notes?: string): Promise<Withdrawal | undefined>;
  getAllWithdrawals(): Promise<Withdrawal[]>;

  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(settings: UpdateSettings): Promise<Settings>;
}

export class DbStorage implements IStorage {
  private db;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    this.db = drizzle(pool);
    this.initialize();
  }

  private async initialize() {
    await this.initializeAssets();
    await this.initializeDemoUser();
    await this.initializeSettings();
  }

  private async initializeDemoUser() {
    const existingUser = await this.getUserByUsername('demo');
    if (!existingUser) {
      const randomPassword = randomUUID();
      await this.db.insert(users).values({
        id: 'demo_user',
        username: 'demo',
        email: 'demo@bokoption.com',
        password: randomPassword,
        demoBalance: '10000.00',
        realBalance: '0.00',
        isAdmin: false,
      });
    }
  }

  private async initializeSettings() {
    const existingSettings = await this.db.select().from(settingsTable).limit(1);
    if (existingSettings.length === 0) {
      await this.db.insert(settingsTable).values({
        id: "default",
        winRate: "20.00",
        usdtTrc20Address: null,
        usdtErc20Address: null,
        usdtBep20Address: null,
      });
    }
  }

  private async initializeAssets() {
    const existingAssets = await this.db.select().from(assets).limit(1);
    if (existingAssets.length > 0) return;

    const defaultAssets: InsertAsset[] = [
      { id: "EURUSD_OTC", name: "EUR/USD (OTC)", symbol: "EUR/USD OTC", category: "forex", currentPrice: "1.0856", priceChange: "0.0023", priceChangePercent: "0.23", isActive: true, payoutRate: "88.00" },
      { id: "GBPUSD_OTC", name: "GBP/USD (OTC)", symbol: "GBP/USD OTC", category: "forex", currentPrice: "1.2678", priceChange: "-0.0057", priceChangePercent: "-0.45", isActive: true, payoutRate: "87.00" },
      { id: "USDJPY_OTC", name: "USD/JPY (OTC)", symbol: "USD/JPY OTC", category: "forex", currentPrice: "149.85", priceChange: "0.83", priceChangePercent: "0.56", isActive: true, payoutRate: "86.00" },
      { id: "AUDUSD_OTC", name: "AUD/USD (OTC)", symbol: "AUD/USD OTC", category: "forex", currentPrice: "0.6550", priceChange: "0.0012", priceChangePercent: "0.18", isActive: true, payoutRate: "85.00" },
      { id: "USDCAD_OTC", name: "USD/CAD (OTC)", symbol: "USD/CAD OTC", category: "forex", currentPrice: "1.3550", priceChange: "-0.0025", priceChangePercent: "-0.18", isActive: true, payoutRate: "85.00" },
      { id: "USDCHF_OTC", name: "USD/CHF (OTC)", symbol: "USD/CHF OTC", category: "forex", currentPrice: "0.8845", priceChange: "0.0015", priceChangePercent: "0.17", isActive: true, payoutRate: "84.00" },
      { id: "NZDUSD_OTC", name: "NZD/USD (OTC)", symbol: "NZD/USD OTC", category: "forex", currentPrice: "0.6125", priceChange: "0.0008", priceChangePercent: "0.13", isActive: true, payoutRate: "84.00" },
      { id: "EURJPY_OTC", name: "EUR/JPY (OTC)", symbol: "EUR/JPY OTC", category: "forex", currentPrice: "162.45", priceChange: "0.52", priceChangePercent: "0.32", isActive: true, payoutRate: "86.00" },
      { id: "EURGBP_OTC", name: "EUR/GBP (OTC)", symbol: "EUR/GBP OTC", category: "forex", currentPrice: "0.8565", priceChange: "-0.0015", priceChangePercent: "-0.18", isActive: true, payoutRate: "85.00" },
      { id: "EURAUD_OTC", name: "EUR/AUD (OTC)", symbol: "EUR/AUD OTC", category: "forex", currentPrice: "1.6580", priceChange: "0.0045", priceChangePercent: "0.27", isActive: true, payoutRate: "84.00" },
      { id: "EURCHF_OTC", name: "EUR/CHF (OTC)", symbol: "EUR/CHF OTC", category: "forex", currentPrice: "0.9605", priceChange: "0.0012", priceChangePercent: "0.13", isActive: true, payoutRate: "84.00" },
      { id: "GBPJPY_OTC", name: "GBP/JPY (OTC)", symbol: "GBP/JPY OTC", category: "forex", currentPrice: "189.95", priceChange: "1.25", priceChangePercent: "0.66", isActive: true, payoutRate: "85.00" },
      { id: "AUDCAD_OTC", name: "AUD/CAD (OTC)", symbol: "AUD/CAD OTC", category: "forex", currentPrice: "0.8875", priceChange: "0.0018", priceChangePercent: "0.20", isActive: true, payoutRate: "83.00" },
      { id: "AUDJPY_OTC", name: "AUD/JPY (OTC)", symbol: "AUD/JPY OTC", category: "forex", currentPrice: "98.15", priceChange: "0.45", priceChangePercent: "0.46", isActive: true, payoutRate: "84.00" },
      { id: "CHFJPY_OTC", name: "CHF/JPY (OTC)", symbol: "CHF/JPY OTC", category: "forex", currentPrice: "169.35", priceChange: "0.85", priceChangePercent: "0.50", isActive: true, payoutRate: "83.00" },
      { id: "CADJPY_OTC", name: "CAD/JPY (OTC)", symbol: "CAD/JPY OTC", category: "forex", currentPrice: "110.65", priceChange: "0.35", priceChangePercent: "0.32", isActive: true, payoutRate: "83.00" },
      { id: "NZDJPY_OTC", name: "NZD/JPY (OTC)", symbol: "NZD/JPY OTC", category: "forex", currentPrice: "91.75", priceChange: "0.28", priceChangePercent: "0.31", isActive: true, payoutRate: "83.00" },
      { id: "EURCAD_OTC", name: "EUR/CAD (OTC)", symbol: "EUR/CAD OTC", category: "forex", currentPrice: "1.4725", priceChange: "0.0035", priceChangePercent: "0.24", isActive: true, payoutRate: "85.00" },
      { id: "GBPAUD_OTC", name: "GBP/AUD (OTC)", symbol: "GBP/AUD OTC", category: "forex", currentPrice: "1.9345", priceChange: "0.0065", priceChangePercent: "0.34", isActive: true, payoutRate: "84.00" },
      { id: "GBPCAD_OTC", name: "GBP/CAD (OTC)", symbol: "GBP/CAD OTC", category: "forex", currentPrice: "1.7185", priceChange: "-0.0042", priceChangePercent: "-0.24", isActive: true, payoutRate: "84.00" },
      { id: "BTCUSD_OTC", name: "Bitcoin (OTC)", symbol: "BTC/USD OTC", category: "crypto", currentPrice: "43256.50", priceChange: "915.30", priceChangePercent: "2.15", isActive: true, payoutRate: "90.00" },
      { id: "ETHUSD_OTC", name: "Ethereum (OTC)", symbol: "ETH/USD OTC", category: "crypto", currentPrice: "2287.80", priceChange: "-25.90", priceChangePercent: "-1.12", isActive: true, payoutRate: "89.00" },
      { id: "LTCUSD_OTC", name: "Litecoin (OTC)", symbol: "LTC/USD OTC", category: "crypto", currentPrice: "72.45", priceChange: "1.85", priceChangePercent: "2.62", isActive: true, payoutRate: "87.00" },
      { id: "XRPUSD_OTC", name: "Ripple (OTC)", symbol: "XRP/USD OTC", category: "crypto", currentPrice: "0.5245", priceChange: "0.0125", priceChangePercent: "2.44", isActive: true, payoutRate: "87.00" },
      { id: "BNBUSD_OTC", name: "Binance Coin (OTC)", symbol: "BNB/USD OTC", category: "crypto", currentPrice: "315.45", priceChange: "8.75", priceChangePercent: "2.85", isActive: true, payoutRate: "88.00" },
      { id: "ADAUSD_OTC", name: "Cardano (OTC)", symbol: "ADA/USD OTC", category: "crypto", currentPrice: "0.4823", priceChange: "0.0156", priceChangePercent: "3.34", isActive: true, payoutRate: "86.00" },
      { id: "GOLD_OTC", name: "الذهب (OTC)", symbol: "XAU/USD OTC", category: "commodity", currentPrice: "2045.30", priceChange: "17.85", priceChangePercent: "0.87", isActive: true, payoutRate: "86.00" },
      { id: "SILVER_OTC", name: "الفضة (OTC)", symbol: "XAG/USD OTC", category: "commodity", currentPrice: "24.65", priceChange: "0.35", priceChangePercent: "1.44", isActive: true, payoutRate: "85.00" },
      { id: "OIL_OTC", name: "النفط (OTC)", symbol: "WTI OTC", category: "commodity", currentPrice: "78.45", priceChange: "0.95", priceChangePercent: "1.23", isActive: true, payoutRate: "84.00" },
      { id: "COPPER_OTC", name: "النحاس (OTC)", symbol: "XCU/USD OTC", category: "commodity", currentPrice: "3.8450", priceChange: "0.0425", priceChangePercent: "1.12", isActive: true, payoutRate: "83.00" },
      { id: "NATURALGAS_OTC", name: "الغاز الطبيعي (OTC)", symbol: "NG/USD OTC", category: "commodity", currentPrice: "2.7850", priceChange: "-0.0325", priceChangePercent: "-1.15", isActive: true, payoutRate: "83.00" },
      { id: "SPX_OTC", name: "S&P 500 (OTC)", symbol: "SPX OTC", category: "index", currentPrice: "4567.20", priceChange: "41.75", priceChangePercent: "0.92", isActive: true, payoutRate: "85.00" },
      { id: "NDX_OTC", name: "NASDAQ 100 (OTC)", symbol: "NDX OTC", category: "index", currentPrice: "15892.50", priceChange: "125.30", priceChangePercent: "0.80", isActive: true, payoutRate: "84.00" },
      { id: "DJI_OTC", name: "Dow Jones (OTC)", symbol: "DJI OTC", category: "index", currentPrice: "36789.45", priceChange: "215.80", priceChangePercent: "0.59", isActive: true, payoutRate: "84.00" },
      { id: "DAX_OTC", name: "DAX 40 (OTC)", symbol: "DAX OTC", category: "index", currentPrice: "16245.75", priceChange: "95.50", priceChangePercent: "0.59", isActive: true, payoutRate: "83.00" },
      { id: "CAC40_OTC", name: "CAC 40 (OTC)", symbol: "CAC40 OTC", category: "index", currentPrice: "7456.30", priceChange: "52.15", priceChangePercent: "0.70", isActive: true, payoutRate: "83.00" },
      { id: "FTSE_OTC", name: "FTSE 100 (OTC)", symbol: "FTSE OTC", category: "index", currentPrice: "7625.45", priceChange: "38.20", priceChangePercent: "0.50", isActive: true, payoutRate: "82.00" },
      { id: "NIKKEI_OTC", name: "Nikkei 225 (OTC)", symbol: "N225 OTC", category: "index", currentPrice: "33145.80", priceChange: "285.50", priceChangePercent: "0.87", isActive: true, payoutRate: "82.00" }
    ];

    await this.db.insert(assets).values(defaultAssets);
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const result = await this.db.insert(users).values({
      ...insertUser,
      id,
      demoBalance: "10000.00",
      realBalance: "0.00",
      isAdmin: insertUser.isAdmin ?? false,
    }).returning();
    return result[0];
  }

  async updateUserBalance(userId: string, demoBalance: string, realBalance: string): Promise<User | undefined> {
    const result = await this.db.update(users)
      .set({ demoBalance, realBalance })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users);
  }

  async getAllAssets(): Promise<Asset[]> {
    return await this.db.select().from(assets);
  }

  async getAsset(id: string): Promise<Asset | undefined> {
    const result = await this.db.select().from(assets).where(eq(assets.id, id)).limit(1);
    return result[0];
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const result = await this.db.insert(assets).values(asset).returning();
    return result[0];
  }

  async updateAssetPrice(id: string, price: string, change: string, changePercent: string): Promise<Asset | undefined> {
    const result = await this.db.update(assets)
      .set({ currentPrice: price, priceChange: change, priceChangePercent: changePercent })
      .where(eq(assets.id, id))
      .returning();
    return result[0];
  }

  async getTrade(id: string): Promise<Trade | undefined> {
    const result = await this.db.select().from(trades).where(eq(trades.id, id)).limit(1);
    return result[0];
  }

  async getTradesByUser(userId: string): Promise<Trade[]> {
    return await this.db.select().from(trades).where(eq(trades.userId, userId));
  }

  async getOpenTradesByUser(userId: string): Promise<Trade[]> {
    return await this.db.select().from(trades)
      .where(and(eq(trades.userId, userId), eq(trades.status, "open")));
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const id = randomUUID();
    const result = await this.db.insert(trades).values({
      ...trade,
      id,
      closePrice: null,
      status: "open",
      payout: null,
      isDemo: trade.isDemo ?? true,
      shouldWin: trade.shouldWin ?? false,
    }).returning();
    return result[0];
  }

  async updateTrade(id: string, closePrice: string, status: string, payout: string): Promise<Trade | undefined> {
    const result = await this.db.update(trades)
      .set({ closePrice, status, payout })
      .where(eq(trades.id, id))
      .returning();
    return result[0];
  }

  async getAllTrades(): Promise<Trade[]> {
    return await this.db.select().from(trades).orderBy(desc(trades.createdAt));
  }

  async getPriceData(assetId: string, limit: number = 100): Promise<PriceData[]> {
    return await this.db.select().from(priceDataTable)
      .where(eq(priceDataTable.assetId, assetId))
      .orderBy(desc(priceDataTable.timestamp))
      .limit(limit);
  }

  async getPriceDataSince(assetId: string, sinceTimestamp: Date): Promise<PriceData[]> {
    const { gte } = await import('drizzle-orm');
    return await this.db.select().from(priceDataTable)
      .where(and(
        eq(priceDataTable.assetId, assetId),
        gte(priceDataTable.timestamp, sinceTimestamp)
      ))
      .orderBy(priceDataTable.timestamp);
  }

  async addPriceData(priceData: InsertPriceData): Promise<PriceData> {
    const id = randomUUID();
    const result = await this.db.insert(priceDataTable).values({
      ...priceData,
      id,
      volume: priceData.volume ?? "0.00"
    }).returning();
    return result[0];
  }

  async updatePriceData(assetId: string, timestamp: Date, high: string, low: string, close: string): Promise<PriceData | undefined> {
    const result = await this.db.update(priceDataTable)
      .set({ high, low, close })
      .where(and(
        eq(priceDataTable.assetId, assetId),
        eq(priceDataTable.timestamp, timestamp)
      ))
      .returning();
    return result[0];
  }

  async cleanupOldPriceData(daysToKeep: number): Promise<number> {
    const { lt } = await import('drizzle-orm');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await this.db.delete(priceDataTable)
      .where(lt(priceDataTable.timestamp, cutoffDate));
    
    return (result as any).rowCount || 0;
  }

  async getDeposit(id: string): Promise<Deposit | undefined> {
    const result = await this.db.select().from(deposits).where(eq(deposits.id, id)).limit(1);
    return result[0];
  }

  async getDepositsByUser(userId: string): Promise<Deposit[]> {
    return await this.db.select().from(deposits)
      .where(eq(deposits.userId, userId))
      .orderBy(desc(deposits.createdAt));
  }

  async createDeposit(insertDeposit: InsertDeposit): Promise<Deposit> {
    const id = randomUUID();
    const result = await this.db.insert(deposits).values({
      id,
      userId: insertDeposit.userId,
      amount: insertDeposit.amount,
      method: insertDeposit.method,
      status: insertDeposit.status ?? "pending",
      transactionHash: insertDeposit.transactionHash ?? null,
      walletAddress: insertDeposit.walletAddress ?? null,
      completedAt: null
    }).returning();
    return result[0];
  }

  async updateDepositStatus(id: string, status: string, completedAt?: Date): Promise<Deposit | undefined> {
    const result = await this.db.update(deposits)
      .set({ status, ...(completedAt && { completedAt }) })
      .where(eq(deposits.id, id))
      .returning();
    return result[0];
  }

  async getAllDeposits(): Promise<Deposit[]> {
    return await this.db.select().from(deposits).orderBy(desc(deposits.createdAt));
  }

  async getWithdrawal(id: string): Promise<Withdrawal | undefined> {
    const result = await this.db.select().from(withdrawals).where(eq(withdrawals.id, id)).limit(1);
    return result[0];
  }

  async getWithdrawalsByUser(userId: string): Promise<Withdrawal[]> {
    return await this.db.select().from(withdrawals)
      .where(eq(withdrawals.userId, userId))
      .orderBy(desc(withdrawals.createdAt));
  }

  async createWithdrawal(insertWithdrawal: InsertWithdrawal): Promise<Withdrawal> {
    const id = randomUUID();
    const result = await this.db.insert(withdrawals).values({
      id,
      userId: insertWithdrawal.userId,
      amount: insertWithdrawal.amount,
      address: insertWithdrawal.address,
      method: insertWithdrawal.method,
      status: insertWithdrawal.status ?? "pending",
      fee: insertWithdrawal.fee ?? "1.00",
      notes: insertWithdrawal.notes ?? null,
      processedAt: null,
      transactionHash: null,
    }).returning();
    return result[0];
  }

  async updateWithdrawalStatus(
    id: string,
    status: string,
    processedAt?: Date,
    transactionHash?: string,
    notes?: string
  ): Promise<Withdrawal | undefined> {
    const result = await this.db.update(withdrawals)
      .set({
        status,
        ...(processedAt && { processedAt }),
        ...(transactionHash && { transactionHash }),
        ...(notes && { notes }),
      })
      .where(eq(withdrawals.id, id))
      .returning();
    return result[0];
  }

  async getAllWithdrawals(): Promise<Withdrawal[]> {
    return await this.db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt));
  }

  async getSettings(): Promise<Settings> {
    const result = await this.db.select().from(settingsTable).limit(1);
    if (result.length === 0) {
      const newSettings = await this.db.insert(settingsTable).values({
        id: "default",
        winRate: "20.00",
        usdtTrc20Address: null,
        usdtErc20Address: null,
        usdtBep20Address: null,
      }).returning();
      return newSettings[0];
    }
    return result[0];
  }

  async updateSettings(updateData: UpdateSettings): Promise<Settings> {
    const result = await this.db.update(settingsTable)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(settingsTable.id, "default"))
      .returning();
    return result[0];
  }
}

export const storage = new DbStorage();
