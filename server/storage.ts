import { type User, type InsertUser, type Asset, type InsertAsset, type Trade, type InsertTrade, type PriceData, type InsertPriceData } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: string, demoBalance: string, realBalance: string): Promise<User | undefined>;

  // Assets
  getAllAssets(): Promise<Asset[]>;
  getAsset(id: string): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAssetPrice(id: string, price: string, change: string, changePercent: string): Promise<Asset | undefined>;

  // Trades
  getTradesByUser(userId: string): Promise<Trade[]>;
  getOpenTradesByUser(userId: string): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: string, closePrice: string, status: string, payout: string): Promise<Trade | undefined>;

  // Price Data
  getPriceData(assetId: string, limit?: number): Promise<PriceData[]>;
  addPriceData(priceData: InsertPriceData): Promise<PriceData>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private assets: Map<string, Asset>;
  private trades: Map<string, Trade>;
  private priceData: Map<string, PriceData>;

  constructor() {
    this.users = new Map();
    this.assets = new Map();
    this.trades = new Map();
    this.priceData = new Map();
    this.initializeAssets();
  }

  private initializeAssets() {
    const defaultAssets: InsertAsset[] = [
      // Major Forex Pairs
      { id: "EURUSD", name: "EUR/USD", symbol: "EUR/USD", category: "forex", currentPrice: "1.0856", priceChange: "0.0023", priceChangePercent: "0.23", isActive: true, payoutRate: "85.00" },
      { id: "GBPUSD", name: "GBP/USD", symbol: "GBP/USD", category: "forex", currentPrice: "1.2678", priceChange: "-0.0057", priceChangePercent: "-0.45", isActive: true, payoutRate: "84.00" },
      { id: "USDJPY", name: "USD/JPY", symbol: "USD/JPY", category: "forex", currentPrice: "149.85", priceChange: "0.83", priceChangePercent: "0.56", isActive: true, payoutRate: "83.00" },
      { id: "AUDUSD", name: "AUD/USD", symbol: "AUD/USD", category: "forex", currentPrice: "0.6550", priceChange: "0.0012", priceChangePercent: "0.18", isActive: true, payoutRate: "82.00" },
      { id: "USDCAD", name: "USD/CAD", symbol: "USD/CAD", category: "forex", currentPrice: "1.3550", priceChange: "-0.0025", priceChangePercent: "-0.18", isActive: true, payoutRate: "82.00" },
      { id: "USDCHF", name: "USD/CHF", symbol: "USD/CHF", category: "forex", currentPrice: "0.8845", priceChange: "0.0015", priceChangePercent: "0.17", isActive: true, payoutRate: "81.00" },
      { id: "NZDUSD", name: "NZD/USD", symbol: "NZD/USD", category: "forex", currentPrice: "0.6125", priceChange: "0.0008", priceChangePercent: "0.13", isActive: true, payoutRate: "81.00" },
      
      // Cross Pairs
      { id: "EURJPY", name: "EUR/JPY", symbol: "EUR/JPY", category: "forex", currentPrice: "162.45", priceChange: "0.52", priceChangePercent: "0.32", isActive: true, payoutRate: "83.00" },
      { id: "EURGBP", name: "EUR/GBP", symbol: "EUR/GBP", category: "forex", currentPrice: "0.8565", priceChange: "-0.0015", priceChangePercent: "-0.18", isActive: true, payoutRate: "82.00" },
      { id: "EURAUD", name: "EUR/AUD", symbol: "EUR/AUD", category: "forex", currentPrice: "1.6580", priceChange: "0.0045", priceChangePercent: "0.27", isActive: true, payoutRate: "81.00" },
      { id: "EURCHF", name: "EUR/CHF", symbol: "EUR/CHF", category: "forex", currentPrice: "0.9605", priceChange: "0.0012", priceChangePercent: "0.13", isActive: true, payoutRate: "81.00" },
      { id: "GBPJPY", name: "GBP/JPY", symbol: "GBP/JPY", category: "forex", currentPrice: "189.95", priceChange: "1.25", priceChangePercent: "0.66", isActive: true, payoutRate: "82.00" },
      { id: "AUDCAD", name: "AUD/CAD", symbol: "AUD/CAD", category: "forex", currentPrice: "0.8875", priceChange: "0.0018", priceChangePercent: "0.20", isActive: true, payoutRate: "80.00" },
      { id: "AUDJPY", name: "AUD/JPY", symbol: "AUD/JPY", category: "forex", currentPrice: "98.15", priceChange: "0.45", priceChangePercent: "0.46", isActive: true, payoutRate: "81.00" },
      { id: "CHFJPY", name: "CHF/JPY", symbol: "CHF/JPY", category: "forex", currentPrice: "169.35", priceChange: "0.85", priceChangePercent: "0.50", isActive: true, payoutRate: "80.00" },
      { id: "CADJPY", name: "CAD/JPY", symbol: "CAD/JPY", category: "forex", currentPrice: "110.65", priceChange: "0.35", priceChangePercent: "0.32", isActive: true, payoutRate: "80.00" },
      { id: "NZDJPY", name: "NZD/JPY", symbol: "NZD/JPY", category: "forex", currentPrice: "91.75", priceChange: "0.28", priceChangePercent: "0.31", isActive: true, payoutRate: "80.00" },
      
      // OTC Forex Pairs
      { id: "EURCAD_OTC", name: "EUR/CAD (OTC)", symbol: "EUR/CAD", category: "forex", currentPrice: "1.4725", priceChange: "0.0035", priceChangePercent: "0.24", isActive: true, payoutRate: "82.00" },
      { id: "USDJPY_OTC", name: "USD/JPY (OTC)", symbol: "USD/JPY", category: "forex", currentPrice: "149.85", priceChange: "0.83", priceChangePercent: "0.56", isActive: true, payoutRate: "82.00" },
      { id: "GBPUSD_OTC", name: "GBP/USD (OTC)", symbol: "GBP/USD", category: "forex", currentPrice: "1.2678", priceChange: "-0.0057", priceChangePercent: "-0.45", isActive: true, payoutRate: "82.00" },
      { id: "EURUSD_OTC", name: "EUR/USD (OTC)", symbol: "EUR/USD", category: "forex", currentPrice: "1.0856", priceChange: "0.0023", priceChangePercent: "0.23", isActive: true, payoutRate: "82.00" },
      { id: "AUDCAD_OTC", name: "AUD/CAD (OTC)", symbol: "AUD/CAD", category: "forex", currentPrice: "0.8875", priceChange: "0.0018", priceChangePercent: "0.20", isActive: true, payoutRate: "81.00" },
      { id: "GBPJPY_OTC", name: "GBP/JPY (OTC)", symbol: "GBP/JPY", category: "forex", currentPrice: "189.95", priceChange: "1.25", priceChangePercent: "0.66", isActive: true, payoutRate: "81.00" },
      
      // Cryptocurrencies
      { id: "BTCUSD", name: "Bitcoin", symbol: "BTC/USD", category: "crypto", currentPrice: "43256.50", priceChange: "915.30", priceChangePercent: "2.15", isActive: true, payoutRate: "88.00" },
      { id: "ETHUSD", name: "Ethereum", symbol: "ETH/USD", category: "crypto", currentPrice: "2287.80", priceChange: "-25.90", priceChangePercent: "-1.12", isActive: true, payoutRate: "87.00" },
      { id: "LTCUSD", name: "Litecoin", symbol: "LTC/USD", category: "crypto", currentPrice: "72.45", priceChange: "1.85", priceChangePercent: "2.62", isActive: true, payoutRate: "85.00" },
      { id: "XRPUSD", name: "Ripple", symbol: "XRP/USD", category: "crypto", currentPrice: "0.5245", priceChange: "0.0125", priceChangePercent: "2.44", isActive: true, payoutRate: "85.00" },
      
      // Commodities
      { id: "GOLD", name: "الذهب", symbol: "XAU/USD", category: "commodity", currentPrice: "2045.30", priceChange: "17.85", priceChangePercent: "0.87", isActive: true, payoutRate: "83.00" },
      { id: "SILVER", name: "الفضة", symbol: "XAG/USD", category: "commodity", currentPrice: "24.65", priceChange: "0.35", priceChangePercent: "1.44", isActive: true, payoutRate: "82.00" },
      { id: "OIL", name: "النفط", symbol: "WTI", category: "commodity", currentPrice: "78.45", priceChange: "0.95", priceChangePercent: "1.23", isActive: true, payoutRate: "81.00" },
      
      // Indices
      { id: "SPX", name: "S&P 500", symbol: "SPX", category: "index", currentPrice: "4567.20", priceChange: "41.75", priceChangePercent: "0.92", isActive: true, payoutRate: "80.00" },
      { id: "NDX", name: "NASDAQ 100", symbol: "NDX", category: "index", currentPrice: "15892.50", priceChange: "125.30", priceChangePercent: "0.80", isActive: true, payoutRate: "79.00" },
      { id: "DJI", name: "Dow Jones", symbol: "DJI", category: "index", currentPrice: "36789.45", priceChange: "215.80", priceChangePercent: "0.59", isActive: true, payoutRate: "79.00" },
      { id: "DAX", name: "DAX 40", symbol: "DAX", category: "index", currentPrice: "16245.75", priceChange: "95.50", priceChangePercent: "0.59", isActive: true, payoutRate: "78.00" },
      { id: "CAC40", name: "CAC 40", symbol: "CAC40", category: "index", currentPrice: "7456.30", priceChange: "52.15", priceChangePercent: "0.70", isActive: true, payoutRate: "78.00" },
      
      // OTC Indices
      { id: "DAX_OTC", name: "DAX/EUR (OTC)", symbol: "DAX/EUR", category: "index", currentPrice: "16245.75", priceChange: "95.50", priceChangePercent: "0.59", isActive: true, payoutRate: "79.00" },
      { id: "NDX_OTC", name: "NDX/USD (OTC)", symbol: "NDX/USD", category: "index", currentPrice: "15892.50", priceChange: "125.30", priceChangePercent: "0.80", isActive: true, payoutRate: "79.00" },
      { id: "DJI_OTC", name: "DJI/USD (OTC)", symbol: "DJI/USD", category: "index", currentPrice: "36789.45", priceChange: "215.80", priceChangePercent: "0.59", isActive: true, payoutRate: "79.00" },
      { id: "SPX_OTC", name: "SPX/USD (OTC)", symbol: "SPX/USD", category: "index", currentPrice: "4567.20", priceChange: "41.75", priceChangePercent: "0.92", isActive: true, payoutRate: "79.00" }
    ];

    defaultAssets.forEach(asset => {
      this.assets.set(asset.id, asset as Asset);
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      demoBalance: "10000.00",
      realBalance: "0.00",
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserBalance(userId: string, demoBalance: string, realBalance: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (user) {
      user.demoBalance = demoBalance;
      user.realBalance = realBalance;
      this.users.set(userId, user);
    }
    return user;
  }

  // Assets
  async getAllAssets(): Promise<Asset[]> {
    return Array.from(this.assets.values());
  }

  async getAsset(id: string): Promise<Asset | undefined> {
    return this.assets.get(id);
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const newAsset: Asset = asset as Asset;
    this.assets.set(asset.id, newAsset);
    return newAsset;
  }

  async updateAssetPrice(id: string, price: string, change: string, changePercent: string): Promise<Asset | undefined> {
    const asset = this.assets.get(id);
    if (asset) {
      asset.currentPrice = price;
      asset.priceChange = change;
      asset.priceChangePercent = changePercent;
      this.assets.set(id, asset);
    }
    return asset;
  }

  // Trades
  async getTradesByUser(userId: string): Promise<Trade[]> {
    return Array.from(this.trades.values()).filter(trade => trade.userId === userId);
  }

  async getOpenTradesByUser(userId: string): Promise<Trade[]> {
    return Array.from(this.trades.values()).filter(
      trade => trade.userId === userId && trade.status === "open"
    );
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const id = randomUUID();
    const newTrade: Trade = {
      ...trade,
      id,
      closePrice: null,
      status: "open",
      payout: null,
      isDemo: trade.isDemo ?? true,
      createdAt: new Date()
    };
    this.trades.set(id, newTrade);
    return newTrade;
  }

  async updateTrade(id: string, closePrice: string, status: string, payout: string): Promise<Trade | undefined> {
    const trade = this.trades.get(id);
    if (trade) {
      trade.closePrice = closePrice;
      trade.status = status;
      trade.payout = payout;
      this.trades.set(id, trade);
    }
    return trade;
  }

  // Price Data
  async getPriceData(assetId: string, limit: number = 100): Promise<PriceData[]> {
    return Array.from(this.priceData.values())
      .filter(pd => pd.assetId === assetId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async addPriceData(priceData: InsertPriceData): Promise<PriceData> {
    const id = randomUUID();
    const newPriceData: PriceData = {
      ...priceData,
      id,
      volume: priceData.volume ?? "0.00"
    };
    this.priceData.set(id, newPriceData);
    return newPriceData;
  }
}

export const storage = new MemStorage();
