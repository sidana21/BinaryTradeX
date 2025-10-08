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

    // Draw professional candlesticks (Pocket Option style)
    candles.slice(startIndex).forEach((candle, i) => {
      const x = leftMargin + i * candleSpacing + candleSpacing / 2;
      const isGreen = candle.close >= candle.open;
      
      const openY = scalePrice(candle.open);
      const closeY = scalePrice(candle.close);
      const highY = scalePrice(candle.high);
      const lowY = scalePrice(candle.low);
      
      const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
      const bodyY = Math.min(openY, closeY);
      
      // Premium color scheme
      const greenColor = 'hsl(145, 80%, 55%)';
      const greenDark = 'hsl(145, 80%, 42%)';
      const redColor = 'hsl(355, 85%, 60%)';
      const redDark = 'hsl(355, 85%, 48%)';
      
      // Draw wick with precise width
      ctx.strokeStyle = isGreen ? greenColor : redColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();
      
      // Draw glow effect for depth
      ctx.shadowColor = isGreen ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';
      ctx.shadowBlur = 8;
      
      // Draw body with smooth gradient
      const gradient = ctx.createLinearGradient(x - candleWidth/2, bodyY, x + candleWidth/2, bodyY + bodyHeight);
      if (isGreen) {
        gradient.addColorStop(0, greenColor);
        gradient.addColorStop(0.5, 'hsl(145, 80%, 48%)');
        gradient.addColorStop(1, greenDark);
      } else {
        gradient.addColorStop(0, redColor);
        gradient.addColorStop(0.5, 'hsl(355, 85%, 54%)');
        gradient.addColorStop(1, redDark);
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(x - candleWidth/2, bodyY, candleWidth, bodyHeight);
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      
      // Add crisp border for clarity
      ctx.strokeStyle = isGreen ? greenDark : redDark;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - candleWidth/2, bodyY, candleWidth, bodyHeight);
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

    // Draw connection lines first
    tradeConnections.forEach((conn) => {
      if (conn.exit) {
        const entryX = scaleTime(conn.entry.timestamp);
        const entryY = scalePrice(conn.entry.price);
        const exitX = scaleTime(conn.exit.timestamp);
        const exitY = scalePrice(conn.exit.price);
        
        const color = conn.exit.status === 'won' ? 'hsl(142, 76%, 50%)' : 'hsl(0, 84%, 60%)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(entryX, entryY);
        ctx.lineTo(exitX, exitY);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      }
    });

    // Draw markers
    visibleMarkers.forEach(marker => {
      const x = scaleTime(marker.timestamp);
      const y = scalePrice(marker.price);
      
      if (marker.type === 'entry') {
        // Entry marker - circle
        const color = marker.tradeType === 'CALL' ? 'hsl(142, 76%, 50%)' : 'hsl(0, 84%, 60%)';
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Arrow inside circle
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(marker.tradeType === 'CALL' ? '↑' : '↓', x, y);
      } else {
        // Exit marker - square
        const color = marker.status === 'won' ? 'hsl(142, 76%, 50%)' : 'hsl(0, 84%, 60%)';
        
        ctx.fillStyle = color;
        ctx.fillRect(x - 5, y - 5, 10, 10);
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 5, y - 5, 10, 10);
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

  }, [candles, asset, markers]);

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
