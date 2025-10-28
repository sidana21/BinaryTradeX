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
  openTrades?: any[];
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
  const [updateInterval, setUpdateInterval] = useState<number>(60);
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
  const currentCandleRef = useRef<CandlestickData | null>(null);
  const candleStartTimeRef = useRef<number>(0);
  const isMobile = useRef(window.innerWidth < 768);
  const isPairChangeRef = useRef(false);
  const isDbLoadedRef = useRef(false);
  
  const pairCandlesRef = useRef<Record<string, {
    buffer: CandlestickData[];
    currentCandle: CandlestickData | null;
    candleStartTime: number;
  }>>({});

  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (candleBufferRef.current.length > 0) {
        const chartData = {
          pair,
          buffer: candleBufferRef.current.slice(-300),
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
    }, 5000);

    return () => clearInterval(saveInterval);
  }, [pair]);

  useEffect(() => {
    try {
      const savedData = localStorage.getItem(`chart_${pair}`);
      if (savedData) {
        const chartData = JSON.parse(savedData);
        const age = Date.now() - chartData.timestamp;
        
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

  useEffect(() => {
    if (openTrades && openTrades.length > 0) {
      const convertedTrades: Trade[] = openTrades.map((dbTrade) => ({
        id: dbTrade.id,
        type: dbTrade.type === 'CALL' ? 'buy' : 'sell',
        assetId: dbTrade.assetId,
        entryPrice: parseFloat(dbTrade.openPrice),
        entryTime: Math.floor(new Date(dbTrade.createdAt).getTime() / 1000),
        exitTime: Math.floor(new Date(dbTrade.expiryTime).getTime() / 1000),
      }));
      
      setTrades(prevTrades => {
        const existingIds = new Set(prevTrades.map(t => t.id));
        const newDbTrades = convertedTrades.filter(ct => !existingIds.has(ct.id));
        
        return [...prevTrades, ...newDbTrades];
      });
      
      console.log('Loaded', convertedTrades.length, 'open trades from database');
    }
  }, [openTrades]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
                  // ✅ Filter and validate candles from database
                  const validCandles = candles.filter((c: any) => {
                    return c && 
                           typeof c.open === 'number' && 
                           typeof c.high === 'number' && 
                           typeof c.low === 'number' && 
                           typeof c.close === 'number' &&
                           !isNaN(c.open) &&
                           !isNaN(c.high) &&
                           !isNaN(c.low) &&
                           !isNaN(c.close) &&
                           c.open !== null &&
                           c.high !== null &&
                           c.low !== null &&
                           c.close !== null;
                  });
                  
                  const uniqueCandles = validCandles.reduce((acc: CandlestickData[], current: CandlestickData) => {
                    const exists = acc.find(c => c.time === current.time);
                    if (!exists) acc.push(current);
                    return acc;
                  }, []).sort((a: CandlestickData, b: CandlestickData) => {
                    const timeA = typeof a.time === 'number' ? a.time : (a.time as any).timestamp || 0;
                    const timeB = typeof b.time === 'number' ? b.time : (b.time as any).timestamp || 0;
                    return timeA - timeB;
                  });
                  
                  candleBufferRef.current = uniqueCandles;
                  
                  // ✅ Validate currentCandle before using it
                  if (currentCandle && 
                      typeof currentCandle.open === 'number' && 
                      typeof currentCandle.high === 'number' && 
                      typeof currentCandle.low === 'number' && 
                      typeof currentCandle.close === 'number' &&
                      !isNaN(currentCandle.open) &&
                      !isNaN(currentCandle.high) &&
                      !isNaN(currentCandle.low) &&
                      !isNaN(currentCandle.close)) {
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
            if (!isDbLoadedRef.current) {
              return;
            }
            
            const currentTime = tick.time;
            const price = tick.price;
            
            // ✅ Validate price data - skip if null/undefined/NaN
            if (!currentTime || !price || 
                typeof price !== 'number' || 
                isNaN(price) || 
                typeof currentTime !== 'number' || 
                isNaN(currentTime)) {
              console.warn('Invalid price tick data:', { currentTime, price });
              return;
            }
            
            if (candleBufferRef.current.length > 0) {
              const lastCandle = candleBufferRef.current[candleBufferRef.current.length - 1];
              const lastCandleTime = typeof lastCandle.time === 'number' ? lastCandle.time : (lastCandle.time as any).timestamp || 0;
              if (currentTime < lastCandleTime) {
                console.log('Ignoring old tick:', currentTime, '< last candle:', lastCandleTime);
                return;
              }
            }
            
            if (!currentCandleRef.current || (currentTime - candleStartTimeRef.current) >= updateInterval) {
              let openPrice = price;
              
              if (currentCandleRef.current) {
                openPrice = currentCandleRef.current.close;
                
                candleBufferRef.current.push(currentCandleRef.current);
                
                if (candleBufferRef.current.length > 300) {
                  candleBufferRef.current = candleBufferRef.current.slice(-300);
                }
              } else if (candleBufferRef.current.length > 0) {
                const lastBufferedCandle = candleBufferRef.current[candleBufferRef.current.length - 1];
                openPrice = lastBufferedCandle.close;
                console.log('Using last DB candle close as starting point:', openPrice);
              }
              
              if (isPairChangeRef.current) {
                isPairChangeRef.current = false;
              }
              
              candleStartTimeRef.current = currentTime;
              currentCandleRef.current = {
                time: currentTime as any,
                open: openPrice,
                high: Math.max(openPrice, price),
                low: Math.min(openPrice, price),
                close: price,
              };
            } else {
              if (currentCandleRef.current) {
                currentCandleRef.current.close = price;
                currentCandleRef.current.high = Math.max(currentCandleRef.current.high, price);
                currentCandleRef.current.low = Math.min(currentCandleRef.current.low, price);
              }
            }
            
            const allCandles = currentCandleRef.current 
              ? [...candleBufferRef.current, currentCandleRef.current]
              : candleBufferRef.current;
            
            // ✅ Filter out any invalid candles before sending to chart
            const validCandles = allCandles.filter(candle => {
              const isValid = candle && 
                             typeof candle.open === 'number' && 
                             typeof candle.high === 'number' && 
                             typeof candle.low === 'number' && 
                             typeof candle.close === 'number' &&
                             !isNaN(candle.open) &&
                             !isNaN(candle.high) &&
                             !isNaN(candle.low) &&
                             !isNaN(candle.close) &&
                             candle.open !== null &&
                             candle.high !== null &&
                             candle.low !== null &&
                             candle.close !== null;
              
              if (!isValid) {
                console.warn('Filtering out invalid candle:', candle);
              }
              return isValid;
            });
            
            seriesRef.current?.setData(validCandles);
            
            if (chartRef.current && allCandles.length > 0) {
              chartRef.current.timeScale().scrollToRealTime();
            }
            
            setLastPrice(price);
            onPriceUpdate?.(price);

            setTrades((old) => {
              const updated = old.map((t): Trade => {
                if (!t.result && currentTime >= t.exitTime) {
                  const result: "win" | "lose" = (t.type === "buy" && price > t.entryPrice) ||
                    (t.type === "sell" && price < t.entryPrice)
                    ? "win"
                    : "lose";
                  
                  const profit = result === 'win' ? '+$82.00' : '-$100.00';
                  
                  setTradeNotifications(prev => [...prev, {
                    id: t.id,
                    result,
                    profit,
                    timestamp: Date.now()
                  }]);
                  
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

  useEffect(() => {
    const timestamp = Date.now();
    console.log(`[${timestamp}] 🔥 PAIR CHANGED TO: ${pair}`);
    
    currentPairRef.current = pair;
    isPairChangeRef.current = true;
    isDbLoadedRef.current = false;
    
    candleBufferRef.current = [];
    currentCandleRef.current = null;
    
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

  useEffect(() => {
    console.log('Update interval changed to:', updateInterval);
    
    currentCandleRef.current = null;
    candleStartTimeRef.current = 0;
    if (seriesRef.current && candleBufferRef.current.length > 0) {
      seriesRef.current.setData(candleBufferRef.current);
    }
  }, [updateInterval]);

  useEffect(() => {
    console.log('Chart buffer size:', candleBufferRef.current.length, 'Series exists:', !!seriesRef.current);
  }, [candleBufferRef.current.length]);

  const priceLineRefsRef = useRef<any[]>([]);
  
  useEffect(() => {
    if (!seriesRef.current) return;
    
    priceLineRefsRef.current.forEach(line => {
      try {
        seriesRef.current?.removePriceLine(line);
      } catch (e) {}
    });
    priceLineRefsRef.current = [];
    
    trades.forEach((t) => {
      try {
        if (!t.result) {
          const entryLine = seriesRef.current?.createPriceLine({
            price: t.entryPrice,
            color: "#FFD700",
            lineWidth: 3,
            lineStyle: 2,
            axisLabelVisible: true,
            title: t.type === "buy" ? "↑" : "↓",
          });
          if (entryLine) priceLineRefsRef.current.push(entryLine);
        }
      } catch (e) {
        console.log("Price line error:", e);
      }
    });
    
    return () => {
      priceLineRefsRef.current.forEach(line => {
        try {
          seriesRef.current?.removePriceLine(line);
        } catch (e) {}
      });
    };
  }, [trades, lastPrice]);

  const currentAssetTrades = trades.filter(t => t.assetId === `${pair}_OTC`);
  const activeTrades = currentAssetTrades.filter(t => !t.result);
  const completedTrades = currentAssetTrades.filter(t => t.result);

  return (
    <div className="w-full h-full bg-[#0c1e3e] flex flex-col relative">
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
      </div>

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
              {completedTrades.map((t) => (
                <div
                  key={`history-${t.id}`}
                  className={`p-3 rounded-lg ${t.result === 'win' ? 'bg-green-600/20' : 'bg-red-600/20'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`font-bold ${t.result === 'win' ? 'text-green-400' : 'text-red-400'}`}>
                        {t.type === 'buy' ? '↑ شراء' : '↓ بيع'}
                      </span>
                      <span className="text-white font-mono text-sm">
                        ${t.entryPrice.toFixed(5)} → ${t.exitPrice?.toFixed(5)}
                      </span>
                    </div>
                    <span className={`font-bold ${t.result === 'win' ? 'text-green-400' : 'text-red-400'}`}>
                      {t.result === 'win' ? '+$82.00' : '-$100.00'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default OtcChart;
