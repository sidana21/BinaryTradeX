import { useEffect, useRef, useState } from "react";
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

export default function OtcChart() {
  const [pair, setPair] = useState("EURUSD");
  const [duration, setDuration] = useState(60);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [lastPrice, setLastPrice] = useState(0);

  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const tradeIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

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

    const basePrices: Record<string, number> = {
      "EURUSD": 1.1000,
      "USDJPY": 149.300,
      "GBPUSD": 1.2500,
    };
    
    const basePrice = basePrices[pair] || 1.1000;
    const now = Math.floor(Date.now() / 1000);
    
    const initialCandles: CandlestickData[] = [];
    for (let i = 20; i > 0; i--) {
      const time = now - (i * 60);
      const variation = (Math.random() - 0.5) * 0.01;
      const open = basePrice + variation;
      const close = basePrice + (Math.random() - 0.5) * 0.01;
      initialCandles.push({
        time: time as any,
        open,
        high: Math.max(open, close) * 1.002,
        low: Math.min(open, close) * 0.998,
        close,
      });
    }
    
    candleSeries.setData(initialCandles);
    setLastPrice(initialCandles[initialCandles.length - 1].close);

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

  function placeTrade(type: "buy" | "sell") {
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
  }

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

    </div>
  );
}
