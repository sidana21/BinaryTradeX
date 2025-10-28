import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData, CandlestickSeries } from "lightweight-charts";
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
  openTrades?: any[]; // صفقات مفتوحة من قاعدة البيانات
}

export interface OtcChartRef {
  getCurrentPrice: () => number;
  placeTrade: (type: "buy" | "sell") => void;
}

const OtcChart = forwardRef<OtcChartRef, OtcChartProps>(({ pair = "EURUSD", duration = 60, onPriceUpdate, openTrades = [] }, ref) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [lastPrice, setLastPrice] = useState(0);
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));
  const [showHistory, setShowHistory] = useState(false);
  const [updateInterval, setUpdateInterval] = useState<number>(60); // ✅ Use 60s like server
  const [activeIndicators, setActiveIndicators] = useState<Indicator[]>([]);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<any>(null);
  const [selectedDrawing, setSelectedDrawing] = useState<number | null>(null);
  const [dragHandle, setDragHandle] = useState<'start' | 'end' | 'move' | null>(null);
  const [dragOffset, setDragOffset] = useState<{x: number, y: number}>({x: 0, y: 0});
  
  // Sync state with refs
  useEffect(() => {
    drawingsRef.current = drawings;
  }, [drawings]);
  
  useEffect(() => {
    currentDrawingRef.current = currentDrawing;
  }, [currentDrawing]);
  
  useEffect(() => {
    selectedDrawingRef.current = selectedDrawing;
  }, [selectedDrawing]);
  
  useEffect(() => {
    dragHandleRef.current = dragHandle;
  }, [dragHandle]);
  
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  const [tradeNotifications, setTradeNotifications] = useState<Array<{
    id: number;
    result: 'win' | 'lose';
    profit: string;
    timestamp: number;
  }>>([]);

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
  const isPairChangeRef = useRef(false); // Flag to track when pair changes
  const isDbLoadedRef = useRef(false); // Flag to track if DB data has been loaded
  
  // Refs for drawing state to avoid stale closures
  const drawingsRef = useRef<any[]>([]);
  const currentDrawingRef = useRef<any>(null);
  const selectedDrawingRef = useRef<number | null>(null);
  const dragHandleRef = useRef<'start' | 'end' | 'move' | null>(null);
  const activeToolRef = useRef<string | null>(null);
  
  // Store candles for each pair separately
  const pairCandlesRef = useRef<Record<string, {
    buffer: CandlestickData[];
    currentCandle: CandlestickData | null;
    candleStartTime: number;
  }>>({});

  // Save chart data to localStorage periodically
  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (candleBufferRef.current.length > 0) {
        const chartData = {
          pair,
          buffer: candleBufferRef.current.slice(-300), // Save last 300 candles
          currentCandle: currentCandleRef.current,
          candleStartTime: candleStartTimeRef.current,
          timestamp: Date.now(),
        };
        try {
          localStorage.setItem(`chart_${pair}`, JSON.stringify(chartData));
        } catch (e) {
          console.error('Error saving chart data:', e);
        }
      }
    }, 5000); // Save every 5 seconds

    return () => clearInterval(saveInterval);
  }, [pair]);

  // Load chart data from localStorage on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(`chart_${pair}`);
      if (savedData) {
        const chartData = JSON.parse(savedData);
        const age = Date.now() - chartData.timestamp;
        
        // Only use saved data if it's less than 10 minutes old
        if (age < 10 * 60 * 1000 && chartData.buffer && chartData.buffer.length > 0) {
          console.log('Restored', chartData.buffer.length, 'candles from localStorage for', pair);
          pairCandlesRef.current[pair] = {
            buffer: chartData.buffer,
            currentCandle: chartData.currentCandle,
            candleStartTime: chartData.candleStartTime,
          };
        }
      }
    } catch (e) {
      console.error('Error loading chart data:', e);
    }
  }, []);


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

  // Load open trades from database on mount or when openTrades change
  useEffect(() => {
    if (openTrades && openTrades.length > 0) {
      // تحويل الصفقات من قاعدة البيانات إلى صيغة Trade المحلية
      const convertedTrades: Trade[] = openTrades.map((dbTrade) => ({
        id: dbTrade.id,
        type: dbTrade.type === 'CALL' ? 'buy' : 'sell',
        assetId: dbTrade.assetId,
        entryPrice: parseFloat(dbTrade.openPrice),
        entryTime: Math.floor(new Date(dbTrade.createdAt).getTime() / 1000),
        exitTime: Math.floor(new Date(dbTrade.expiryTime).getTime() / 1000),
      }));
      
      setTrades(prevTrades => {
        // أضف الصفقات الجديدة من قاعدة البيانات فقط (تجنب التكرار)
        const existingIds = new Set(prevTrades.map(t => t.id));
        const newDbTrades = convertedTrades.filter(ct => !existingIds.has(ct.id));
        
        return [...prevTrades, ...newDbTrades];
      });
      
      console.log('Loaded', convertedTrades.length, 'open trades from database');
    }
  }, [openTrades]);

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

    // 🚀 IMMEDIATE INITIAL DATA LOAD (like Pocket Option)
    console.log(`⚡ Loading initial data for ${pair}`);
    fetch(`/api/price-data/${pair}_OTC/with-current`)
      .then(res => {
        console.log(`📡 API Response received for ${pair}`);
        return res.json();
      })
      .then(data => {
        const { candles, currentCandle, candleInterval } = data;
        console.log(`🎯 INITIAL LOAD: ${candles?.length || 0} candles for ${pair}`);
        
        if (candles && candles.length > 0) {
          const uniqueCandles = candles.reduce((acc: CandlestickData[], current: CandlestickData) => {
            const exists = acc.find(c => c.time === current.time);
            if (!exists) acc.push(current);
            return acc;
          }, []).sort((a: CandlestickData, b: CandlestickData) => {
            const timeA = typeof a.time === 'number' ? a.time : (a.time as any).timestamp || 0;
            const timeB = typeof b.time === 'number' ? b.time : (b.time as any).timestamp || 0;
            return timeA - timeB;
          });
          
          candleBufferRef.current = uniqueCandles;
          console.log(`✅ Buffer set: ${uniqueCandles.length} candles`);
          
          if (currentCandle) {
            currentCandleRef.current = {
              time: currentCandle.startTime as any,
              open: currentCandle.open,
              high: currentCandle.high,
              low: currentCandle.low,
              close: currentCandle.close,
            };
            candleStartTimeRef.current = currentCandle.startTime;
            console.log(`♻️ Current candle: ${currentCandle.close}`);
          }
          
          const allCandles = currentCandleRef.current 
            ? [...uniqueCandles, currentCandleRef.current]
            : uniqueCandles;
          
          console.log(`🎨 DISPLAYING ${allCandles.length} CANDLES NOW!`);
          candleSeries.setData(allCandles);
          setLastPrice(currentCandleRef.current?.close || uniqueCandles[uniqueCandles.length - 1].close);
          
          setTimeout(() => {
            chart.timeScale().scrollToRealTime();
            console.log(`📍 Scrolled to latest candle`);
          }, 100);
        } else {
          console.log(`⚠️ No candles received for ${pair}`);
        }
        
        isDbLoadedRef.current = true;
        console.log(`✅ DB load complete for ${pair}`);
      })
      .catch(err => {
        console.error(`❌ Initial load error for ${pair}:`, err);
        isDbLoadedRef.current = true;
      });

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
          
          // DETECT PAIR CHANGE - Load 100 candles immediately!
          if (tick.pair === currentPairRef.current && !isDbLoadedRef.current) {
            console.log(`🎯 LOADING 100 CANDLES for ${tick.pair} NOW!`);
            fetch(`/api/price-data/${tick.pair}_OTC/with-current`)
              .then(res => res.json())
              .then(data => {
                const { candles, currentCandle, candleInterval } = data;
                console.log(`✅ GOT ${candles?.length || 0} CANDLES!`);
                
                if (candleInterval && candleInterval !== updateInterval) {
                  setUpdateInterval(candleInterval);
                }
                
                if (candles && candles.length > 0) {
                  const uniqueCandles = candles.reduce((acc: CandlestickData[], current: CandlestickData) => {
                    const exists = acc.find(c => c.time === current.time);
                    if (!exists) acc.push(current);
                    return acc;
                  }, []).sort((a: CandlestickData, b: CandlestickData) => {
                    const timeA = typeof a.time === 'number' ? a.time : (a.time as any).timestamp || 0;
                    const timeB = typeof b.time === 'number' ? b.time : (b.time as any).timestamp || 0;
                    return timeA - timeB;
                  });
                  
                  candleBufferRef.current = uniqueCandles;
                  
                  if (currentCandle) {
                    currentCandleRef.current = {
                      time: currentCandle.startTime as any,
                      open: currentCandle.open,
                      high: currentCandle.high,
                      low: currentCandle.low,
                      close: currentCandle.close,
                    };
                    candleStartTimeRef.current = currentCandle.startTime;
                  } else {
                    currentCandleRef.current = null;
                    const lastCandle = uniqueCandles[uniqueCandles.length - 1];
                    const lastCandleTime = typeof lastCandle.time === 'number' ? lastCandle.time : (lastCandle.time as any).timestamp || 0;
                    candleStartTimeRef.current = lastCandleTime;
                  }
                  
                  if (seriesRef.current) {
                    const allCandles = currentCandleRef.current 
                      ? [...uniqueCandles, currentCandleRef.current]
                      : uniqueCandles;
                    
                    console.log(`📊 DISPLAYING ${allCandles.length} CANDLES ON CHART!`);
                    seriesRef.current.setData(allCandles);
                    setLastPrice(currentCandleRef.current?.close || uniqueCandles[uniqueCandles.length - 1].close);
                    
                    if (chartRef.current) {
                      setTimeout(() => chartRef.current?.timeScale().scrollToRealTime(), 100);
                    }
                  }
                }
                
                isDbLoadedRef.current = true;
              })
              .catch(err => {
                console.error(`❌ Error loading candles:`, err);
                isDbLoadedRef.current = true;
              });
            return;
          }
          
          if (tick.pair === currentPairRef.current) {
            // Wait for DB data to load before processing ticks
            if (!isDbLoadedRef.current) {
              return;
            }
            
            const currentTime = tick.time;
            const price = tick.price;
            
            // Ignore ticks that are older than the last candle in buffer
            if (candleBufferRef.current.length > 0) {
              const lastCandle = candleBufferRef.current[candleBufferRef.current.length - 1];
              const lastCandleTime = typeof lastCandle.time === 'number' ? lastCandle.time : (lastCandle.time as any).timestamp || 0;
              if (currentTime < lastCandleTime) {
                console.log('Ignoring old tick:', currentTime, '< last candle:', lastCandleTime);
                return;
              }
            }
            
            // Check if we need to start a new candle based on updateInterval
            if (!currentCandleRef.current || (currentTime - candleStartTimeRef.current) >= updateInterval) {
              // Get the opening price for the new candle
              let openPrice = price;
              
              // Save previous candle if exists
              if (currentCandleRef.current) {
                // Use the close price of the previous candle as the open price for the new candle
                openPrice = currentCandleRef.current.close;
                
                candleBufferRef.current.push(currentCandleRef.current);
                
                // Keep last 300 candles to maintain chart history across refreshes
                if (candleBufferRef.current.length > 300) {
                  candleBufferRef.current = candleBufferRef.current.slice(-300);
                }
              } else if (candleBufferRef.current.length > 0) {
                // If no current candle but we have buffer (loaded from DB), use last close price
                const lastBufferedCandle = candleBufferRef.current[candleBufferRef.current.length - 1];
                openPrice = lastBufferedCandle.close;
                console.log('Using last DB candle close as starting point:', openPrice);
              }
              // Otherwise start fresh with current WebSocket price
              
              // Reset pair change flag after first candle
              if (isPairChangeRef.current) {
                isPairChangeRef.current = false;
              }
              
              // Start new candle with continuity
              candleStartTimeRef.current = currentTime;
              currentCandleRef.current = {
                time: currentTime as any,
                open: openPrice,
                high: Math.max(openPrice, price),
                low: Math.min(openPrice, price),
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
            
            seriesRef.current?.setData(allCandles);
            
            // Auto-scroll to the latest candle (rightmost position)
            if (chartRef.current && allCandles.length > 0) {
              chartRef.current.timeScale().scrollToRealTime();
            }
            
            setLastPrice(price);
            onPriceUpdate?.(price);

            // تحديث نتائج الصفقات
            setTrades((old) => {
              const updated = old.map((t): Trade => {
                if (!t.result && currentTime >= t.exitTime) {
                  const result: "win" | "lose" = (t.type === "buy" && price > t.entryPrice) ||
                    (t.type === "sell" && price < t.entryPrice)
                    ? "win"
                    : "lose";
                  
                  const profit = result === 'win' ? '+$82.00' : '-$100.00';
                  
                  // إضافة إشعار
                  setTradeNotifications(prev => [...prev, {
                    id: t.id,
                    result,
                    profit,
                    timestamp: Date.now()
                  }]);
                  
                  // إزالة الإشعار بعد 2.5 ثانية
                  setTimeout(() => {
                    setTradeNotifications(prev => prev.filter(n => n.id !== t.id));
                  }, 2500);
                  
                  return {
                    ...t,
                    exitPrice: price,
                    result,
                  };
                }
                return t;
              });
              return updated;
            });
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

  // Load candles when pair changes - FORCE LOAD 100 CANDLES
  useEffect(() => {
    const timestamp = Date.now();
    console.log(`[${timestamp}] 🔥 PAIR CHANGED TO: ${pair}`);
    
    currentPairRef.current = pair;
    isPairChangeRef.current = true;
    isDbLoadedRef.current = false;
    
    // Clear old data immediately
    candleBufferRef.current = [];
    currentCandleRef.current = null;
    
    // Wait for seriesRef to be ready
    if (!seriesRef.current) {
      console.log(`[${timestamp}] ⏳ Chart not ready, waiting...`);
      const checkInterval = setInterval(() => {
        if (seriesRef.current) {
          clearInterval(checkInterval);
          console.log(`[${timestamp}] ✅ Chart ready, loading data...`);
          loadDataForPair();
        }
      }, 50);
      return () => clearInterval(checkInterval);
    }
    
    console.log(`[${timestamp}] ✅ Chart ready, loading data immediately...`);
    loadDataForPair();
    
    function loadDataForPair() {
      const loadStart = Date.now();
      console.log(`[${loadStart}] 📡 FETCHING /api/price-data/${pair}_OTC/with-current`);
      
      fetch(`/api/price-data/${pair}_OTC/with-current`)
        .then(res => {
          console.log(`[${Date.now()}] ✅ API Response received for ${pair}`);
          return res.json();
        })
        .then(data => {
          const { candles, currentCandle, candleInterval } = data;
          console.log(`[${Date.now()}] 🎯 GOT DATA: ${candles?.length || 0} candles, current: ${currentCandle ? 'YES' : 'NO'}`);
          
          if (candleInterval && candleInterval !== updateInterval) {
            setUpdateInterval(candleInterval);
          }
          
          if (candles && candles.length > 0) {
            const uniqueCandles = candles.reduce((acc: CandlestickData[], current: CandlestickData) => {
              const exists = acc.find(c => c.time === current.time);
              if (!exists) acc.push(current);
              return acc;
            }, []).sort((a: CandlestickData, b: CandlestickData) => {
              const timeA = typeof a.time === 'number' ? a.time : (a.time as any).timestamp || 0;
              const timeB = typeof b.time === 'number' ? b.time : (b.time as any).timestamp || 0;
              return timeA - timeB;
            });
            
            candleBufferRef.current = uniqueCandles;
            console.log(`[${Date.now()}] 💾 Stored ${uniqueCandles.length} candles in buffer`);
            
            if (currentCandle) {
              currentCandleRef.current = {
                time: currentCandle.startTime as any,
                open: currentCandle.open,
                high: currentCandle.high,
                low: currentCandle.low,
                close: currentCandle.close,
              };
              candleStartTimeRef.current = currentCandle.startTime;
              console.log(`[${Date.now()}] 📍 Current candle: ${currentCandle.close}`);
            } else {
              currentCandleRef.current = null;
              const lastCandle = uniqueCandles[uniqueCandles.length - 1];
              const lastCandleTime = typeof lastCandle.time === 'number' ? lastCandle.time : (lastCandle.time as any).timestamp || 0;
              candleStartTimeRef.current = lastCandleTime;
            }
            
            const finalCandles = currentCandleRef.current 
              ? [...uniqueCandles, currentCandleRef.current]
              : uniqueCandles;
            
            if (seriesRef.current) {
              console.log(`[${Date.now()}] 🎨 RENDERING ${finalCandles.length} CANDLES TO CHART!!!`);
              seriesRef.current.setData(finalCandles);
              setLastPrice(currentCandleRef.current?.close || uniqueCandles[uniqueCandles.length - 1].close);
              
              if (chartRef.current) {
                setTimeout(() => {
                  chartRef.current?.timeScale().scrollToRealTime();
                  console.log(`[${Date.now()}] 📍 Auto-scrolled to latest candle`);
                }, 100);
              }
            }
            
            console.log(`[${Date.now()}] ✅✅✅ ${pair} FULLY LOADED WITH ${finalCandles.length} CANDLES! ✅✅✅`);
          } else {
            console.log(`[${Date.now()}] ⚠️ NO DATA RECEIVED for ${pair}`);
            candleBufferRef.current = [];
            currentCandleRef.current = null;
            candleStartTimeRef.current = 0;
            if (seriesRef.current) {
              seriesRef.current.setData([]);
              setLastPrice(0);
            }
          }
          
          isDbLoadedRef.current = true;
        })
        .catch(err => {
          console.error(`[${Date.now()}] ❌❌❌ ERROR loading ${pair}:`, err);
          candleBufferRef.current = [];
          currentCandleRef.current = null;
          candleStartTimeRef.current = 0;
          if (seriesRef.current) {
            seriesRef.current.setData([]);
            setLastPrice(0);
          }
          isDbLoadedRef.current = true;
        });
    }
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

    // Draw indicators with better visibility
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
          case 'rsi':
            values = calculateRSI(closePrices, indicator.period || 14);
            break;
          case 'bb':
            const bbData = calculateBollingerBands(closePrices, indicator.period || 20);
            // Draw all three BB lines
            ['upper', 'middle', 'lower'].forEach((line, idx) => {
              const lineValues = line === 'upper' ? bbData.upper : line === 'middle' ? bbData.middle : bbData.lower;
              ctx.strokeStyle = indicator.color || '#FFC107';
              ctx.lineWidth = line === 'middle' ? 2 : 1;
              ctx.setLineDash(line === 'middle' ? [] : [5, 5]);
              ctx.globalAlpha = line === 'middle' ? 1 : 0.6;
              ctx.beginPath();
              
              let started = false;
              candleBufferRef.current.forEach((candle, i) => {
                if (isNaN(lineValues[i]) || lineValues[i] === 0) return;
                const x = timeScale.timeToCoordinate(candle.time);
                const y = seriesRef.current?.priceToCoordinate(lineValues[i]);
                if (x === null || y === null || y === undefined) return;
                if (!started) {
                  ctx.moveTo(x, y);
                  started = true;
                } else {
                  ctx.lineTo(x, y);
                }
              });
              
              ctx.stroke();
              ctx.globalAlpha = 1;
              ctx.setLineDash([]);
            });
            return; // Skip the regular drawing below
        }

        if (values.length === 0) return;

        // Draw the indicator line with glow effect for better visibility
        ctx.save();
        ctx.shadowColor = indicator.color || '#2196F3';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = indicator.color || '#2196F3';
        ctx.lineWidth = 3;
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
        ctx.restore();
        
        // Add indicator label at the top
        ctx.fillStyle = indicator.color || '#2196F3';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(indicator.name, 10, 30 + (activeIndicators.indexOf(indicator) * 20));
      });
    }

    // Draw user drawings with better visibility and handles
    [...drawings, currentDrawing].filter(Boolean).forEach((drawing, drawingIndex) => {
      if (!drawing) return;
      
      const isCurrentDrawing = drawing === currentDrawing;
      const isSelected = selectedDrawing === drawingIndex;
      
      // Draw with shadow for better visibility
      ctx.save();
      ctx.shadowColor = isSelected ? '#22c55e' : '#2196F3';
      ctx.shadowBlur = (isCurrentDrawing || isSelected) ? 15 : 8;
      ctx.strokeStyle = isSelected ? '#22c55e' : (isCurrentDrawing ? '#22c55e' : '#2196F3');
      ctx.lineWidth = (isCurrentDrawing || isSelected) ? 3 : 2;
      ctx.setLineDash([]);

      switch (drawing.type) {
        case 'trendline':
          ctx.beginPath();
          ctx.moveTo(drawing.startX, drawing.startY);
          ctx.lineTo(drawing.endX, drawing.endY);
          ctx.stroke();
          
          // Draw handle circles - always show for trendlines
          if (!isCurrentDrawing) {
            // Start handle
            ctx.fillStyle = isSelected ? '#22c55e' : '#2196F3';
            ctx.shadowColor = isSelected ? '#22c55e' : '#2196F3';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(drawing.startX, drawing.startY, isSelected ? 8 : 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // End handle
            ctx.fillStyle = isSelected ? '#22c55e' : '#2196F3';
            ctx.beginPath();
            ctx.arc(drawing.endX, drawing.endY, isSelected ? 8 : 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          break;

        case 'horizontal':
          ctx.beginPath();
          ctx.moveTo(0, drawing.startY);
          ctx.lineTo(canvas.width, drawing.startY);
          ctx.stroke();
          
          // Add price label
          if (!isCurrentDrawing && seriesRef.current) {
            const price = seriesRef.current.coordinateToPrice(drawing.startY);
            if (price !== null) {
              ctx.fillStyle = '#2196F3';
              ctx.fillRect(canvas.width - 80, drawing.startY - 12, 75, 24);
              ctx.fillStyle = '#fff';
              ctx.font = 'bold 12px Arial';
              ctx.textAlign = 'right';
              ctx.fillText(price.toFixed(5), canvas.width - 5, drawing.startY + 4);
            }
          }
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
          
          // Fill with semi-transparent color
          const fillColor = isSelected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(33, 150, 243, 0.1)';
          ctx.fillStyle = fillColor;
          ctx.fillRect(drawing.startX, drawing.startY, width, height);
          
          // Draw corner handles if selected
          if (isSelected && !isCurrentDrawing) {
            const handleSize = 8;
            ctx.fillStyle = '#22c55e';
            ctx.shadowColor = '#22c55e';
            ctx.shadowBlur = 10;
            
            // Top-left
            ctx.fillRect(drawing.startX - handleSize/2, drawing.startY - handleSize/2, handleSize, handleSize);
            // Top-right
            ctx.fillRect(drawing.endX - handleSize/2, drawing.startY - handleSize/2, handleSize, handleSize);
            // Bottom-left
            ctx.fillRect(drawing.startX - handleSize/2, drawing.endY - handleSize/2, handleSize, handleSize);
            // Bottom-right
            ctx.fillRect(drawing.endX - handleSize/2, drawing.endY - handleSize/2, handleSize, handleSize);
          }
          break;

        case 'fibonacci':
          const fibHeight = drawing.endY - drawing.startY;
          const fibLevels = [
            { level: 0, label: '0%', color: '#2196F3' },
            { level: 0.236, label: '23.6%', color: '#FFC107' },
            { level: 0.382, label: '38.2%', color: '#FFC107' },
            { level: 0.5, label: '50%', color: '#FF9800' },
            { level: 0.618, label: '61.8%', color: '#FFC107' },
            { level: 0.786, label: '78.6%', color: '#FFC107' },
            { level: 1, label: '100%', color: '#2196F3' }
          ];
          
          fibLevels.forEach(fib => {
            const y = drawing.startY + (fibHeight * fib.level);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.strokeStyle = fib.color;
            ctx.lineWidth = fib.level === 0 || fib.level === 1 ? 2 : 1;
            ctx.setLineDash(fib.level === 0 || fib.level === 1 ? [] : [5, 3]);
            ctx.stroke();
            
            // Label
            ctx.fillStyle = fib.color;
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(fib.label, 10, y - 5);
            
            // Price label on the right
            if (seriesRef.current) {
              const price = seriesRef.current.coordinateToPrice(y);
              if (price !== null) {
                ctx.textAlign = 'right';
                ctx.fillText(price.toFixed(5), canvas.width - 10, y - 5);
              }
            }
          });
          
          // Draw handles if selected
          if (isSelected && !isCurrentDrawing) {
            ctx.fillStyle = '#22c55e';
            ctx.shadowColor = '#22c55e';
            ctx.shadowBlur = 10;
            
            // Start handle
            ctx.beginPath();
            ctx.arc(10, drawing.startY, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // End handle
            ctx.beginPath();
            ctx.arc(10, drawing.endY, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          break;
      }
      
      ctx.restore();
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

  // وظائف تحويل الإحداثيات للأدوات التفاعلية
  const timeToX = (time: number): number | null => {
    if (!chartRef.current) return null;
    const timeScale = chartRef.current.timeScale();
    return timeScale.timeToCoordinate(time as any);
  };

  const priceToY = (price: number): number | null => {
    if (!seriesRef.current) return null;
    return seriesRef.current.priceToCoordinate(price);
  };

  const xToTime = (x: number): number | null => {
    if (!chartRef.current) return null;
    const timeScale = chartRef.current.timeScale();
    const time = timeScale.coordinateToTime(x);
    return time ? (time as number) : null;
  };

  const yToPrice = (y: number): number | null => {
    if (!seriesRef.current) return null;
    return seriesRef.current.coordinateToPrice(y);
  };

  const handleDrawingComplete = () => {
    setActiveTool(null);
  };

  // Check if point is near a coordinate (for handle detection)
  const isNearPoint = (px: number, py: number, x: number, y: number, threshold = 15) => {
    return Math.sqrt((px - x) ** 2 + (py - y) ** 2) < threshold;
  };

  // Check if point is near a line
  const isNearLine = (px: number, py: number, x1: number, y1: number, x2: number, y2: number, threshold = 10) => {
    const lineLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    if (lineLength === 0) return isNearPoint(px, py, x1, y1, threshold);
    
    const t = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / (lineLength ** 2)));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2) < threshold;
  };

  // Handle canvas mouse events for drawing and editing
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // If we have an active drawing tool, start new drawing
    if (activeToolRef.current) {
      const newDrawing = {
        type: activeToolRef.current,
        startX: x,
        startY: y,
        endX: x,
        endY: y,
      };
      currentDrawingRef.current = newDrawing;
      setCurrentDrawing(newDrawing);
      return;
    }

    // Check if clicking on existing drawing handles or lines
    for (let i = drawingsRef.current.length - 1; i >= 0; i--) {
      const drawing = drawingsRef.current[i];
      
      // Check start handle
      if (isNearPoint(x, y, drawing.startX, drawing.startY)) {
        setSelectedDrawing(i);
        setDragHandle('start');
        return;
      }
      
      // Check end handle (for trendline, rectangle, fibonacci)
      if (['trendline', 'rectangle', 'fibonacci'].includes(drawing.type)) {
        if (isNearPoint(x, y, drawing.endX, drawing.endY)) {
          setSelectedDrawing(i);
          setDragHandle('end');
          return;
        }
      }
      
      // Check if clicking on the line/shape itself
      if (drawing.type === 'trendline') {
        if (isNearLine(x, y, drawing.startX, drawing.startY, drawing.endX, drawing.endY)) {
          setSelectedDrawing(i);
          setDragHandle('move');
          setDragOffset({
            x: x - drawing.startX,
            y: y - drawing.startY
          });
          return;
        }
      } else if (drawing.type === 'horizontal') {
        if (Math.abs(y - drawing.startY) < 10) {
          setSelectedDrawing(i);
          setDragHandle('move');
          setDragOffset({ x: 0, y: y - drawing.startY });
          return;
        }
      } else if (drawing.type === 'vertical') {
        if (Math.abs(x - drawing.startX) < 10) {
          setSelectedDrawing(i);
          setDragHandle('move');
          setDragOffset({ x: x - drawing.startX, y: 0 });
          return;
        }
      } else if (drawing.type === 'rectangle' || drawing.type === 'fibonacci') {
        const minX = Math.min(drawing.startX, drawing.endX);
        const maxX = Math.max(drawing.startX, drawing.endX);
        const minY = Math.min(drawing.startY, drawing.endY);
        const maxY = Math.max(drawing.startY, drawing.endY);
        
        if (x >= minX - 10 && x <= maxX + 10 && y >= minY - 10 && y <= maxY + 10) {
          setSelectedDrawing(i);
          setDragHandle('move');
          setDragOffset({
            x: x - drawing.startX,
            y: y - drawing.startY
          });
          return;
        }
      }
    }
    
    // Deselect if clicking on empty space
    setSelectedDrawing(null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Handle new drawing
    if (currentDrawingRef.current) {
      const updatedDrawing = {
        ...currentDrawingRef.current,
        endX: x,
        endY: y,
      };
      currentDrawingRef.current = updatedDrawing;
      setCurrentDrawing(updatedDrawing);
      return;
    }

    // Handle editing existing drawing
    if (selectedDrawingRef.current !== null && dragHandleRef.current) {
      const newDrawings = [...drawingsRef.current];
      const drawing = newDrawings[selectedDrawingRef.current];

      if (dragHandleRef.current === 'start') {
        drawing.startX = x;
        drawing.startY = y;
      } else if (dragHandleRef.current === 'end') {
        drawing.endX = x;
        drawing.endY = y;
      } else if (dragHandleRef.current === 'move') {
        if (drawing.type === 'horizontal') {
          drawing.startY = y - dragOffset.y;
        } else if (drawing.type === 'vertical') {
          drawing.startX = x - dragOffset.x;
        } else {
          const deltaX = x - dragOffset.x - drawing.startX;
          const deltaY = y - dragOffset.y - drawing.startY;
          
          drawing.startX += deltaX;
          drawing.startY += deltaY;
          if (drawing.endX !== undefined) drawing.endX += deltaX;
          if (drawing.endY !== undefined) drawing.endY += deltaY;
        }
      }

      drawingsRef.current = newDrawings;
      setDrawings(newDrawings);
    }
  };

  const handleCanvasMouseUp = () => {
    // Finish new drawing
    if (currentDrawingRef.current) {
      const newDrawings = [...drawingsRef.current, currentDrawingRef.current];
      drawingsRef.current = newDrawings;
      setDrawings(newDrawings);
      currentDrawingRef.current = null;
      setCurrentDrawing(null);
      activeToolRef.current = null;
      setActiveTool(null);
    }
    
    // Finish editing
    dragHandleRef.current = null;
    setDragHandle(null);
  };

  // Handle double-click to delete drawing
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if double-clicking on any drawing
    for (let i = drawingsRef.current.length - 1; i >= 0; i--) {
      const drawing = drawingsRef.current[i];
      
      // Check if clicking on the drawing
      let shouldDelete = false;
      
      if (drawing.type === 'trendline') {
        shouldDelete = isNearLine(x, y, drawing.startX, drawing.startY, drawing.endX, drawing.endY, 15);
      } else if (drawing.type === 'horizontal') {
        shouldDelete = Math.abs(y - drawing.startY) < 15;
      } else if (drawing.type === 'vertical') {
        shouldDelete = Math.abs(x - drawing.startX) < 15;
      } else if (drawing.type === 'rectangle' || drawing.type === 'fibonacci') {
        const minX = Math.min(drawing.startX, drawing.endX);
        const maxX = Math.max(drawing.startX, drawing.endX);
        const minY = Math.min(drawing.startY, drawing.endY);
        const maxY = Math.max(drawing.startY, drawing.endY);
        shouldDelete = x >= minX - 15 && x <= maxX + 15 && y >= minY - 15 && y <= maxY + 15;
      }
      
      if (shouldDelete) {
        // Remove the drawing
        const newDrawings = drawingsRef.current.filter((_, index) => index !== i);
        drawingsRef.current = newDrawings;
        setDrawings(newDrawings);
        console.log('Drawing deleted:', drawing.type);
        return;
      }
    }
  };

  // Clear all drawings
  const handleClearAllDrawings = () => {
    drawingsRef.current = [];
    setDrawings([]);
    console.log('All drawings cleared');
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
      <div className="relative z-20">
        <ChartIndicators
          onIndicatorToggle={handleIndicatorToggle}
          onDrawingToolSelect={handleDrawingToolSelect}
          activeIndicators={activeIndicators}
        />
      </div>
      
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
        
        {/* Canvas overlay for drawing indicators and user drawings */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-10"
          style={{ pointerEvents: activeTool ? 'auto' : 'none', cursor: activeTool ? 'crosshair' : 'default' }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onDoubleClick={handleCanvasDoubleClick}
        />
        
        {/* Clear All Drawings Button - Show when there are drawings */}
        {drawings.length > 0 && (
          <button
            onClick={handleClearAllDrawings}
            className="absolute top-2 left-2 z-20 bg-red-600/90 hover:bg-red-700/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg transition-colors flex items-center gap-2"
            title="مسح كل الرسومات"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-white text-sm font-medium">مسح الكل</span>
          </button>
        )}
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

      {/* Trade Result Notifications - Pocket Option Style */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 flex flex-col gap-2">
        {tradeNotifications.map((notification) => {
          const age = Date.now() - notification.timestamp;
          const opacity = Math.max(0, 1 - age / 2500);
          const translateY = Math.min(0, -20 + (age / 2500) * 20);
          
          return (
            <div 
              key={notification.id}
              className={`
                px-8 py-4 rounded-xl shadow-2xl backdrop-blur-md transform transition-all duration-300
                ${notification.result === 'win' 
                  ? 'bg-gradient-to-r from-green-500/95 to-green-600/95' 
                  : 'bg-gradient-to-r from-red-500/95 to-red-600/95'
                }
              `}
              style={{
                opacity,
                transform: `translateY(${translateY}px) scale(${0.95 + opacity * 0.05})`,
              }}
            >
              <div className="flex items-center gap-4">
                {notification.result === 'win' ? (
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
                <div className="text-white">
                  <div className="text-2xl font-black tracking-tight">
                    {notification.result === 'win' ? 'ربح!' : 'خسارة'}
                  </div>
                  <div className="text-xl font-bold mt-1">
                    {notification.profit}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
