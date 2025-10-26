# Trading Platform

## Overview

This is a binary options trading platform built with a React frontend and Express backend. The application allows users to trade on various financial assets (forex, crypto, commodities, indices) with real-time price updates via WebSocket. Users can execute CALL/PUT trades with configurable expiry times, manage demo and real account balances, and track their trading history.

**Recent Updates (Oct 26, 2025)**:
- **Trade Duration Fix**: Temps selector now correctly changes trade expiration time
  - **Duration Prop**: Trading page now passes selected timeframe (1m/5m/15m) to OtcChart as duration prop
  - **Conversion Function**: Added getTradeDuration() to convert timeframe strings to seconds (60/300/900)
  - **Dynamic Expiry**: Trade exitTime now properly calculated based on selected duration instead of fixed 60 seconds
  - **Visual Countdown Display**: Temps section now shows "1:00", "5:00", or "15:00" based on selection
  - **User Experience**: Changing Temps from 1M to 5M or 15M now correctly adjusts trade duration and displays countdown
- **Pocket Option-Style Notifications**: Fast win/loss notifications with no delay popups
  - **Visual Design**: Green gradient for wins, red for losses, with animated icons (✓/✗)
  - **Auto-Dismiss**: Appears at top center, automatically fades out after 2.5 seconds
  - **Multiple Notifications**: Can display multiple notifications simultaneously
- **USDT Deposit/Withdrawal System**: Complete cryptocurrency payment integration
  - **Deposit Interface**: QR code generation for USDT deposits with TRC20/ERC20/BEP20 network support
  - **Withdrawal Interface**: Secure withdrawal requests with address validation and fee calculation
  - **Database Schema**: Added withdrawals table with status tracking (pending, processing, completed, rejected)
  - **Security Implementation**: Server-side user authentication prevents client-controlled userId attacks
  - **Balance Management**: Immediate deduction on withdrawal request, automatic refund on rejection
  - **API Endpoints**: RESTful endpoints for deposits and withdrawals with Zod validation
  - **Wallet Button**: Integrated wallet access in trading interface header for quick deposit/withdrawal
  - **Authentication Ready**: System prepared for future authentication - uses /api/me endpoint pattern

**Previous Updates (Oct 25, 2025)**:
- **Technical Analysis Tools**: Added comprehensive charting tools for professional trading analysis
  - **Technical Indicators**: MA (20, 50), EMA (12, 26), RSI (14), MACD, Bollinger Bands
  - **Drawing Tools**: Trendlines, Horizontal lines, Vertical lines, Rectangles, Fibonacci retracement
  - **Interactive UI**: Toggle indicators on/off with visual feedback, color-coded indicator lines
  - **Real-time Updates**: Indicators automatically update with new price data
- **Bok Option Branding**: Professional blue gradient layered logo added across all pages
- **Asset Icons**: Each asset now has a unique logo/flag with gradient colors:
  - Forex pairs: Currency symbols with country-specific gradients (e.g., EUR/USD: €/$ blue-yellow)
  - Cryptocurrencies: Crypto symbols with brand colors (BTC: ₿ orange-yellow, ETH: Ξ purple-blue)
  - Commodities: Visual icons (Gold: 🏅 yellow, Oil: 🛢️ black, Natural Gas: 🔥 blue)
  - Indices: Market abbreviations (S&P: blue-red, Nasdaq: blue-purple, Dow: dark blue)
- **UI Enhancement**: Icons appear in asset selector, trading pages, and asset list for better visual recognition
- **Mobile Optimization**: Logo and asset icons responsive across all screen sizes

**Previous Updates (Oct 14, 2025)**:
- **Data Persistence Fixed**: All data now properly persists to NeonDB across page refreshes and server restarts
- **Open Trades Recovery**: Active trades are now loaded from database on server startup, preventing loss on restart
- **Chart Data Persistence**: Fixed issue where candlestick data would reset to zero on page refresh
- **Removed Flask Proxy**: Node.js/Express now runs directly on port 5000 for simpler architecture
- **WebSocket Integration**: Real-time price updates working correctly with proper connection handling
- **Database Status**: 17,708+ price candles stored across 38 assets with full historical data
- **Production Ready**: Configured for deployment on Render with NeonDB persistence
- **Auto User Init**: Demo user automatically created with secure random password

**Previous Updates (Oct 13, 2025)**:
- Successfully migrated from Replit Agent to Replit environment
- Installed all Node.js and Python dependencies for full functionality
- Configured deployment settings for production-ready autoscale deployment
- Added Web Audio API notification system with singleton AudioContext for win/loss trade results
- Fixed balance update logic to properly reflect profits from winning trades

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React with TypeScript for type safety
- Vite as the build tool and development server
- React Router (Wouter) for lightweight client-side routing
- TanStack Query for server state management and caching

