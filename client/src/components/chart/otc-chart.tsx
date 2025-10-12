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
  exitPrice?: number;
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
  const [updateInterval, setUpdateInterval] = useState<number>(15);

  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const tradeIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentPairRef = useRef(pair);
  const candleBufferRef = useRef<CandlestickData[]>([]);
  const markersRef = useRef<any>(null);
  const currentCandleRef = useRef<CandlestickData | null>(null);
  const candleStartTimeRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
      upColor: '#00ff88',
      downColor: '#ef5350',
      borderVisible: true,
      borderUpColor: '#00ff88',
      borderDownColor: '#ef5350',
      wickUpColor: '#00ff88',
      wickDownColor: '#ef5350',
    });
    seriesRef.current = candleSeries;
    
    // Initialize markers with empty array
    markersRef.current = createSeriesMarkers(candleSeries, []);

    // Subscribe to visible range changes to redraw canvas
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      // Trigger canvas redraw by updating a state
      setCurrentTime(Math.floor(Date.now() / 1000));
    });

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
        if (message.type === 'otc_price_tick') {
          const tick = message.data;
          console.log('Received price tick:', tick.pair, 'price:', tick.price);
          if (tick.pair === currentPairRef.current) {
            const currentTime = tick.time;
            const price = tick.price;
            
            // Check if we need to start a new candle based on updateInterval
            if (!currentCandleRef.current || (currentTime - candleStartTimeRef.current) >= updateInterval) {
              // Save previous candle if exists
              if (currentCandleRef.current) {
                candleBufferRef.current.push(currentCandleRef.current);
                
                // Keep only last 100 candles for performance
                if (candleBufferRef.current.length > 100) {
                  candleBufferRef.current = candleBufferRef.current.slice(-100);
                }
              }
              
              // Start new candle
              candleStartTimeRef.current = currentTime;
              currentCandleRef.current = {
                time: currentTime as any,
                open: price,
                high: price,
                low: price,
                close: price,
              };
            } else {
              // Update existing candle
              if (currentCandleRef.current) {
                currentCandleRef.current.close = price;
                currentCandleRef.current.high = Math.max(currentCandleRef.current.high, price);
                currentCandleRef.current.low = Math.min(currentCandleRef.current.low, price);
              }
            }
            
            // Update chart with buffered candles + current candle
            const allCandles = currentCandleRef.current 
              ? [...candleBufferRef.current, currentCandleRef.current]
              : candleBufferRef.current;
            console.log('Updating chart with', allCandles.length, 'candles, current candle:', currentCandleRef.current);
            seriesRef.current?.setData(allCandles);
            
            setLastPrice(price);
            onPriceUpdate?.(price);

            // تحديث نتائج الصفقات
            setTrades((old) =>
              old.map((t) =>
                !t.result && currentTime >= t.exitTime
                  ? {
                      ...t,
                      exitPrice: price,
                      result:
                        (t.type === "buy" && price > t.entryPrice) ||
                        (t.type === "sell" && price < t.entryPrice)
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
    currentCandleRef.current = null;
    candleStartTimeRef.current = 0;
    if (seriesRef.current) {
      seriesRef.current.setData([]);
      setLastPrice(0);
      setTrades([]);
    }
  }, [pair]);

  // Reset current candle and clear buffer when update interval changes
  useEffect(() => {
    console.log('Update interval changed to:', updateInterval);
    currentCandleRef.current = null;
    candleStartTimeRef.current = 0;
    candleBufferRef.current = [];
    if (seriesRef.current) {
      seriesRef.current.setData([]);
    }
  }, [updateInterval]);

  // Log buffer size for debugging
  useEffect(() => {
    console.log('Chart buffer size:', candleBufferRef.current.length, 'Series exists:', !!seriesRef.current);
  }, [candleBufferRef.current.length]);

  // Price lines for entry/exit visualization (Professional style)
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
    
    // Create price lines for trades
    trades.forEach((t) => {
      try {
        // Entry price line - Golden yellow (only for active trades)
        if (!t.result) {
          const entryLine = seriesRef.current?.createPriceLine({
            price: t.entryPrice,
            color: "#FFD700", // Golden yellow
            lineWidth: 3,
            lineStyle: 2, // Dotted line for entry
            axisLabelVisible: true,
            title: t.type === "buy" ? "↑" : "↓",
          });
          if (entryLine) priceLineRefsRef.current.push(entryLine);
        }

        // Exit price line removed - replaced with popup notification
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

  // Canvas overlay for drawing circles at line endpoints (IQ Option style)
  useEffect(() => {
    if (!chartRef.current || !containerRef.current || !canvasRef.current || !seriesRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = containerRef.current.clientWidth;
    canvas.height = containerRef.current.clientHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const timeScale = chartRef.current.timeScale();
    const visibleRange = timeScale.getVisibleRange();
    if (!visibleRange) return;

    // Draw professional circles with glow for each trade
    trades.forEach((t) => {
      
      // Only draw entry circle for active trades
      if (!t.result) {
        // Get entry time coordinate
        const entryX = timeScale.timeToCoordinate(t.entryTime as any);
        if (entryX === null) return;
        
        // Get Y coordinate for entry price using priceToCoordinate from series
        const entryY = seriesRef.current?.priceToCoordinate(t.entryPrice);
        if (entryY === null || entryY === undefined) return;

        // Draw entry circle with golden glow effect
        // Outer glow
        ctx.save();
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 20;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(entryX, entryY, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        ctx.restore();
        
        // Middle glow
        ctx.save();
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(entryX, entryY, 9, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        ctx.restore();

        // Inner circle
        ctx.beginPath();
        ctx.arc(entryX, entryY, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw direction arrow inside
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.type === 'buy' ? '↑' : '↓', entryX, entryY);
      }

      // Exit circle removed - replaced with popup notification
    });
  }, [trades, lastPrice, currentTime]);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate countdown and profit/loss for active trades
  const activeTrades = trades.filter(t => !t.result);
  const completedTrades = trades.filter(t => t.result);

  return (
    <div className="w-full h-full bg-[#0c1e3e] flex flex-col relative">
      {/* Update Interval Selector */}
      <div className="absolute top-4 right-4 z-30">
        <select
          value={updateInterval}
          onChange={(e) => setUpdateInterval(Number(e.target.value))}
          className="bg-[#1a2847] text-white border border-blue-500/30 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          data-testid="select-update-interval"
        >
          <option value={5}>5 ث</option>
          <option value={15}>15 ث</option>
          <option value={30}>30 ث</option>
          <option value={50}>50 ث</option>
        </select>
      </div>

      <div className="flex-1 w-full min-h-[300px] relative">
        <div ref={containerRef} className="absolute inset-0" data-testid="otc-chart" />
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 pointer-events-none z-10"
          style={{ width: '100%', height: '100%' }}
        />
      </div>

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
