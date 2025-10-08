import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Asset } from '@shared/schema';

interface TradingChartProps {
  asset: Asset | null;
  timeframe: string;
  onTimeframeChange: (timeframe: string) => void;
}

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function TradingChart({ asset, timeframe, onTimeframeChange }: TradingChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const lastUpdateTimeRef = useRef<number>(0);

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

  // Update last candle with current price (throttled to 3000ms)
  useEffect(() => {
    if (!asset || candles.length === 0) return;

    const currentTime = Date.now();
    const timeSinceLastUpdate = currentTime - lastUpdateTimeRef.current;
    
    // Only update if at least 3000ms have passed
    if (timeSinceLastUpdate < 3000) {
      return;
    }

    lastUpdateTimeRef.current = currentTime;
    const currentPrice = parseFloat(asset.currentPrice);
    
    setCandles(prevCandles => {
      const updatedCandles = [...prevCandles];
      const lastCandle = updatedCandles[updatedCandles.length - 1];
      
      // Update the last candle's close price and adjust high/low if needed
      lastCandle.close = currentPrice;
      lastCandle.high = Math.max(lastCandle.high, currentPrice);
      lastCandle.low = Math.min(lastCandle.low, currentPrice);
      
      return updatedCandles;
    });
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

    // Clear canvas
    ctx.fillStyle = 'hsl(220, 25%, 10%)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate price range
    const prices = candles.flatMap(c => [c.high, c.low]);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const priceRange = maxPrice - minPrice;
    const padding = priceRange * 0.1;

    // Calculate candle dimensions
    const leftMargin = 80;
    const rightMargin = 20;
    const topMargin = 20;
    const bottomMargin = 30;
    const chartWidth = canvas.width - leftMargin - rightMargin;
    const chartHeight = canvas.height - topMargin - bottomMargin;
    
    const visibleCandles = Math.min(candles.length, 80);
    const candleWidth = Math.max(3, chartWidth / visibleCandles - 2);
    const candleSpacing = chartWidth / visibleCandles;
    const startIndex = Math.max(0, candles.length - visibleCandles);

    // Scale price to canvas Y coordinate
    const scalePrice = (price: number) => {
      return topMargin + chartHeight - ((price - (minPrice - padding)) / (priceRange + padding * 2)) * chartHeight;
    };

    // Draw price labels on Y-axis
    ctx.fillStyle = 'hsl(0, 0%, 70%)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    const priceSteps = 5;
    for (let i = 0; i <= priceSteps; i++) {
      const price = minPrice - padding + (priceRange + padding * 2) * (i / priceSteps);
      const y = scalePrice(price);
      ctx.fillText(price.toFixed(asset.category === 'crypto' ? 2 : 5), leftMargin - 10, y + 4);
      
      // Draw horizontal grid line
      ctx.strokeStyle = 'hsl(220, 15%, 15%)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(canvas.width - rightMargin, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw candlesticks
    candles.slice(startIndex).forEach((candle, i) => {
      const x = leftMargin + i * candleSpacing + candleSpacing / 2;
      const isGreen = candle.close >= candle.open;
      
      const openY = scalePrice(candle.open);
      const closeY = scalePrice(candle.close);
      const highY = scalePrice(candle.high);
      const lowY = scalePrice(candle.low);
      
      // Draw wick
      ctx.strokeStyle = isGreen ? 'hsl(142, 76%, 45%)' : 'hsl(0, 84%, 60%)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();
      
      // Draw body
      ctx.fillStyle = isGreen ? 'hsl(142, 76%, 45%)' : 'hsl(0, 84%, 60%)';
      const bodyHeight = Math.max(Math.abs(closeY - openY), 1);
      const bodyY = Math.min(openY, closeY);
      ctx.fillRect(x - candleWidth/2, bodyY, candleWidth, bodyHeight);
    });

    // Draw current price line
    const currentPrice = parseFloat(asset.currentPrice);
    const currentPriceY = scalePrice(currentPrice);
    ctx.strokeStyle = 'hsl(217, 91%, 60%)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(leftMargin, currentPriceY);
    ctx.lineTo(canvas.width - rightMargin, currentPriceY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw current price label
    ctx.fillStyle = 'hsl(217, 91%, 60%)';
    ctx.fillRect(canvas.width - rightMargin - 80, currentPriceY - 10, 75, 20);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(currentPrice.toFixed(asset.category === 'crypto' ? 2 : 5), canvas.width - rightMargin - 5, currentPriceY + 4);

  }, [candles, asset]);

  const timeframes = [
    { key: '1m', label: '1د' },
    { key: '5m', label: '5د' },
    { key: '15m', label: '15د' },
    { key: '1h', label: '1س' },
    { key: '4h', label: '4س' },
  ];

  return (
    <div className="h-full relative">
      {/* Chart Controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="bg-card/80 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2">
          {timeframes.map(tf => (
            <button
              key={tf.key}
              onClick={() => onTimeframeChange(tf.key)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                timeframe === tf.key
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-secondary'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <button className="bg-card/80 backdrop-blur-sm rounded-lg px-3 py-2 hover:bg-secondary transition-colors">
          <i className="fas fa-chart-bar text-sm"></i>
        </button>
        <button className="bg-card/80 backdrop-blur-sm rounded-lg px-3 py-2 hover:bg-secondary transition-colors">
          <i className="fas fa-compress text-sm"></i>
        </button>
      </div>

      {/* Indicator Controls */}
      <div className="absolute top-4 right-4 z-10">
        <button className="bg-card/80 backdrop-blur-sm rounded-lg px-3 py-2 hover:bg-secondary transition-colors flex items-center gap-2">
          <i className="fas fa-chart-line text-sm"></i>
          <span className="text-xs font-medium">المؤشرات</span>
        </button>
      </div>

      {/* Chart Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full bg-card rounded-lg"
        style={{ background: 'hsl(220, 25%, 10%)' }}
      />

      {/* Price Level Indicator - removed, now drawn on canvas */}
    </div>
  );
}
