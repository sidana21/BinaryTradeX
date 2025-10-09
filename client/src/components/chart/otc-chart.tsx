import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries } from "lightweight-charts";

interface Candle {
  pair: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export default function OtcChart({ pair }: { pair: string }) {
  const chartContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainer.current) return;

    const chart = createChart(chartContainer.current, {
      width: chartContainer.current.clientWidth || 800,
      height: 500,
      layout: { background: { color: "#0c1e3e" }, textColor: "white" },
      grid: { vertLines: { color: "#334" }, horzLines: { color: "#334" } },
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'otc_candle') {
        const candle: Candle = message.data;
        if (candle.pair === pair) {
          candleSeries.update({
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          });
        }
      }
    };

    return () => {
      ws.close();
      chart.remove();
    };
  }, [pair]);

  return <div ref={chartContainer} className="rounded-xl shadow-lg" data-testid="otc-chart" />;
}
