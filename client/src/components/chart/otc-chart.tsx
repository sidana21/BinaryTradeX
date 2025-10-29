import { useEffect, useRef, forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { createChart, IChartApi, CandlestickSeries, LineSeries, HistogramSeries } from "lightweight-charts";
import { useOtcMarket } from "@/hooks/use-otc-market";

interface OtcChartProps {
  pair?: string;
  duration?: number;
  onPriceUpdate?: (price: number) => void;
  openTrades?: any[];
  showEMA?: boolean;
  showVolume?: boolean;
}

export interface OtcChartRef {
  getCurrentPrice: () => number;
  placeTrade: (type: "buy" | "sell") => void;
}

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const OtcChart = forwardRef<OtcChartRef, OtcChartProps>(({ 
  pair = "EURUSD", 
  duration = 60, 
  onPriceUpdate,
  openTrades = [],
  showEMA = true,
  showVolume = false
}, ref) => {
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const ema20Ref = useRef<any>(null);
  const ema50Ref = useRef<any>(null);
  const volumeRef = useRef<any>(null);
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

  const calculateEMA = useMemo(() => (data: CandleData[], period: number) => {
    if (data.length < period) return [];
    
    const multiplier = 2 / (period + 1);
    const emaData: any[] = [];
    
    let ema = data.slice(0, period).reduce((sum, candle) => sum + candle.close, 0) / period;
    emaData.push({ time: data[period - 1].time, value: ema });
    
    for (let i = period; i < data.length; i++) {
      ema = (data[i].close - ema) * multiplier + ema;
      emaData.push({ time: data[i].time, value: ema });
    }
    
    return emaData;
  }, []);

  const calculateVolume = useMemo(() => (data: CandleData[]) => {
    return data.map(candle => ({
      time: candle.time,
      value: Math.abs(candle.close - candle.open) * 100000,
      color: candle.close >= candle.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'
    }));
  }, []);

  const indicators = useMemo(() => {
    if (uniqueCandles.length === 0) return null;
    
    return {
      ema20: showEMA ? calculateEMA(uniqueCandles, 20) : [],
      ema50: showEMA ? calculateEMA(uniqueCandles, 50) : [],
      volume: showVolume ? calculateVolume(uniqueCandles) : []
    };
  }, [uniqueCandles, showEMA, showVolume, calculateEMA, calculateVolume]);

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
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: true,
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    
    seriesRef.current = candleSeries;

    if (showEMA) {
      try {
        const ema20Series = chart.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
        });
        ema20Ref.current = ema20Series;

        const ema50Series = chart.addSeries(LineSeries, {
          color: '#f59e0b',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
        });
        ema50Ref.current = ema50Series;
      } catch (err) {
        console.error('Error adding EMA series:', err);
      }
    }

    if (showVolume) {
      try {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: '',
        });
        volumeRef.current = volumeSeries;
      } catch (err) {
        console.error('Error adding volume series:', err);
      }
    }

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
        
        if (indicators && showEMA) {
          if (ema20Ref.current && indicators.ema20.length > 0) {
            ema20Ref.current.setData(indicators.ema20);
          }
          if (ema50Ref.current && indicators.ema50.length > 0) {
            ema50Ref.current.setData(indicators.ema50);
          }
        }
        
        if (indicators && showVolume && volumeRef.current && indicators.volume.length > 0) {
          volumeRef.current.setData(indicators.volume);
        }
        
        if (chartRef.current) {
          setTimeout(() => {
            chartRef.current?.timeScale().scrollToRealTime();
          }, 100);
        }
      } catch (err) {
        console.error('Error setting chart data:', err);
      }
    }
  }, [uniqueCandles, indicators, showEMA, showVolume]);

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

  const trendInfo = useMemo(() => {
    if (!indicators?.ema20 || !indicators?.ema50 || indicators.ema20.length === 0 || indicators.ema50.length === 0) return null;
    
    const lastEma20 = indicators.ema20[indicators.ema20.length - 1]?.value;
    const lastEma50 = indicators.ema50[indicators.ema50.length - 1]?.value;
    
    if (!lastEma20 || !lastEma50) return null;
    
    const diff = ((lastEma20 - lastEma50) / lastEma50) * 100;
    const strength = Math.abs(diff);
    const direction = diff > 0 ? 'صاعد' : 'هابط';
    const color = diff > 0 ? 'text-green-400' : 'text-red-400';
    const bgColor = diff > 0 ? 'bg-green-500/10' : 'bg-red-500/10';
    const borderColor = diff > 0 ? 'border-green-500/30' : 'border-red-500/30';
    
    return { strength: strength.toFixed(2), direction, color, bgColor, borderColor, diff };
  }, [indicators]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" data-testid="chart-container" />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0e1a]/90 backdrop-blur-sm" data-testid="chart-loading">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <div className="text-white font-medium">جاري تحميل البيانات المتقدمة...</div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded-lg backdrop-blur-sm" data-testid="chart-error">
          ⚠️ {error}
        </div>
      )}
      
      <div className="absolute top-4 right-4 flex flex-col gap-2" data-testid="chart-indicators">
        <div className="flex items-center gap-2 bg-[#1a2033]/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-[#2a3447]">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs font-medium text-gray-300">
            {isConnected ? 'متصل' : 'غير متصل'}
          </span>
        </div>
        
        {currentPrice && (
          <div className="bg-[#1a2033]/90 backdrop-blur-sm px-4 py-3 rounded-lg border border-[#2a3447]" data-testid="chart-current-price">
            <div className="text-xs text-gray-400 mb-1">السعر الحالي</div>
            <div className="text-2xl font-bold text-white font-mono">{currentPrice.toFixed(5)}</div>
          </div>
        )}
        
        {showEMA && trendInfo && (
          <div className={`${trendInfo.bgColor} backdrop-blur-sm px-4 py-3 rounded-lg border ${trendInfo.borderColor}`} data-testid="trend-indicator">
            <div className="text-xs text-gray-400 mb-1">قوة الاتجاه</div>
            <div className={`text-lg font-bold ${trendInfo.color}`}>
              {trendInfo.direction} {trendInfo.diff > 0 ? '↑' : '↓'}
            </div>
            <div className="text-xs text-gray-300 mt-1">{trendInfo.strength}%</div>
          </div>
        )}
      </div>

      {currentPairTrades && currentPairTrades.length > 0 && (
        <div className="absolute top-4 left-4 space-y-2 max-w-xs" data-testid="chart-countdowns">
          {currentPairTrades.map((trade) => {
            const expiryTime = Math.floor(new Date(trade.expiryTime).getTime() / 1000);
            const remainingSeconds = Math.max(0, expiryTime - currentTime);
            const entryPrice = parseFloat(trade.openPrice);
            const color = trade.type === 'CALL' ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50';
            const textColor = trade.type === 'CALL' ? 'text-green-400' : 'text-red-400';
            const bgGlow = trade.type === 'CALL' ? 'shadow-green-500/20' : 'shadow-red-500/20';
            
            if (remainingSeconds === 0) return null;
            
            return (
              <div 
                key={trade.id} 
                className={`${color} border-2 px-4 py-3 rounded-xl backdrop-blur-md shadow-lg ${bgGlow}`}
                data-testid={`countdown-${trade.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`text-3xl font-bold ${textColor}`}>
                    {trade.type === 'CALL' ? '↑' : '↓'}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-400 mb-1">الوقت المتبقي</div>
                    <div className={`text-xl font-mono font-bold ${textColor}`}>
                      {formatTime(remainingSeconds)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">سعر الدخول</div>
                    <div className="text-sm font-mono font-semibold text-white">
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
