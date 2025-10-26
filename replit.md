# Trading Platform

## Overview

This project is a binary options trading platform featuring a React frontend and an Express backend. It enables users to trade various financial assets (forex, crypto, commodities, indices) with real-time price updates via WebSocket. Key capabilities include executing CALL/PUT trades with configurable expiry times, managing demo and real account balances, and tracking trading history. The platform aims to provide a robust, user-friendly trading experience, positioned for market entry in the online trading sector.

## Recent Updates (Oct 26, 2025)

- **Guest Account Restrictions**: Implemented security controls for guest users
  - **Real Account Lock**: Guests cannot access real account balance or switch to real account mode
  - **Login Dialog**: When guests attempt to switch to real account, a dialog appears prompting them to login/signup
  - **Demo-Only Trading**: Guest users are automatically kept in demo account mode
  - **Balance Protection**: Real balance is not displayed or accessible to unauthenticated users
  - **Seamless UX**: Registered users can freely switch between demo and real accounts
  - **Security First**: Prevents unauthorized access to real money trading features

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React and TypeScript, using Vite for building. It employs React Router for navigation and TanStack Query for server state management. UI components are built with Shadcn/ui (based on Radix UI) and styled with Tailwind CSS, featuring a dark mode and custom CSS variables for theming. State management combines TanStack Query for server data with local React hooks for UI state. Key trading interface components include a canvas-based chart (`TradingChart`), an `AssetList`, a `TradingPanel` for trade execution, and a `TradesPanel` for history.

### Backend Architecture

The backend uses Express.js with TypeScript, providing RESTful APIs and a WebSocket server for real-time data. It utilizes custom middleware for request processing and Zod for payload validation. Data storage is abstracted with an `IStorage` interface, configured for Drizzle ORM with PostgreSQL, though an in-memory storage (`MemStorage`) is used for development. The WebSocket server implements a subscribe/unsubscribe pattern for efficient price update broadcasting. Authentication is handled via Express-session with secure cookie settings, supporting user registration, login, logout, and session-based user data retrieval.

### Database Design

The PostgreSQL database schema, managed by Drizzle ORM, includes:
- **Users**: Stores user credentials (username, email, hashed password), UUID, demo/real balances, and manages a welcome bonus for new registrations.
- **Assets**: Defines tradable assets with unique IDs, categories, price precision, and payout rates.
- **Trades**: Records individual trades with UUIDs, foreign keys to users and assets, trade type (CALL/PUT), amounts, prices, expiry times, and status.
- **Price Data**: Stores time-series OHLCV data for assets, ensuring historical chart persistence.
- **Deposits**: Tracks cryptocurrency deposits (USDT TRC20/ERC20/BEP20) with transaction details and status.
- **Withdrawals**: Manages withdrawal requests with destination addresses, amounts, fees, and status tracking.

### System Design Choices

- **UI/UX**: Professional Arabic UI with dynamic profile pages, mobile-optimized header elements, and Pocket Option-style animated notifications for trade results.
- **Technical Implementations**: Integration of technical analysis tools (MA, EMA, RSI, MACD, Bollinger Bands) and drawing tools (trendlines, Fibonacci) on charts.
- **Feature Specifications**: Complete authentication and registration system, USDT deposit/withdrawal system with QR code generation, real-time chart data persistence via NeonDB, and dynamic trade duration configuration.
- **Branding**: Bok Option branding with professional blue gradient logos and unique gradient asset icons for visual recognition.

## External Dependencies

- **UI Frameworks**: Radix UI, Shadcn/ui, Embla Carousel, Lucide React.
- **Database**: Neon Database (PostgreSQL), Drizzle ORM, Drizzle Kit, Connect-pg-simple.
- **Development Tools**: Replit-specific plugins, TSX, ESBuild, Vite plugins.
- **Form & Validation**: React Hook Form, Zod, Hookform Resolvers, Drizzle-Zod.
- **Utilities**: date-fns, class-variance-authority (CVA), clsx, tailwind-merge, nanoid.