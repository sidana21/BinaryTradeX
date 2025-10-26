import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData, CandlestickSeries, createSeriesMarkers, LineData } from "lightweight-charts";
import { ChartIndicators, Indicator, DrawingTool, calculateMA, calculateEMA, calculateRSI, calculateBollingerBands } from './chart-indicators';

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
  assetId: string;
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
  const [activeIndicators, setActiveIndicators] = useState<Indicator[]>([]);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<any>(null);

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
  const isMobile = useRef(window.innerWidth < 768);
  const indicatorSeriesRef = useRef<Record<string, any>>({});
  
  // Store candles for each pair separately
  const pairCandlesRef = useRef<Record<string, {
    buffer: CandlestickData[];
    currentCandle: CandlestickData | null;
    candleStartTime: number;
  }>>({});


  useImperativeHandle(ref, () => ({
    getCurrentPrice: () => lastPrice,
    placeTrade: (type: "buy" | "sell") => {
      if (!lastPrice) return;
      const entryTime = Math.floor(Date.now() / 1000);
      const exitTime = entryTime + duration;

      const newTrade: Trade = {
        id: ++tradeIdRef.current,
        type,
        assetId: `${pair}_OTC`,
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
            
            // Auto-scroll to the latest candle (rightmost position)
            if (chartRef.current && allCandles.length > 0) {
              chartRef.current.timeScale().scrollToRealTime();
            }
            
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

  // Load candles from database when pair changes
  useEffect(() => {
    console.log('Chart pair changed to:', pair);
    currentPairRef.current = pair;
    
    // Load candles from database for this asset
    const loadCandles = async () => {
      try {
        const response = await fetch(`/api/price-data/${pair}_OTC?limit=100`);
        if (response.ok) {
          const candles = await response.json();
          console.log('Loaded', candles.length, 'candles from database for', pair);
          
          if (candles.length > 0) {
            // Remove duplicates and sort by time (ascending)
            const uniqueCandles = candles.reduce((acc: CandlestickData[], current: CandlestickData) => {
              const exists = acc.find(c => c.time === current.time);
              if (!exists) {
                acc.push(current);
              }
              return acc;
            }, []).sort((a: CandlestickData, b: CandlestickData) => {
              const timeA = typeof a.time === 'number' ? a.time : (a.time as any).timestamp || 0;
              const timeB = typeof b.time === 'number' ? b.time : (b.time as any).timestamp || 0;
              return timeA - timeB;
            });
            
            candleBufferRef.current = uniqueCandles;
            currentCandleRef.current = null;
            candleStartTimeRef.current = 0;
            
            if (seriesRef.current) {
              seriesRef.current.setData(uniqueCandles);
              const lastCandle = uniqueCandles[uniqueCandles.length - 1];
              setLastPrice(lastCandle.close);
              
              // Auto-scroll to the latest candle after loading data
              if (chartRef.current) {
                setTimeout(() => {
                  chartRef.current?.timeScale().scrollToRealTime();
                }, 100);
              }
            }
          } else {
            // No data in database, start fresh
            candleBufferRef.current = [];
            currentCandleRef.current = null;
            candleStartTimeRef.current = 0;
            if (seriesRef.current) {
              seriesRef.current.setData([]);
              setLastPrice(0);
            }
          }
        }
      } catch (error) {
        console.error('Error loading candles from database:', error);
        // On error, start fresh
        candleBufferRef.current = [];
        currentCandleRef.current = null;
        candleStartTimeRef.current = 0;
        if (seriesRef.current) {
          seriesRef.current.setData([]);
          setLastPrice(0);
        }
      }
    };
    
    loadCandles();
    setTrades([]);
  }, [pair]);

  // Reset current candle when update interval changes
  useEffect(() => {
    console.log('Update interval changed to:', updateInterval);
    
    // Reset only current candle, keep historical data from database
    currentCandleRef.current = null;
    candleStartTimeRef.current = 0;
    // Don't clear candleBufferRef.current - keep historical data
    // Just refresh the chart with existing data
    if (seriesRef.current && candleBufferRef.current.length > 0) {
      seriesRef.current.setData(candleBufferRef.current);
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

    // Draw professional circles with glow for each trade on current asset only
    const currentAssetTrades = trades.filter(t => t.assetId === `${pair}_OTC`);
    currentAssetTrades.forEach((t) => {
      
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

    // Draw indicators
    if (activeIndicators.length > 0 && candleBufferRef.current.length >= 20) {
      const closePrices = candleBufferRef.current.map(candle => candle.close);

      activeIndicators.forEach(indicator => {
        let values: number[] = [];
        
        switch (indicator.type) {
          case 'ma':
            values = calculateMA(closePrices, indicator.period || 20);
            break;
          case 'ema':
            values = calculateEMA(closePrices, indicator.period || 12);
            break;
        }

        if (values.length === 0) return;

        // Draw the indicator line
        ctx.strokeStyle = indicator.color || '#2196F3';
        ctx.lineWidth = 2;
        ctx.beginPath();

        let started = false;
        candleBufferRef.current.forEach((candle, i) => {
          if (isNaN(values[i]) || values[i] === 0) return;

          const x = timeScale.timeToCoordinate(candle.time);
          const y = seriesRef.current?.priceToCoordinate(values[i]);

          if (x === null || y === null || y === undefined) return;

          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        });

        ctx.stroke();
      });
    }

    // Draw user drawings
    [...drawings, currentDrawing].filter(Boolean).forEach(drawing => {
      if (!drawing) return;
      
      ctx.strokeStyle = '#2196F3';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);

      switch (drawing.type) {
        case 'trendline':
          ctx.beginPath();
          ctx.moveTo(drawing.startX, drawing.startY);
          ctx.lineTo(drawing.endX, drawing.endY);
          ctx.stroke();
          break;

        case 'horizontal':
          ctx.beginPath();
          ctx.moveTo(0, drawing.startY);
          ctx.lineTo(canvas.width, drawing.startY);
          ctx.stroke();
          break;

        case 'vertical':
          ctx.beginPath();
          ctx.moveTo(drawing.startX, 0);
          ctx.lineTo(drawing.startX, canvas.height);
          ctx.stroke();
          break;

        case 'rectangle':
          const width = drawing.endX - drawing.startX;
          const height = drawing.endY - drawing.startY;
          ctx.strokeRect(drawing.startX, drawing.startY, width, height);
          break;

        case 'fibonacci':
          const fibHeight = drawing.endY - drawing.startY;
          const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
          fibLevels.forEach(level => {
            const y = drawing.startY + (fibHeight * level);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.strokeStyle = level === 0 || level === 1 ? '#2196F3' : '#FFC107';
            ctx.stroke();
            
            ctx.fillStyle = '#FFC107';
            ctx.font = '12px Arial';
            ctx.fillText(`${(level * 100).toFixed(1)}%`, 10, y - 5);
          });
          break;
      }
    });
  }, [trades, lastPrice, currentTime, activeIndicators, drawings, currentDrawing]);

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

  // Handle indicator toggle
  const handleIndicatorToggle = (indicator: Indicator) => {
    const isActive = activeIndicators.some(ind => ind.id === indicator.id);
    
    if (isActive) {
      // Remove indicator
      setActiveIndicators(activeIndicators.filter(ind => ind.id !== indicator.id));
      // Remove series from chart
      if (indicatorSeriesRef.current[indicator.id]) {
        chartRef.current?.removeSeries(indicatorSeriesRef.current[indicator.id]);
        delete indicatorSeriesRef.current[indicator.id];
      }
    } else {
      // Add indicator
      setActiveIndicators([...activeIndicators, indicator]);
    }
  };

  // Handle drawing tool selection
  const handleDrawingToolSelect = (tool: DrawingTool) => {
    console.log('Drawing tool selected:', tool.name);
    setActiveTool(tool.type);
  };

  // Handle canvas mouse events for drawing
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activeTool || !canvasRef.current || !chartRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentDrawing({
      type: activeTool,
      startX: x,
      startY: y,
      endX: x,
      endY: y,
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentDrawing || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentDrawing({
      ...currentDrawing,
      endX: x,
      endY: y,
    });
  };

  const handleCanvasMouseUp = () => {
    if (!currentDrawing) return;
    
    setDrawings([...drawings, currentDrawing]);
    setCurrentDrawing(null);
    setActiveTool(null); // Reset tool after drawing
  };

  // Draw indicators on canvas overlay
  const drawIndicators = () => {
    if (!canvasRef.current || !chartRef.current || activeIndicators.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const closePrices = candleBufferRef.current.map(candle => candle.close);
    
    if (closePrices.length < 20) return; // Need enough data

    activeIndicators.forEach(indicator => {
      let values: number[] = [];
      
      switch (indicator.type) {
        case 'ma':
          values = calculateMA(closePrices, indicator.period || 20);
          break;
        case 'ema':
          values = calculateEMA(closePrices, indicator.period || 12);
          break;
      }

      if (values.length === 0) return;

      // Draw the indicator line
      ctx.strokeStyle = indicator.color || '#2196F3';
      ctx.lineWidth = 2;
      ctx.beginPath();

      let started = false;
      candleBufferRef.current.forEach((candle, i) => {
        if (isNaN(values[i]) || values[i] === 0) return;

        const timeScale = chartRef.current!.timeScale();
        const priceScale = seriesRef.current!.priceScale();
        
        const x = timeScale.timeToCoordinate(candle.time);
        const y = priceScale.priceToCoordinate(values[i]);

        if (x === null || y === null) return;

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    });
  };

  // Update indicators when candle data changes
  useEffect(() => {
    if (activeIndicators.length > 0 && candleBufferRef.current.length > 0) {
      // Request animation frame to ensure chart is ready
      requestAnimationFrame(() => {
        drawIndicators();
      });
    }
  }, [candleBufferRef.current.length, activeIndicators]);

  // Calculate countdown and profit/loss for active trades on current asset
  const currentAssetTrades = trades.filter(t => t.assetId === `${pair}_OTC`);
  const activeTrades = currentAssetTrades.filter(t => !t.result);
  const completedTrades = currentAssetTrades.filter(t => t.result);

  return (
    <div className="w-full h-full bg-[#0c1e3e] flex flex-col relative">
      {/* Chart Indicators & Drawing Tools */}
      <ChartIndicators
        onIndicatorToggle={handleIndicatorToggle}
        onDrawingToolSelect={handleDrawingToolSelect}
        activeIndicators={activeIndicators}
      />
      
      {/* Update Interval Selector */}
      <div className="absolute top-2 right-2 z-10">
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

      <div className="flex-1 w-full min-h-[350px] relative">
        <div ref={containerRef} className="absolute inset-0" data-testid="otc-chart" />
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 z-10"
          style={{  
            width: '100%', 
            height: '100%',
            pointerEvents: activeTool ? 'auto' : 'none',
            cursor: activeTool ? 'crosshair' : 'default'
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
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
