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

  // Fetch candle data from API
  const { data: candleData, isLoading } = useQuery<Candle[]>({
    queryKey: ['/api/binomo/candles', asset?.id, timeframe],
    enabled: !!asset,
  });

  // Update candles when new data is fetched
  useEffect(() => {
    if (candleData) {
      setCandles(candleData);
    }
  }, [candleData]);

  // Update last candle with current price
  useEffect(() => {
    if (!asset || candles.length === 0) return;

    const currentPrice = parseFloat(asset.currentPrice);
    const updatedCandles = [...candles];
    const lastCandle = updatedCandles[updatedCandles.length - 1];
    
    // Update the last candle's close price and adjust high/low if needed
    lastCandle.close = currentPrice;
    lastCandle.high = Math.max(lastCandle.high, currentPrice);
    lastCandle.low = Math.min(lastCandle.low, currentPrice);
    
    setCandles(updatedCandles);
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

    // Draw grid
    ctx.strokeStyle = 'hsl(220, 15%, 20%)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    // Vertical lines
    for (let x = 0; x <= canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= canvas.height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Calculate candle dimensions
    const visibleCandles = Math.min(candles.length, 50);
    const candleWidth = Math.max(4, (canvas.width - 100) / visibleCandles - 5);
    const candleSpacing = candleWidth + 5;
    const startX = 50;
    const startIndex = Math.max(0, candles.length - visibleCandles);

    // Scale price to canvas Y coordinate
    const scalePrice = (price: number) => {
      return canvas.height - 30 - ((price - (minPrice - padding)) / (priceRange + padding * 2)) * (canvas.height - 60);
    };

    // Draw candlesticks
    candles.slice(startIndex).forEach((candle, i) => {
      const x = startX + i * candleSpacing;
      const isGreen = candle.close >= candle.open;
      
      const openY = scalePrice(candle.open);
      const closeY = scalePrice(candle.close);
      const highY = scalePrice(candle.high);
      const lowY = scalePrice(candle.low);
      
      // Draw wick
      ctx.strokeStyle = isGreen ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + candleWidth/2, highY);
      ctx.lineTo(x + candleWidth/2, lowY);
      ctx.stroke();
      
      // Draw body
      ctx.fillStyle = isGreen ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)';
      const bodyHeight = Math.abs(closeY - openY);
      const bodyY = Math.min(openY, closeY);
      ctx.fillRect(x, bodyY, candleWidth, bodyHeight || 1);
    });

    // Draw current price line
    const currentPrice = parseFloat(asset.currentPrice);
    const currentPriceY = scalePrice(currentPrice);
    ctx.strokeStyle = 'hsl(217, 91%, 60%)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(0, currentPriceY);
    ctx.lineTo(canvas.width, currentPriceY);
    ctx.stroke();

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

      {/* Price Level Indicator */}
      {asset && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 bg-primary px-2 py-1 rounded-l text-xs font-mono font-bold">
          {asset.currentPrice}
        </div>
      )}
    </div>
  );
}
