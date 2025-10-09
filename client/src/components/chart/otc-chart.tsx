import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { createChart, IChartApi, CandlestickData, CandlestickSeries } from "lightweight-charts";

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

  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const tradeIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: { background: { color: "#0c1e3e" }, textColor: "white" },
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
          if (candle.pair === pair) {
            const formatted: CandlestickData = {
              time: candle.time as any,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
            };
            seriesRef.current?.update(formatted);
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
  }, [pair]);

  // markers and price lines for visual indicators
  useEffect(() => {
    if (!seriesRef.current) return;
    
    // Try to set markers if supported
    if (seriesRef.current.setMarkers) {
      const markers: any[] = [];
      trades.forEach((t) => {
        // Entry marker - arrow at entry point
        markers.push({
          time: t.entryTime as any,
          position: t.type === "buy" ? "belowBar" : "aboveBar",
          shape: t.type === "buy" ? "arrowUp" : "arrowDown",
          color: t.type === "buy" ? "#26a69a" : "#ef5350",
          text: t.type === "buy" ? "↑" : "↓",
          size: 2,
        });
        
        // Exit marker - square at exit point when trade is completed
        if (t.result) {
          markers.push({
            time: t.exitTime as any,
            position: t.result === "win" ? "aboveBar" : "belowBar",
            shape: "circle",
            color: t.result === "win" ? "#26a69a" : "#ef5350",
            text: t.result === "win" ? "✓" : "✗",
            size: 2,
          });
        }
      });
      
      try {
        seriesRef.current.setMarkers(markers);
        console.log("Markers set successfully:", markers.length);
      } catch (e) {
        console.error("Error setting markers:", e);
      }
    }
    
    // Add price lines for entry points as backup visual indicator
    trades.forEach((t) => {
      if (!t.result) {
        try {
          const priceLine = seriesRef.current?.createPriceLine({
            price: t.entryPrice,
            color: t.type === "buy" ? "#26a69a" : "#ef5350",
            lineWidth: 2,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: t.type === "buy" ? "↑ شراء" : "↓ بيع",
          });
        } catch (e) {
          console.log("Price lines not fully supported");
        }
      }
    });
  }, [trades]);

  // Calculate countdown and profit/loss for active trades
  const activeTrades = trades.filter(t => !t.result);
  const completedTrades = trades.filter(t => t.result);

  return (
    <div className="w-full h-full bg-[#0c1e3e] flex flex-col relative">
      <div ref={containerRef} className="flex-1 w-full relative" data-testid="otc-chart">
        {/* Visual Trade Markers Overlay */}
        {trades.map((t) => {
          // Calculate position based on time (simplified - assumes uniform spacing)
          const chartWidth = containerRef.current?.clientWidth || 0;
          const rightOffset = 60; // Offset from right edge
          
          return (
            <div key={`marker-${t.id}`}>
              {/* Entry Arrow */}
              <div 
                className="absolute z-20 pointer-events-none"
                style={{ 
                  right: `${rightOffset}px`,
                  top: '50%',
                  transform: 'translateY(-50%)'
                }}
              >
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  t.type === 'buy' ? 'bg-green-500' : 'bg-red-500'
                } shadow-lg animate-pulse`}>
                  <span className="text-white text-2xl font-bold">
                    {t.type === 'buy' ? '↑' : '↓'}
                  </span>
                </div>
              </div>
              
              {/* Exit marker when trade completes */}
              {t.result && (
                <div 
                  className="absolute z-20 pointer-events-none"
                  style={{ 
                    right: `${rightOffset + 80}px`,
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}
                >
                  <div className={`flex items-center justify-center w-8 h-8 ${
                    t.result === 'win' ? 'bg-green-600' : 'bg-red-600'
                  } shadow-lg`} style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}>
                    <span className="text-white text-sm font-bold">
                      {t.result === 'win' ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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

      {/* Profit/Loss display for completed trades */}
      {completedTrades.slice(-3).map((t) => {
        const profit = t.result === 'win' ? '+$82.00' : '-$100.00';
        return (
          <div 
            key={`pnl-${t.id}`}
            className={`absolute top-16 right-4 ${t.result === 'win' ? 'bg-green-600/90' : 'bg-red-600/90'} backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg z-10 animate-fadeIn`}
            data-testid={`pnl-${t.id}`}
          >
            <div className="text-white font-bold text-sm">
              {t.result === 'win' ? 'ربح' : 'خسارة'}: {profit}
            </div>
          </div>
        );
      })}

      {trades.length > 0 && (
        <div className="mt-4 bg-[#1a2847] rounded-lg p-4 max-h-40 overflow-y-auto">
          <h3 className="text-white font-bold mb-3">الصفقات</h3>
          <div className="space-y-2">
            {trades.map((t) => {
              const timeRemaining = !t.result ? Math.max(0, t.exitTime - currentTime) : 0;
              const minutes = Math.floor(timeRemaining / 60);
              const seconds = timeRemaining % 60;
              
              return (
                <div 
                  key={t.id} 
                  className="flex items-center justify-between bg-[#0c1e3e] p-3 rounded-lg text-sm"
                  data-testid={`trade-${t.id}`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded ${t.type === 'buy' ? 'bg-green-600' : 'bg-red-600'} text-white font-semibold`}>
                      {t.type === 'buy' ? 'شراء' : 'بيع'}
                    </span>
                    <span className="text-gray-300">دخول: <span className="text-white font-mono">{t.entryPrice.toFixed(5)}</span></span>
                    {!t.result ? (
                      <span className="text-blue-300 font-mono font-bold">
                        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                      </span>
                    ) : (
                      <span className={`px-2 py-1 rounded font-semibold ${
                        t.result === 'win' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                      }`}>
                        {t.result === 'win' ? 'ربح +$82' : 'خسارة -$100'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

OtcChart.displayName = "OtcChart";

export default OtcChart;
