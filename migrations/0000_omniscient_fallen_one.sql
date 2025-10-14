CREATE TABLE "assets" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"category" text NOT NULL,
	"current_price" numeric(12, 6) NOT NULL,
	"price_change" numeric(8, 4) DEFAULT '0.0000',
	"price_change_percent" numeric(6, 2) DEFAULT '0.00',
	"is_active" boolean DEFAULT true,
	"payout_rate" numeric(4, 2) DEFAULT '82.00'
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'pending',
	"transaction_hash" text,
	"wallet_address" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "price_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" varchar NOT NULL,
	"timestamp" timestamp NOT NULL,
	"open" numeric(12, 6) NOT NULL,
	"high" numeric(12, 6) NOT NULL,
	"low" numeric(12, 6) NOT NULL,
	"close" numeric(12, 6) NOT NULL,
	"volume" numeric(15, 2) DEFAULT '0.00'
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" varchar PRIMARY KEY DEFAULT 'default' NOT NULL,
	"win_rate" numeric(5, 2) DEFAULT '20.00',
	"usdt_trc20_address" text,
	"usdt_erc20_address" text,
	"usdt_bep20_address" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"asset_id" varchar NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"open_price" numeric(12, 6) NOT NULL,
	"close_price" numeric(12, 6),
	"expiry_time" timestamp NOT NULL,
	"status" text DEFAULT 'open',
	"payout" numeric(10, 2),
	"is_demo" boolean DEFAULT true,
	"should_win" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"demo_balance" numeric(10, 2) DEFAULT '10000.00',
	"real_balance" numeric(10, 2) DEFAULT '0.00',
	"is_admin" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_data" ADD CONSTRAINT "price_data_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;