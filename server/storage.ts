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
      {
        id: "EURUSD",
        name: "EUR/USD",
        symbol: "EUR/USD",
        category: "forex",
        currentPrice: "1.0856",
        priceChange: "0.0023",
        priceChangePercent: "0.23",
        isActive: true,
        payoutRate: "82.00"
      },
      {
        id: "BTCUSD",
        name: "BTC/USD",
        symbol: "BTC/USD",
        category: "crypto",
        currentPrice: "43256.50",
        priceChange: "915.30",
        priceChangePercent: "2.15",
        isActive: true,
        payoutRate: "85.00"
      },
      {
        id: "GBPUSD",
        name: "GBP/USD",
        symbol: "GBP/USD",
        category: "forex",
        currentPrice: "1.2678",
        priceChange: "-0.0057",
        priceChangePercent: "-0.45",
        isActive: true,
        payoutRate: "80.00"
      },
      {
        id: "GOLD",
        name: "الذهب",
        symbol: "XAU/USD",
        category: "commodity",
        currentPrice: "2045.30",
        priceChange: "17.85",
        priceChangePercent: "0.87",
        isActive: true,
        payoutRate: "78.00"
      },
      {
        id: "OIL",
        name: "النفط",
        symbol: "WTI",
        category: "commodity",
        currentPrice: "78.45",
        priceChange: "0.95",
        priceChangePercent: "1.23",
        isActive: true,
        payoutRate: "75.00"
      },
      {
        id: "ETHUSD",
        name: "ETH/USD",
        symbol: "ETH/USD",
        category: "crypto",
        currentPrice: "2287.80",
        priceChange: "-25.90",
        priceChangePercent: "-1.12",
        isActive: true,
        payoutRate: "84.00"
      },
      {
        id: "USDJPY",
        name: "USD/JPY",
        symbol: "USD/JPY",
        category: "forex",
        currentPrice: "149.85",
        priceChange: "0.83",
        priceChangePercent: "0.56",
        isActive: true,
        payoutRate: "81.00"
      },
      {
        id: "SP500",
        name: "S&P 500",
        symbol: "SPX",
        category: "index",
        currentPrice: "4567.20",
        priceChange: "41.75",
        priceChangePercent: "0.92",
        isActive: true,
        payoutRate: "77.00"
      }
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
