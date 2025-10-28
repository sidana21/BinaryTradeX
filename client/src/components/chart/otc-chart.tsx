import { useEffect, useRef, forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { createChart, IChartApi, CandlestickSeries } from "lightweight-charts";
import { useOtcMarket } from "@/hooks/use-otc-market";

interface OtcChartProps {
  pair?: string;
  duration?: number;
  onPriceUpdate?: (price: number) => void;
  openTrades?: any[];
}

export interface OtcChartRef {
  getCurrentPrice: () => number;
  placeTrade: (type: "buy" | "sell") => void;
}

const OtcChart = forwardRef<OtcChartRef, OtcChartProps>(({ 
  pair = "EURUSD", 
  duration = 60, 
  onPriceUpdate,
  openTrades = [] 
}, ref) => {
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useRef(window.innerWidth < 768);
  const priceLineRefs = useRef<Map<string, any>>(new Map());
  const verticalLineRefs = useRef<Map<string, any>>(new Map());
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));

  const { candles, currentPrice, isLoading, isConnected, error } = useOtcMarket({
    pair,
    candleInterval: 60,
    onPriceUpdate,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const uniqueCandles = useMemo(() => {
    const seen = new Map();
    const filtered = candles.filter(candle => {
      if (!candle || typeof candle.time === 'undefined') return false;
      const time = typeof candle.time === 'number' ? candle.time : candle.time;
      if (seen.has(time)) {
        return false;
      }
      seen.set(time, true);
      return true;
    });
    
    return filtered.sort((a, b) => {
      const timeA = typeof a.time === 'number' ? a.time : 0;
      const timeB = typeof b.time === 'number' ? b.time : 0;
      return timeA - timeB;
    });
  }, [candles]);

  const currentPairTrades = useMemo(() => {
    if (!openTrades || !pair) return [];
    const pairId = `${pair}_OTC`;
    const now = Math.floor(Date.now() / 1000);
    
    return openTrades.filter(trade => {
      const isCurrentPair = trade.assetId === pairId;
      const expiryTime = Math.floor(new Date(trade.expiryTime).getTime() / 1000);
      const isNotExpired = expiryTime > now;
      return isCurrentPair && isNotExpired;
    });
  }, [openTrades, pair, currentTime]);

  useImperativeHandle(ref, () => ({
    getCurrentPrice: () => currentPrice || 0,
    placeTrade: (type: "buy" | "sell") => {
      console.log(`Trade placed: ${type} at price ${currentPrice}`);
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth || 800;
    const containerHeight = containerRef.current.clientHeight || 400;
    
    const chart = createChart(containerRef.current, {
      width: containerWidth,
      height: containerHeight,
      layout: { 
        background: { color: "#0a0e1a" }, 
        textColor: "#8b92a7", 
        attributionLogo: false 
      },
      grid: { 
        vertLines: { color: "#1a2033", style: 1 }, 
        horzLines: { color: "#1a2033", style: 1 } 
      },
      timeScale: { 
        timeVisible: true, 
        secondsVisible: false,
        borderColor: "#2a3447",
        rightOffset: isMobile.current ? 8 : 12,
        barSpacing: isMobile.current ? 6 : 10,
        minBarSpacing: isMobile.current ? 3 : 5,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: false,
        rightBarStaysOnScroll: true,
        borderVisible: true,
        visible: true,
        shiftVisibleRangeOnNewBar: true,
      },
      rightPriceScale: {
        borderColor: "#2a3447",
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
        autoScale: true,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "#6366f1",
          width: 1,
          style: 1,
          labelBackgroundColor: "#6366f1",
        },
        horzLine: {
          color: "#6366f1",
          width: 1,
          style: 1,
          labelBackgroundColor: "#6366f1",
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      kineticScroll: {
        touch: true,
        mouse: false,
      },
    });
    
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: true,
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    
    seriesRef.current = candleSeries;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && uniqueCandles.length > 0) {
      try {
        seriesRef.current.setData(uniqueCandles);
        
        if (chartRef.current) {
          setTimeout(() => {
            chartRef.current?.timeScale().scrollToRealTime();
          }, 100);
        }
      } catch (err) {
        console.error('Error setting chart data:', err);
      }
    }
  }, [uniqueCandles]);

  useEffect(() => {
    if (!seriesRef.current) return;

    priceLineRefs.current.forEach((line) => {
      seriesRef.current.removePriceLine(line);
    });
    priceLineRefs.current.clear();

    verticalLineRefs.current.forEach((marker) => {
      seriesRef.current.removeMarker(marker);
    });
    verticalLineRefs.current.clear();

    if (!currentPairTrades || currentPairTrades.length === 0) {
      return;
    }

    currentPairTrades.forEach((trade) => {
      const entryPrice = parseFloat(trade.openPrice);
      const entryTime = Math.floor(new Date(trade.createdAt).getTime() / 1000);
      const color = trade.type === 'CALL' ? '#22c55e' : '#ef4444';
      
      const priceLine = seriesRef.current.createPriceLine({
        price: entryPrice,
        color: color,
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: trade.type === 'CALL' ? '↑ دخول' : '↓ دخول',
      });
      
      priceLineRefs.current.set(trade.id, priceLine);

      const marker = {
        time: entryTime,
        position: 'inBar',
        color: color,
        shape: 'circle',
        text: trade.type === 'CALL' ? '▲' : '▼',
      };
      
      seriesRef.current.setMarkers([marker]);
      verticalLineRefs.current.set(trade.id, marker);
    });
  }, [currentPairTrades]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" data-testid="chart-container" />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0e1a]/80" data-testid="chart-loading">
          <div className="text-white">جاري تحميل البيانات...</div>
        </div>
      )}
      
      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded" data-testid="chart-error">
          {error}
        </div>
      )}
      
      <div className="absolute top-4 right-4 flex items-center gap-2" data-testid="chart-status">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-xs text-gray-400">
          {isConnected ? 'متصل' : 'غير متصل'}
        </span>
      </div>
      
      {currentPrice && (
        <div className="absolute top-4 left-4 bg-[#1a2033]/90 px-4 py-2 rounded" data-testid="chart-current-price">
          <div className="text-xs text-gray-400">السعر الحالي</div>
          <div className="text-lg font-bold text-white">{currentPrice.toFixed(5)}</div>
        </div>
      )}

      {currentPairTrades && currentPairTrades.length > 0 && (
        <div className="absolute top-16 left-4 space-y-2" data-testid="chart-countdowns">
          {currentPairTrades.map((trade) => {
            const expiryTime = Math.floor(new Date(trade.expiryTime).getTime() / 1000);
            const remainingSeconds = Math.max(0, expiryTime - currentTime);
            const entryPrice = parseFloat(trade.openPrice);
            const color = trade.type === 'CALL' ? 'bg-green-500/20 border-green-500' : 'bg-red-500/20 border-red-500';
            const textColor = trade.type === 'CALL' ? 'text-green-400' : 'text-red-400';
            
            if (remainingSeconds === 0) return null;
            
            return (
              <div 
                key={trade.id} 
                className={`${color} border px-3 py-2 rounded-lg backdrop-blur-sm`}
                data-testid={`countdown-${trade.id}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xl font-bold ${textColor}`}>
                    {trade.type === 'CALL' ? '↑' : '↓'}
                  </span>
                  <div>
                    <div className="text-xs text-gray-400">الوقت المتبقي</div>
                    <div className={`text-lg font-mono font-bold ${textColor}`}>
                      {formatTime(remainingSeconds)}
                    </div>
                  </div>
                  <div className="ml-2">
                    <div className="text-xs text-gray-400">سعر الدخول</div>
                    <div className="text-sm font-mono text-white">
                      {entryPrice.toFixed(5)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

OtcChart.displayName = 'OtcChart';

export default OtcChart;
