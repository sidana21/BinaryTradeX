import { useEffect, useRef } from 'react';
import type { Asset } from '@shared/schema';

interface TradingChartProps {
  asset: Asset | null;
  timeframe: string;
  onTimeframeChange: (timeframe: string) => void;
}

export function TradingChart({ asset, timeframe, onTimeframeChange }: TradingChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !asset) return;

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

    // Draw sample candlesticks
    const candleWidth = 20;
    const candleSpacing = 30;
    const startX = 50;
    const centerY = canvas.height / 2;

    // Generate sample data based on current price
    const basePrice = parseFloat(asset.currentPrice);
    const priceRange = basePrice * 0.02; // 2% range
    
    for (let i = 0; i < 20; i++) {
      const x = startX + i * candleSpacing;
      
      // Generate OHLC data
      const open = basePrice + (Math.random() - 0.5) * priceRange;
      const close = basePrice + (Math.random() - 0.5) * priceRange;
      const high = Math.max(open, close) + Math.random() * priceRange * 0.3;
      const low = Math.min(open, close) - Math.random() * priceRange * 0.3;
      
      const isGreen = close > open;
      
      // Scale prices to canvas
      const scalePrice = (price: number) => {
        const minPrice = basePrice - priceRange;
        const maxPrice = basePrice + priceRange;
        return centerY + ((minPrice - price) / (maxPrice - minPrice)) * (canvas.height * 0.6);
      };
      
      const openY = scalePrice(open);
      const closeY = scalePrice(close);
      const highY = scalePrice(high);
      const lowY = scalePrice(low);
      
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
    }

    // Draw current price line
    ctx.strokeStyle = 'hsl(217, 91%, 60%)';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.stroke();

  }, [asset, timeframe]);

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