**UI Component System**
- Shadcn/ui component library based on Radix UI primitives
- Tailwind CSS for styling with custom design tokens
- Dark mode theme with neutral color palette
- Custom CSS variables for theming consistency

**State Management Strategy**
- TanStack Query for server state (assets, trades, price data)
- Local React hooks for UI state (selected asset, timeframe, trade amount)
- WebSocket integration for real-time price updates
- Custom hooks pattern (`use-trading`, `use-websocket`) to encapsulate business logic

**Trading Interface Components**
- `TradingChart`: Canvas-based chart visualization for asset prices
- `AssetList`: Categorized list with search and filtering capabilities
- `TradingPanel`: Trade execution interface with amount controls
- `TradesPanel`: Displays open positions and trade history

### Backend Architecture

**Server Framework**
- Express.js with TypeScript for type-safe API development
- HTTP server with WebSocket upgrade for real-time communication
- Custom middleware for request logging and JSON parsing with raw body preservation

**API Design Pattern**
- RESTful endpoints for CRUD operations on assets and trades
- Resource-based URL structure (`/api/assets`, `/api/trades`)
- Zod schema validation for request payloads
- Consistent error handling with appropriate HTTP status codes

**Data Storage Strategy**
- In-memory storage implementation (`MemStorage`) for development
- Interface-based storage abstraction (`IStorage`) for easy database migration
- Drizzle ORM configured for PostgreSQL with schema-first approach
- Schema defined in shared module for type consistency between client and server

**Real-time Communication**
- WebSocket server for broadcasting price updates
- Subscribe/unsubscribe pattern for client connections
- Automatic reconnection logic on the client side
- JSON message protocol for structured communication

### Database Design

**Schema Structure** (PostgreSQL via Drizzle ORM)

**Users Table**
- UUID primary key with auto-generation
- Unique username constraint for authentication
- Separate demo and real balance tracking (decimal precision for currency)
- Password storage (hashed in production implementation)

**Assets Table**
- String-based primary key (e.g., "EURUSD", "BTCUSD")
- Category classification (forex, crypto, commodity, index)
- High-precision decimal fields for price data (12 digits, 6 decimal places)
- Active/inactive flag for asset availability
- Configurable payout rate per asset

**Trades Table**
- UUID primary key with auto-generation
- Foreign key relationships to users and assets
- Type field for CALL/PUT classification
- Decimal precision for monetary values (amount, prices, payout)
- Expiry time tracking for binary options
- Status tracking (open, won, lost)
- Demo/real account flag

**Price Data Table**
- Time-series structure with timestamp
- OHLCV (Open, High, Low, Close, Volume) data points
- Foreign key to assets for historical price tracking
- High precision for financial data accuracy

**Deposits Table**
- UUID primary key with auto-generation
- Foreign key to users for transaction tracking
- Amount, method (TRC20/ERC20/BEP20), and status fields
- Transaction hash and wallet address storage
- Timestamp tracking for created and completed times

**Withdrawals Table**
- UUID primary key with auto-generation
- Foreign key to users for transaction tracking
- Destination address, amount, and withdrawal fee fields
- Status tracking (pending, processing, completed, rejected)
- Transaction hash for blockchain verification
- Admin notes field for rejection reasons
- Timestamp tracking for created and processed times

### External Dependencies

**UI Framework & Components**
- Radix UI primitives for accessible component foundations
- Shadcn/ui as the component system built on Radix
- Embla Carousel for interactive carousels
- Lucide React for consistent iconography

**Database & ORM**
- Neon Database serverless PostgreSQL driver
- Drizzle ORM for type-safe database queries
- Drizzle Kit for schema migrations
- Connect-pg-simple for PostgreSQL session storage

**Development Tools**
- Replit-specific plugins for development experience
- TSX for running TypeScript directly in development
- ESBuild for production bundling
- Vite plugins for runtime error overlay and development banners

**Form & Validation**
- React Hook Form for performant form handling
- Zod for runtime type validation
- Hookform Resolvers for Zod integration
- Drizzle-Zod for generating Zod schemas from database schema

**Utilities**
- date-fns for date manipulation
- class-variance-authority (CVA) for variant-based styling
- clsx and tailwind-merge for conditional class names
- nanoid for unique ID generation

**Note on Database Configuration**
The application is configured to use PostgreSQL through Drizzle ORM and Neon's serverless driver. While the in-memory storage is currently used for development, the schema and configuration are ready for PostgreSQL deployment. The `DATABASE_URL` environment variable must be set for database connectivity.