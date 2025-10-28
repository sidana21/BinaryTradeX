import { useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from "react";
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

  const { candles, currentPrice, isLoading, isConnected, error } = useOtcMarket({
    pair,
    candleInterval: 60,
    onPriceUpdate,
  });

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
    </div>
  );
});

OtcChart.displayName = 'OtcChart';

export default OtcChart;
