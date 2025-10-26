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
  isAdmin: boolean("is_admin").default(false),
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

export const withdrawals = pgTable("withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  address: text("address").notNull(), // Destination wallet address
  method: text("method").notNull(), // 'USDT_TRC20', 'USDT_ERC20', 'USDT_BEP20'
  status: text("status").default("pending"), // 'pending', 'processing', 'completed', 'rejected'
  transactionHash: text("transaction_hash"),
  fee: decimal("fee", { precision: 10, scale: 2 }).default("1.00"), // Withdrawal fee
  notes: text("notes"), // Admin notes for rejection reasons
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default("default"),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }).default("20.00"), // Win rate percentage (e.g., 20.00 = 20%)
  usdtTrc20Address: text("usdt_trc20_address"),
  usdtErc20Address: text("usdt_erc20_address"),
  usdtBep20Address: text("usdt_bep20_address"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertAssetSchema = createInsertSchema(assets);

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  closePrice: true,
  payout: true,
  status: true,
}).extend({
  createdAt: z.coerce.date().optional(), // السماح بإرسال createdAt من المتصفح
});

export const insertPriceDataSchema = createInsertSchema(priceData).omit({
  id: true,
});

export const insertDepositSchema = createInsertSchema(deposits).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({
  id: true,
  createdAt: true,
  processedAt: true,
  transactionHash: true,
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  updatedAt: true,
});

export const updateSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
}).partial();

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
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
