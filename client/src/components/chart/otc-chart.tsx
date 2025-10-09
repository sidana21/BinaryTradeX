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

interface OtcChartProps {
  assetId: string;
  height?: number;
}

export default function OtcChart({ assetId, height = 500 }: OtcChartProps) {
  const chartContainer = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<any>();

  useEffect(() => {
    if (!chartContainer.current) return;

    const chart = createChart(chartContainer.current, {
      width: chartContainer.current.clientWidth,
      height,
      layout: { background: { color: "#0c1e3e" }, textColor: "white" },
      grid: { vertLines: { color: "#334" }, horzLines: { color: "#334" } },
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries);
    seriesRef.current = candleSeries;

    // Convert asset ID to pair name (e.g., "USDJPY_OTC" -> "USDJPY")
    const pair = assetId.replace('_OTC', '');

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'otc_candle') {
        const candle: Candle = message.data;
        if (candle.pair === pair) {
          const formatted = {
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          };
          seriesRef.current?.update(formatted);
        }
      }
    };

    return () => {
      ws.close();
      chart.remove();
    };
  }, [assetId, height]);

  return <div ref={chartContainer} className="rounded-xl shadow-lg w-full" data-testid="otc-chart" />;
}
