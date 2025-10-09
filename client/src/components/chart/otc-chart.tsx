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

  // markers
  useEffect(() => {
    if (!seriesRef.current || !seriesRef.current.setMarkers) return;
    const markers: any[] = [];
    trades.forEach((t) => {
      markers.push({
        time: t.entryTime as any,
        position: "aboveBar",
        shape: t.type === "buy" ? "arrowUp" : "arrowDown",
        color: t.type === "buy" ? "lime" : "red",
        text: "",
      });
      if (t.result) {
        markers.push({
          time: t.exitTime as any,
          position: "belowBar",
          shape: "circle",
          color: t.result === "win" ? "lime" : "red",
          text: "",
        });
      }
    });
    try {
      seriesRef.current.setMarkers(markers);
    } catch (e) {
      console.log("Markers not supported in this version");
    }
  }, [trades]);

  return (
    <div className="w-full h-full bg-[#0c1e3e] flex flex-col">
      <div ref={containerRef} className="flex-1 w-full" data-testid="otc-chart" />

      {trades.length > 0 && (
        <div className="mt-4 bg-[#1a2847] rounded-lg p-4 max-h-40 overflow-y-auto">
          <h3 className="text-white font-bold mb-3">الصفقات المفتوحة</h3>
          <div className="space-y-2">
            {trades.map((t) => (
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
                  <span className="text-gray-300">
                    انتهاء: <span className="text-white font-mono">{new Date(t.exitTime * 1000).toLocaleTimeString('ar-SA')}</span>
                  </span>
                </div>
                <span className={`px-3 py-1 rounded font-semibold ${
                  !t.result ? 'bg-blue-600 text-white' : 
                  t.result === 'win' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}>
                  {!t.result ? 'قيد التنفيذ' : t.result === 'win' ? 'ربح' : 'خسارة'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

OtcChart.displayName = "OtcChart";

export default OtcChart;
