import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Asset, Trade } from '@shared/schema';

interface TradingChartProps {
  asset: Asset | null;
  timeframe: string;
  onTimeframeChange: (timeframe: string) => void;
  openTrades?: Trade[];
  tradeHistory?: Trade[];
}

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradeMarker {
  price: number;
  timestamp: number;
  type: 'entry' | 'exit';
  tradeType: 'CALL' | 'PUT';
  status?: 'won' | 'lost' | 'open';
  tradeId: string;
}

export function TradingChart({ asset, timeframe, onTimeframeChange, openTrades = [], tradeHistory = [] }: TradingChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [markers, setMarkers] = useState<TradeMarker[]>([]);
  const [timerTick, setTimerTick] = useState(0);
  const lastUpdateTimeRef = useRef<number>(0);
  const priceUpdateRef = useRef<number>(0);

  // Fetch candle data from API
  const { data: candleData, isLoading } = useQuery<Candle[]>({
    queryKey: [`/api/binomo/candles/${asset?.id}/${timeframe}`],
    enabled: !!asset,
  });

  // Update candles when new data is fetched
  useEffect(() => {
    if (candleData) {
      setCandles(candleData);
    }
  }, [candleData]);

  // Process trades into markers
  useEffect(() => {
    if (!asset) return;
    
    const newMarkers: TradeMarker[] = [];
    
    // Process all trades for current asset
    const allTrades = [...openTrades, ...tradeHistory].filter(trade => trade.assetId === asset.id);
    
    allTrades.forEach(trade => {
      // Entry marker
      newMarkers.push({
        price: parseFloat(trade.openPrice),
        timestamp: new Date(trade.createdAt || Date.now()).getTime(),
        type: 'entry',
        tradeType: trade.type as 'CALL' | 'PUT',
        status: trade.status as 'won' | 'lost' | 'open',
        tradeId: trade.id
      });
      
      // Exit marker (only if trade is closed)
      if (trade.closePrice && trade.status !== 'open') {
        newMarkers.push({
          price: parseFloat(trade.closePrice),
          timestamp: new Date(trade.expiryTime).getTime(),
          type: 'exit',
          tradeType: trade.type as 'CALL' | 'PUT',
          status: trade.status as 'won' | 'lost' | 'open',
          tradeId: trade.id
        });
      }
    });
    
    setMarkers(newMarkers);
  }, [asset, openTrades, tradeHistory]);

  // Update last candle with current price (throttled to 10000ms for smoother updates)
  useEffect(() => {
    if (!asset) return;

    // Reset on asset/timeframe change
    lastUpdateTimeRef.current = 0;
    priceUpdateRef.current = parseFloat(asset.currentPrice);
    
    const updateInterval = setInterval(() => {
      const currentTime = Date.now();
      const timeSinceLastUpdate = currentTime - lastUpdateTimeRef.current;
      
      // Only update if at least 10000ms (10 seconds) have passed
      if (timeSinceLastUpdate < 10000) {
        return;
      }

      lastUpdateTimeRef.current = currentTime;
      const currentPrice = priceUpdateRef.current;
      
      setCandles(prevCandles => {
        if (prevCandles.length === 0) return prevCandles;
        const updatedCandles = [...prevCandles];
        const lastCandle = updatedCandles[updatedCandles.length - 1];
        
        // Update the last candle's close price and adjust high/low if needed
        lastCandle.close = currentPrice;
        lastCandle.high = Math.max(lastCandle.high, currentPrice);
        lastCandle.low = Math.min(lastCandle.low, currentPrice);
        
        return updatedCandles;
      });
    }, 2000); // Check every 2 seconds but only update every 10 seconds

    return () => clearInterval(updateInterval);
  }, [asset?.id, timeframe, candles.length]);

  // Update price ref when asset price changes
  useEffect(() => {
    if (asset) {
      priceUpdateRef.current = parseFloat(asset.currentPrice);
    }
  }, [asset?.currentPrice]);

  // Update countdown timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      if (openTrades.length > 0) {
        setTimerTick(prev => prev + 1);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [openTrades.length]);

  // Draw the chart
  useEffect(() => {
    if (!canvasRef.current || !asset || candles.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas with professional dark background (Pocket Option style)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, 'hsl(220, 30%, 8%)');
    bgGradient.addColorStop(1, 'hsl(220, 30%, 12%)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate price range including marker prices
    const prices = candles.flatMap(c => [c.high, c.low]);
    const markerPrices = markers.map(m => m.price);
    const allPrices = [...prices, ...markerPrices].filter(p => !isNaN(p) && isFinite(p));
    const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 100;
    const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
    const priceRange = maxPrice - minPrice || 1;
    const padding = priceRange * 0.08;

    // Calculate candle dimensions
    const leftMargin = 80;
    const rightMargin = 20;
    const topMargin = 20;
    const bottomMargin = 30;
    const chartWidth = canvas.width - leftMargin - rightMargin;
    const chartHeight = canvas.height - topMargin - bottomMargin;
    
    const visibleCandles = Math.min(candles.length, 80);
    const candleWidth = Math.max(4, chartWidth / visibleCandles - 3);
    const candleSpacing = chartWidth / visibleCandles;
    const startIndex = Math.max(0, candles.length - visibleCandles);

    // Scale price to canvas Y coordinate
    const scalePrice = (price: number) => {
      return topMargin + chartHeight - ((price - (minPrice - padding)) / (priceRange + padding * 2)) * chartHeight;
    };

    // Scale timestamp to X coordinate
    const scaleTime = (timestamp: number) => {
      if (candles.length === 0) return leftMargin;
      const firstCandle = candles[startIndex];
      const lastCandle = candles[candles.length - 1];
      const timeRange = lastCandle.timestamp - firstCandle.timestamp;
      if (timeRange === 0) return leftMargin;
      const position = (timestamp - firstCandle.timestamp) / timeRange;
      return leftMargin + position * chartWidth;
    };

    // Draw price labels on Y-axis with Pocket Option style
    ctx.fillStyle = 'hsl(0, 0%, 70%)';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    const priceSteps = 8;
    for (let i = 0; i <= priceSteps; i++) {
      const price = minPrice - padding + (priceRange + padding * 2) * (i / priceSteps);
      const y = scalePrice(price);
      
      // Price label background
      const labelText = price.toFixed(asset.category === 'crypto' ? 2 : 5);
      const labelWidth = ctx.measureText(labelText).width;
      ctx.fillStyle = 'hsla(220, 30%, 15%, 0.8)';
      ctx.fillRect(leftMargin - labelWidth - 18, y - 9, labelWidth + 8, 18);
      
      // Price label text
      ctx.fillStyle = 'hsl(0, 0%, 75%)';
      ctx.fillText(labelText, leftMargin - 10, y + 4);
      
      // Draw horizontal grid line with better visibility
      if (i > 0 && i < priceSteps) {
        ctx.strokeStyle = 'hsla(220, 20%, 25%, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(leftMargin, y);
        ctx.lineTo(canvas.width - rightMargin, y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // Draw professional candlesticks (Enhanced Pocket Option style)
    candles.slice(startIndex).forEach((candle, i) => {
      const x = leftMargin + i * candleSpacing + candleSpacing / 2;
      const isGreen = candle.close >= candle.open;
      
      const openY = scalePrice(candle.open);
      const closeY = scalePrice(candle.close);
      const highY = scalePrice(candle.high);
      const lowY = scalePrice(candle.low);
      
      const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
      const bodyY = Math.min(openY, closeY);
      
      // Dark green and red color scheme
      const greenColor = 'hsl(120, 60%, 35%)';
      const greenDark = 'hsl(120, 60%, 25%)';
      const redColor = 'hsl(0, 80%, 55%)';
      const redDark = 'hsl(0, 80%, 45%)';
      
      // Draw wick with professional style
      ctx.strokeStyle = isGreen ? 'hsl(120, 60%, 30%)' : 'hsl(0, 80%, 50%)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();
      
      // Enhanced glow effect for professional depth
      ctx.shadowColor = isGreen ? 'rgba(34, 139, 34, 0.4)' : 'rgba(220, 38, 38, 0.4)';
      ctx.shadowBlur = 6;
      
      // Draw body with professional gradient
      const gradient = ctx.createLinearGradient(x - candleWidth/2, bodyY, x + candleWidth/2, bodyY + bodyHeight);
      if (isGreen) {
        gradient.addColorStop(0, greenColor);
        gradient.addColorStop(0.3, 'hsl(120, 60%, 32%)');
        gradient.addColorStop(0.7, 'hsl(120, 60%, 28%)');
        gradient.addColorStop(1, greenDark);
      } else {
        gradient.addColorStop(0, redColor);
        gradient.addColorStop(0.3, 'hsl(0, 80%, 53%)');
        gradient.addColorStop(0.7, 'hsl(0, 80%, 50%)');
        gradient.addColorStop(1, redDark);
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(x - candleWidth/2, bodyY, candleWidth, bodyHeight);
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      
      // Add professional border with enhanced visibility
      ctx.strokeStyle = isGreen ? greenDark : redDark;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x - candleWidth/2, bodyY, candleWidth, bodyHeight);
      
      // Add subtle highlight on top of candle for 3D effect
      const highlightGradient = ctx.createLinearGradient(x - candleWidth/2, bodyY, x - candleWidth/2, bodyY + 3);
      highlightGradient.addColorStop(0, isGreen ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.15)');
      highlightGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = highlightGradient;
      ctx.fillRect(x - candleWidth/2, bodyY, candleWidth, Math.min(3, bodyHeight));
    });

    // Draw trade markers and connection lines
    const tradeConnections = new Map<string, { entry: TradeMarker, exit?: TradeMarker }>();
    
    // Filter markers to visible time range
    const firstCandle = candles[startIndex];
    const lastCandle = candles[candles.length - 1];
    const visibleMarkers = markers.filter(marker => {
      return marker.timestamp >= firstCandle.timestamp && marker.timestamp <= lastCandle.timestamp;
    });
    
    visibleMarkers.forEach(marker => {
      if (marker.type === 'entry') {
        tradeConnections.set(marker.tradeId, { entry: marker });
      } else {
        const conn = tradeConnections.get(marker.tradeId);
        if (conn) {
          conn.exit = marker;
        }
      }
    });

    // Draw vertical lines for entry and exit points
    tradeConnections.forEach((conn) => {
      // Find the closest candle to the entry timestamp
      const visibleCandles = candles.slice(startIndex);
      let entryCandle: Candle | undefined = undefined;
      let minEntryDiff = Infinity;
      
      for (const candle of visibleCandles) {
        const diff = Math.abs(candle.timestamp - conn.entry.timestamp);
        if (diff < minEntryDiff) {
          minEntryDiff = diff;
          entryCandle = candle;
        }
      }
      
      if (!entryCandle) return;
      
      const entryX = scaleTime(entryCandle.timestamp);
      
      // Determine color based on trade status
      let color = 'hsl(217, 91%, 60%)'; // Blue for open trades
      if (conn.exit) {
        color = conn.exit.status === 'won' ? 'hsl(142, 76%, 50%)' : 'hsl(0, 84%, 60%)';
      }
      
      // Check if entry is within visible range
      if (entryX >= leftMargin && entryX <= canvas.width - rightMargin) {
        // Draw vertical line at entry point
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(entryX, topMargin);
        ctx.lineTo(entryX, canvas.height - bottomMargin);
        ctx.stroke();
      }
      
      // Draw vertical line at exit point if trade is closed
      if (conn.exit) {
        // Find the closest candle to the exit timestamp
        let exitCandle: Candle | undefined = undefined;
        let minExitDiff = Infinity;
        
        for (const candle of visibleCandles) {
          const diff = Math.abs(candle.timestamp - conn.exit!.timestamp);
          if (diff < minExitDiff) {
            minExitDiff = diff;
            exitCandle = candle;
          }
        }
        
        if (exitCandle) {
          const exitX = scaleTime(exitCandle.timestamp);
          
          // Check if exit is within visible range
          if (exitX >= leftMargin && exitX <= canvas.width - rightMargin) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(exitX, topMargin);
            ctx.lineTo(exitX, canvas.height - bottomMargin);
            ctx.stroke();
          }
          
          // Draw connection line between entry and exit if both in range
          if (entryX >= leftMargin - 100 && exitX <= canvas.width - rightMargin + 100) {
            const entryY = scalePrice(conn.entry.price);
            const exitY = scalePrice(conn.exit.price);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 5]);
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.moveTo(Math.max(entryX, leftMargin), entryY);
            ctx.lineTo(Math.min(exitX, canvas.width - rightMargin), exitY);
            ctx.stroke();
          }
        }
      }
      
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    });

    // Draw markers on candles
    visibleMarkers.forEach(marker => {
      // Find the closest candle to this marker
      let closestCandleIndex = -1;
      let minTimeDiff = Infinity;
      
      candles.slice(startIndex).forEach((candle, i) => {
        const timeDiff = Math.abs(candle.timestamp - marker.timestamp);
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          closestCandleIndex = i;
        }
      });
      
      if (closestCandleIndex === -1) return;
      
      // Get candle position
      const x = leftMargin + closestCandleIndex * candleSpacing + candleSpacing / 2;
      const candle = candles[startIndex + closestCandleIndex];
      const y = scalePrice(marker.price);
      
      if (marker.type === 'entry') {
        // Entry marker - arrow below the candle
        const color = marker.tradeType === 'CALL' ? 'hsl(142, 76%, 50%)' : 'hsl(0, 84%, 60%)';
        const arrowY = marker.tradeType === 'CALL' ? y + 20 : y - 20;
        
        // Draw shadow for depth
        ctx.shadowColor = marker.tradeType === 'CALL' ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)';
        ctx.shadowBlur = 10;
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, arrowY, 10, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        
        // Arrow inside circle
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(marker.tradeType === 'CALL' ? '↑' : '↓', x, arrowY);
        
        // Draw line from arrow to price
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(x, arrowY + (marker.tradeType === 'CALL' ? -10 : 10));
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // Exit marker - square on the candle
        const color = marker.status === 'won' ? 'hsl(142, 76%, 50%)' : 'hsl(0, 84%, 60%)';
        
        ctx.shadowColor = marker.status === 'won' ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)';
        ctx.shadowBlur = 10;
        
        ctx.fillStyle = color;
        ctx.fillRect(x - 8, y - 8, 16, 16);
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x - 8, y - 8, 16, 16);
        
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
    });

    // Draw countdown timer for open trades
    const activeTrades = openTrades.filter(trade => trade.assetId === asset.id);
    activeTrades.forEach(trade => {
      const expiryTime = new Date(trade.expiryTime).getTime();
      const now = Date.now();
      const timeRemaining = Math.max(0, expiryTime - now);
      
      if (timeRemaining > 0) {
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        const timeText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Find the candle where the trade started
        const tradeStartTime = new Date(trade.createdAt || Date.now()).getTime();
        let tradeCandleIndex = -1;
        let minTimeDiff = Infinity;
        
        candles.slice(startIndex).forEach((candle, i) => {
          const timeDiff = Math.abs(candle.timestamp - tradeStartTime);
          if (timeDiff < minTimeDiff) {
            minTimeDiff = timeDiff;
            tradeCandleIndex = i;
          }
        });
        
        // Position above the trade's candle (or last candle if not found)
        const timerCandleX = tradeCandleIndex >= 0 
          ? leftMargin + tradeCandleIndex * candleSpacing + candleSpacing / 2
          : leftMargin + (visibleCandles - 1) * candleSpacing + candleSpacing / 2;
        const timerY = topMargin + 5;
        
        // Timer background
        ctx.font = 'bold 12px Arial';
        const textWidth = ctx.measureText(timeText).width;
        const bgWidth = textWidth + 16;
        const bgHeight = 24;
        const bgX = timerCandleX - bgWidth / 2;
        
        // Background with gradient
        const timerGradient = ctx.createLinearGradient(bgX, timerY, bgX, timerY + bgHeight);
        timerGradient.addColorStop(0, 'hsla(220, 30%, 20%, 0.95)');
        timerGradient.addColorStop(1, 'hsla(220, 30%, 15%, 0.95)');
        ctx.fillStyle = timerGradient;
        ctx.beginPath();
        ctx.roundRect(bgX, timerY, bgWidth, bgHeight, 6);
        ctx.fill();
        
        // Border
        ctx.strokeStyle = 'hsla(217, 91%, 60%, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Timer text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(timeText, timerCandleX, timerY + bgHeight / 2);
      }
    });

    // Draw profit/loss for completed trades
    tradeConnections.forEach((conn) => {
      if (conn.exit) {
        const exitX = scaleTime(conn.exit.timestamp);
        const exitY = scalePrice(conn.exit.price);
        
        // Find the trade data
        const trade = [...openTrades, ...tradeHistory].find(t => t.id === conn.exit?.tradeId);
        if (trade && trade.status !== 'open') {
          const openPrice = parseFloat(trade.openPrice);
          const closePrice = parseFloat(trade.closePrice || '0');
          const amount = parseFloat(trade.amount);
          const isWin = trade.status === 'won';
          const pnl = isWin ? amount * 0.82 : -amount;
          
          const pnlText = `${isWin ? '+' : ''}$${pnl.toFixed(2)}`;
          
          // Position above exit marker
          const pnlY = exitY - 25;
          
          // Background
          ctx.font = 'bold 11px Arial';
          const textWidth = ctx.measureText(pnlText).width;
          const bgWidth = textWidth + 12;
          const bgHeight = 20;
          const bgX = exitX - bgWidth / 2;
          
          const color = isWin ? 'hsla(142, 76%, 50%, 0.9)' : 'hsla(0, 84%, 60%, 0.9)';
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(bgX, pnlY, bgWidth, bgHeight, 4);
          ctx.fill();
          
          // Text
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pnlText, exitX, pnlY + bgHeight / 2);
        }
      }
    });

    // Draw current price line with professional style
    const currentPrice = parseFloat(asset.currentPrice);
    const currentPriceY = scalePrice(currentPrice);
    
    // Animated glow effect for current price line
    ctx.shadowColor = 'hsla(217, 91%, 65%, 0.6)';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'hsl(217, 91%, 60%)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(leftMargin, currentPriceY);
    ctx.lineTo(canvas.width - rightMargin, currentPriceY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    
    // Draw current price label with Pocket Option style
    const priceText = currentPrice.toFixed(asset.category === 'crypto' ? 2 : 5);
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const textWidth = ctx.measureText(priceText).width;
    
    // Price badge background with gradient
    const badgeGradient = ctx.createLinearGradient(
      canvas.width - rightMargin - textWidth - 20, 
      currentPriceY - 13, 
      canvas.width - rightMargin - textWidth - 20, 
      currentPriceY + 13
    );
    badgeGradient.addColorStop(0, 'hsl(217, 91%, 58%)');
    badgeGradient.addColorStop(1, 'hsl(217, 91%, 48%)');
    ctx.fillStyle = badgeGradient;
    
    // Rounded badge
    const badgeX = canvas.width - rightMargin - textWidth - 20;
    const badgeY = currentPriceY - 13;
    const badgeWidth = textWidth + 16;
    const badgeHeight = 26;
    const radius = 4;
    
    ctx.beginPath();
    ctx.moveTo(badgeX + radius, badgeY);
    ctx.lineTo(badgeX + badgeWidth - radius, badgeY);
    ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + radius);
    ctx.lineTo(badgeX + badgeWidth, badgeY + badgeHeight - radius);
    ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX + badgeWidth - radius, badgeY + badgeHeight);
    ctx.lineTo(badgeX + radius, badgeY + badgeHeight);
    ctx.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + badgeHeight - radius);
    ctx.lineTo(badgeX, badgeY + radius);
    ctx.quadraticCurveTo(badgeX, badgeY, badgeX + radius, badgeY);
    ctx.closePath();
    ctx.fill();
    
    // Badge border
    ctx.strokeStyle = 'hsl(217, 91%, 70%)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Price text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(priceText, badgeX + badgeWidth / 2, currentPriceY);

  }, [candles, asset, markers, timerTick, openTrades, tradeHistory]);

  const timeframes = [
    { key: '5s', label: '5ث' },
    { key: '30s', label: '30ث' },
    { key: '1m', label: '1د' },
    { key: '5m', label: '5د' },
    { key: '15m', label: '15د' },
    { key: '30m', label: '30د' },
    { key: '1h', label: '1س' },
    { key: '4h', label: '4س' },
  ];

  return (
    <div className="h-full relative">
      {/* Chart Controls - Pocket Option Style */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2" data-testid="chart-controls">
        <div className="bg-gradient-to-b from-slate-800/90 to-slate-900/90 backdrop-blur-md rounded-xl px-2 py-2 flex items-center gap-1 border border-slate-700/50 shadow-xl">
          {timeframes.map(tf => (
            <button
              key={tf.key}
              onClick={() => onTimeframeChange(tf.key)}
              data-testid={`timeframe-${tf.key}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                timeframe === tf.key
                  ? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <button 
          className="bg-gradient-to-b from-slate-800/90 to-slate-900/90 backdrop-blur-md rounded-xl px-3 py-2 hover:bg-slate-700/50 transition-all border border-slate-700/50 shadow-xl"
          data-testid="button-chart-type"
        >
          <i className="fas fa-chart-bar text-sm text-slate-300"></i>
        </button>
        <button 
          className="bg-gradient-to-b from-slate-800/90 to-slate-900/90 backdrop-blur-md rounded-xl px-3 py-2 hover:bg-slate-700/50 transition-all border border-slate-700/50 shadow-xl"
          data-testid="button-fullscreen"
        >
          <i className="fas fa-expand text-sm text-slate-300"></i>
        </button>
      </div>

      {/* Indicator Controls - Pocket Option Style */}
      <div className="absolute top-4 right-4 z-10">
        <button 
          className="bg-gradient-to-b from-slate-800/90 to-slate-900/90 backdrop-blur-md rounded-xl px-4 py-2 hover:bg-slate-700/50 transition-all flex items-center gap-2 border border-slate-700/50 shadow-xl"
          data-testid="button-indicators"
        >
          <i className="fas fa-chart-line text-sm text-blue-400"></i>
          <span className="text-xs font-bold text-slate-200">المؤشرات</span>
        </button>
      </div>

      {/* Chart Canvas with Professional Background */}
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg"
        style={{ background: 'linear-gradient(to bottom, hsl(220, 30%, 8%), hsl(220, 30%, 12%))' }}
        data-testid="trading-chart-canvas"
      />
    </div>
  );
}
