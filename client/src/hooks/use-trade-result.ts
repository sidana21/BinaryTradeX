import { useState, useEffect, useRef } from 'react';
import type { Trade } from '@shared/schema';

interface TradeResultData {
  result: 'win' | 'loss' | null;
  amount: number;
}

export function useTradeResult(trades: Trade[]) {
  const [tradeResult, setTradeResult] = useState<TradeResultData>({ result: null, amount: 0 });
  const previousTradesRef = useRef<Trade[]>([]);

  useEffect(() => {
    const previousTrades = previousTradesRef.current;
    
    const newlyClosedTrades = trades.filter(trade => {
      const wasOpen = previousTrades.find(pt => pt.id === trade.id)?.status === 'open';
      const isNowClosed = trade.status === 'won' || trade.status === 'lost';
      return wasOpen && isNowClosed;
    });

    if (newlyClosedTrades.length > 0) {
      const latestTrade = newlyClosedTrades[0];
      const isWin = latestTrade.status === 'won';
      const amount = parseFloat(latestTrade.amount);
      const payout = latestTrade.payout ? parseFloat(latestTrade.payout) : 0;
      const resultAmount = isWin ? payout - amount : -amount;

      setTradeResult({
        result: isWin ? 'win' : 'loss',
        amount: resultAmount
      });
    }

    previousTradesRef.current = trades;
  }, [trades]);

  const clearResult = () => {
    setTradeResult({ result: null, amount: 0 });
  };

  return { tradeResult, clearResult };
}
