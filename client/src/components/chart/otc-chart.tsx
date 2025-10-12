import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData, CandlestickSeries, createSeriesMarkers } from "lightweight-charts";

interface Candle {
  pair: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Trade {
  id: number;
  type: "buy" | "sell";
  entryPrice: number;
  entryTime: number;
  exitTime: number;
  result?: "win" | "lose";
}

interface OtcChartProps {
  pair?: string;
  duration?: number;
  onPriceUpdate?: (price: number) => void;
}

export interface OtcChartRef {
  getCurrentPrice: () => number;
  placeTrade: (type: "buy" | "sell") => void;
}

const OtcChart = forwardRef<OtcChartRef, OtcChartProps>(({ pair = "EURUSD", duration = 60, onPriceUpdate }, ref) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [lastPrice, setLastPrice] = useState(0);
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));
  const [showHistory, setShowHistory] = useState(false);

  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const tradeIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentPairRef = useRef(pair);
  const candleBufferRef = useRef<CandlestickData[]>([]);
  const markersRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    getCurrentPrice: () => lastPrice,
    placeTrade: (type: "buy" | "sell") => {
      if (!lastPrice) return;
      const entryTime = Math.floor(Date.now() / 1000);
      const exitTime = entryTime + duration;

      const newTrade: Trade = {
        id: ++tradeIdRef.current,
        type,
        entryPrice: lastPrice,
        entryTime,
        exitTime,
      };

      setTrades((old) => [...old, newTrade]);
    },
  }));

  // Update current time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize chart and WebSocket once
  useEffect(() => {
    if (!containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth || 800;
    const containerHeight = containerRef.current.clientHeight || 400;
    
    console.log('Creating chart with dimensions:', containerWidth, 'x', containerHeight);
    
    const chart = createChart(containerRef.current, {
      width: containerWidth,
      height: containerHeight,
      layout: { background: { color: "#0c1e3e" }, textColor: "white", attributionLogo: false },
      grid: { vertLines: { color: "#334" }, horzLines: { color: "#334" } },
      timeScale: { timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    seriesRef.current = candleSeries;
    
    // Initialize markers with empty array
    markersRef.current = createSeriesMarkers(candleSeries, []);

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('OTC WebSocket connected');
    };

    ws.onerror = (error) => {
      console.error('OTC WebSocket error:', error);
    };

    ws.onmessage = (ev) => {
      try {
        const message = JSON.parse(ev.data);
        if (message.type === 'otc_candle') {
          const candle: Candle = message.data;
          console.log('Received candle:', candle.pair, 'Current pair:', currentPairRef.current);
          if (candle.pair === currentPairRef.current) {
            console.log('Updating chart with candle:', candle);
            const formatted: CandlestickData = {
              time: candle.time as any,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
            };
            
            // Add to buffer
            candleBufferRef.current.push(formatted);
            
            // Keep only last 100 candles for performance
            if (candleBufferRef.current.length > 100) {
              candleBufferRef.current = candleBufferRef.current.slice(-100);
            }
            
            // Update chart with all buffered data
            seriesRef.current?.setData(candleBufferRef.current);
            
            setLastPrice(candle.close);
            onPriceUpdate?.(candle.close);

            // تحديث نتائج الصفقات
            setTrades((old) =>
              old.map((t) =>
                !t.result && candle.time >= t.exitTime
                  ? {
                      ...t,
                      result:
                        (t.type === "buy" && candle.close > t.entryPrice) ||
                        (t.type === "sell" && candle.close < t.entryPrice)
                          ? "win"
                          : "lose",
                    }
                  : t
              )
            );
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

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
      ws.close();
      chart.remove();
    };
  }, []);

  // Update current pair ref and clear series data when pair changes
  useEffect(() => {
    console.log('Chart pair changed to:', pair);
    currentPairRef.current = pair;
    candleBufferRef.current = [];
    if (seriesRef.current) {
      seriesRef.current.setData([]);
      setLastPrice(0);
      setTrades([]);
    }
  }, [pair]);

  // Log buffer size for debugging
  useEffect(() => {
    console.log('Chart buffer size:', candleBufferRef.current.length, 'Series exists:', !!seriesRef.current);
  }, [candleBufferRef.current.length]);

  // Price lines and markers for entry/exit visualization (Quotex/IQ Option style)
  const priceLineRefsRef = useRef<any[]>([]);
  
  useEffect(() => {
    if (!seriesRef.current) return;
    
    // Clear old price lines
    priceLineRefsRef.current.forEach(line => {
      try {
        seriesRef.current?.removePriceLine(line);
      } catch (e) {}
    });
    priceLineRefsRef.current = [];
    
    // Set markers for arrows on candles using new v5 API
    if (markersRef.current) {
      const markers: any[] = [];
      trades.forEach((t) => {
        // Entry marker - arrow at entry candle
        markers.push({
          time: t.entryTime as any,
          position: t.type === "buy" ? "belowBar" : "aboveBar",
          shape: t.type === "buy" ? "arrowUp" : "arrowDown",
          color: t.type === "buy" ? "#26a69a" : "#ef5350",
          text: "",
          size: 2,
        });
        
        // Exit marker when trade completes
        if (t.result) {
          markers.push({
            time: t.exitTime as any,
            position: "inBar",
            shape: "circle",
            color: t.result === "win" ? "#26a69a" : "#ef5350",
            text: "",
            size: 1,
          });
        }
      });
      
      try {
        markersRef.current.setMarkers(markers);
      } catch (e) {
        console.log("Markers:", e);
      }
    }
    
    // Create horizontal price lines for entry (like Quotex/IQ Option)
    trades.forEach((t) => {
      try {
        // Only show price line for ACTIVE trades (not completed)
        if (!t.result) {
          const entryLine = seriesRef.current?.createPriceLine({
            price: t.entryPrice,
            color: t.type === "buy" ? "#26a69a" : "#ef5350",
            lineWidth: 3, // Thicker line for better visibility
            lineStyle: 0, // Solid line (not dashed)
            axisLabelVisible: true,
            title: t.type === "buy" ? "دخول ↑" : "دخول ↓",
          });
          if (entryLine) priceLineRefsRef.current.push(entryLine);
        }
        // Don't show lines for completed trades - they will be in history
      } catch (e) {
        console.log("Price line error:", e);
      }
    });
    
    return () => {
      // Cleanup price lines on unmount
      priceLineRefsRef.current.forEach(line => {
        try {
          seriesRef.current?.removePriceLine(line);
        } catch (e) {}
      });
    };
  }, [trades, lastPrice]);

  // Calculate countdown and profit/loss for active trades
  const activeTrades = trades.filter(t => !t.result);
  const completedTrades = trades.filter(t => t.result);

  return (
    <div className="w-full h-full bg-[#0c1e3e] flex flex-col relative">
      <div ref={containerRef} className="flex-1 w-full min-h-[300px]" data-testid="otc-chart" />

      {/* Countdown timer overlay for active trades */}
      {activeTrades.map((t) => {
        const timeRemaining = Math.max(0, t.exitTime - currentTime);
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        return (
          <div 
            key={`timer-${t.id}`}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-600/90 to-blue-500/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg z-30"
            data-testid={`countdown-${t.id}`}
          >
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold ${t.type === 'buy' ? 'text-green-300' : 'text-red-300'}`}>
                {t.type === 'buy' ? '↑ شراء' : '↓ بيع'}
              </span>
              <span className="text-white font-mono text-lg font-bold">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
            </div>
          </div>
        );
      })}

      {/* History Button - Only show if there are completed trades */}
      {completedTrades.length > 0 && (
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="absolute bottom-4 left-4 bg-blue-600/90 hover:bg-blue-700/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg z-30 transition-colors flex items-center gap-2"
          data-testid="button-history"
        >
          <i className="fas fa-history text-white"></i>
          <span className="text-white font-medium text-sm">سجل الصفقات ({completedTrades.length})</span>
        </button>
      )}

      {/* History Modal */}
      {showHistory && completedTrades.length > 0 && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#1a2847] rounded-lg p-4 max-w-2xl w-full max-h-96 overflow-y-auto relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">سجل الصفقات المنتهية</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors font-bold text-lg"
                data-testid="button-close-history"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {completedTrades.map((t) => {
                const profit = t.result === 'win' ? '+$82.00' : '-$100.00';
                return (
                  <div 
                    key={t.id} 
                    className="flex items-center justify-between bg-[#0c1e3e] p-3 rounded-lg text-sm"
                    data-testid={`history-trade-${t.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded ${t.type === 'buy' ? 'bg-green-600' : 'bg-red-600'} text-white font-semibold`}>
                        {t.type === 'buy' ? 'شراء' : 'بيع'}
                      </span>
                      <span className="text-gray-300">دخول: <span className="text-white font-mono">{t.entryPrice.toFixed(5)}</span></span>
                      <span className={`px-3 py-1 rounded font-semibold ${
                        t.result === 'win' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                      }`}>
                        {t.result === 'win' ? `ربح ${profit}` : `خسارة ${profit}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

OtcChart.displayName = "OtcChart";

export default OtcChart;
