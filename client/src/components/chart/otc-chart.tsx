import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, UTCTimestamp } from "lightweight-charts";

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
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainer.current) return;

    try {
      const width = chartContainer.current.clientWidth || 800;
      const chart = createChart(chartContainer.current, {
        width,
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
      
      chartRef.current = chart;
      seriesRef.current = candleSeries;

      // Set initial empty data to show chart
      const initialTime = Math.floor(Date.now() / 1000) as UTCTimestamp;
      const basePrice = pair === "USDJPY" ? 149.3 : pair === "GBPUSD" ? 1.25 : 1.10;
      
      candleSeries.setData([{
        time: initialTime,
        open: basePrice,
        high: basePrice * 1.001,
        low: basePrice * 0.999,
        close: basePrice
      }]);

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onopen = () => {
        console.log('WebSocket connected for OTC chart');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle OTC candle data
          if (message.type === 'otc_candle') {
            const candle: Candle = message.data;
            if (candle.pair === pair && seriesRef.current) {
              seriesRef.current.update({
                time: candle.time as UTCTimestamp,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
              });
            }
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      return () => {
        ws.close();
        chart.remove();
      };
    } catch (error) {
      console.error('Error creating chart:', error);
    }
  }, [pair]);

  return <div ref={chartContainer} className="rounded-xl shadow-lg w-full" style={{ minHeight: '500px' }} data-testid="otc-chart" />;
}
