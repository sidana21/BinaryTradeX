import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  demoBalance: decimal("demo_balance", { precision: 10, scale: 2 }).default("10000.00"),
  realBalance: decimal("real_balance", { precision: 10, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assets = pgTable("assets", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  category: text("category").notNull(), // 'forex', 'crypto', 'commodity', 'index'
  currentPrice: decimal("current_price", { precision: 12, scale: 6 }).notNull(),
  priceChange: decimal("price_change", { precision: 8, scale: 4 }).default("0.0000"),
  priceChangePercent: decimal("price_change_percent", { precision: 6, scale: 2 }).default("0.00"),
  isActive: boolean("is_active").default(true),
  payoutRate: decimal("payout_rate", { precision: 4, scale: 2 }).default("82.00"), // 82%
});

export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  assetId: varchar("asset_id").notNull().references(() => assets.id),
  type: text("type").notNull(), // 'CALL', 'PUT'
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  openPrice: decimal("open_price", { precision: 12, scale: 6 }).notNull(),
  closePrice: decimal("close_price", { precision: 12, scale: 6 }),
  expiryTime: timestamp("expiry_time").notNull(),
  status: text("status").default("open"), // 'open', 'won', 'lost'
  payout: decimal("payout", { precision: 10, scale: 2 }),
  isDemo: boolean("is_demo").default(true),
  shouldWin: boolean("should_win").default(false), // Pre-determined outcome (20% win rate)
  createdAt: timestamp("created_at").defaultNow(),
});

export const priceData = pgTable("price_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id),
  timestamp: timestamp("timestamp").notNull(),
  open: decimal("open", { precision: 12, scale: 6 }).notNull(),
  high: decimal("high", { precision: 12, scale: 6 }).notNull(),
  low: decimal("low", { precision: 12, scale: 6 }).notNull(),
  close: decimal("close", { precision: 12, scale: 6 }).notNull(),
  volume: decimal("volume", { precision: 15, scale: 2 }).default("0.00"),
});

export const deposits = pgTable("deposits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: text("method").notNull(), // 'usdt_trc20', 'usdt_erc20', 'usdt_bep20'
  status: text("status").default("pending"), // 'pending', 'completed', 'failed', 'cancelled'
  transactionHash: text("transaction_hash"),
  walletAddress: text("wallet_address"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertAssetSchema = createInsertSchema(assets);

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  createdAt: true,
  closePrice: true,
  payout: true,
  status: true,
});

export const insertPriceDataSchema = createInsertSchema(priceData).omit({
  id: true,
});

export const insertDepositSchema = createInsertSchema(deposits).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;
export type InsertPriceData = z.infer<typeof insertPriceDataSchema>;
export type PriceData = typeof priceData.$inferSelect;
export type InsertDeposit = z.infer<typeof insertDepositSchema>;
export type Deposit = typeof deposits.$inferSelect;
