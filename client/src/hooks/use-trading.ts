import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Asset, Trade } from '@shared/schema';

interface TradingState {
  selectedAsset: Asset | null;
  selectedTimeframe: string;
  tradeAmount: number;
  isDemoAccount: boolean;
  demoBalance: number;
  realBalance: number;
  userId: string;
}

const getStoredBalance = (key: string, defaultValue: number): number => {
  if (typeof window === 'undefined') return defaultValue;
  const stored = localStorage.getItem(key);
  return stored ? parseFloat(stored) : defaultValue;
};

const setStoredBalance = (key: string, value: number) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, value.toString());
  }
};

export function useTrading() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<TradingState>({
    selectedAsset: null,
    selectedTimeframe: '1m',
    tradeAmount: 100,
    isDemoAccount: true,
    demoBalance: getStoredBalance('demoBalance', 10000),
    realBalance: getStoredBalance('realBalance', 0),
    userId: 'demo_user', // In a real app, this would come from authentication
  });

  // Fetch all assets
  const { data: assets = [], isLoading: assetsLoading } = useQuery<Asset[]>({
    queryKey: ['/api/assets'],
  });

  // Fetch open trades - refetch more frequently to ensure trades are always visible
  const { data: openTrades = [], isLoading: tradesLoading } = useQuery<Trade[]>({
    queryKey: ['/api/trades/user', state.userId, 'open'],
    refetchInterval: 2000, // Refetch every 2 seconds to keep trades updated
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
    staleTime: 1000, // Consider data stale after 1 second
  });

  // Fetch trade history
  const { data: tradeHistory = [] } = useQuery<Trade[]>({
    queryKey: ['/api/trades/user', state.userId],
    refetchOnWindowFocus: true,
  });

  // Execute trade mutation
  const executeTradeMutation = useMutation({
    mutationFn: async (tradeData: {
      type: 'CALL' | 'PUT';
      amount: number;
      assetId: string;
      expiryTime: Date;
      isDemo: boolean;
    }) => {
      const response = await apiRequest('POST', '/api/trades', {
        userId: state.userId,
        assetId: tradeData.assetId,
        type: tradeData.type,
        amount: tradeData.amount.toString(),
        openPrice: state.selectedAsset?.currentPrice || '0',
        expiryTime: tradeData.expiryTime.toISOString(),
        isDemo: tradeData.isDemo,
      });
      return response.json();
    },
    onSuccess: (trade: Trade) => {
      console.log('Trade executed successfully:', trade);
      
      // Update balance - deduct trade amount using functional setState for concurrency safety
      const tradeAmount = parseFloat(trade.amount);
      const isDemo = trade.isDemo;
      
      setState(prev => {
        if (isDemo) {
          const newBalance = prev.demoBalance - tradeAmount;
          console.log('Deducting from demo balance:', prev.demoBalance, '->', newBalance);
          setStoredBalance('demoBalance', newBalance);
          return {
            ...prev,
            demoBalance: newBalance
          };
        } else {
          const newBalance = prev.realBalance - tradeAmount;
          console.log('Deducting from real balance:', prev.realBalance, '->', newBalance);
          setStoredBalance('realBalance', newBalance);
          return {
            ...prev,
            realBalance: newBalance
          };
        }
      });
      
      // Invalidate all trade queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/trades/user', state.userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/trades/user', state.userId, 'open'] });
    },
  });

  // Close trade mutation
  const closeTradeMutation = useMutation({
    mutationFn: async (tradeId: string) => {
      const trade = (openTrades as Trade[]).find((t: Trade) => t.id === tradeId);
      if (!trade) throw new Error('Trade not found');

      // Get the correct asset price for this trade
      const tradeAsset = (assets as Asset[]).find((a: Asset) => a.id === trade.assetId);
      const currentPrice = tradeAsset?.currentPrice || trade.openPrice;

      // Send only closePrice - backend will determine win/loss based on shouldWin
      const response = await apiRequest('PATCH', `/api/trades/${tradeId}/close`, {
        closePrice: currentPrice
      });
      return response.json();
    },
    onSuccess: (trade: Trade) => {
      console.log('Trade closed successfully:', trade);
      console.log('Trade status:', trade.status, 'Payout:', trade.payout, 'IsDemo:', trade.isDemo);
      
      // Update balance based on trade result using functional setState for concurrency safety
      if (trade.status === 'won' && trade.payout) {
        const payout = parseFloat(trade.payout);
        const isDemo = trade.isDemo;
        console.log('Trade won! Payout:', payout);
        
        setState(prev => {
          if (isDemo) {
            const newBalance = prev.demoBalance + payout;
            console.log('Updating demo balance from', prev.demoBalance, 'to', newBalance);
            setStoredBalance('demoBalance', newBalance);
            return {
              ...prev,
              demoBalance: newBalance
            };
          } else {
            const newBalance = prev.realBalance + payout;
            console.log('Updating real balance from', prev.realBalance, 'to', newBalance);
            setStoredBalance('realBalance', newBalance);
            return {
              ...prev,
              realBalance: newBalance
            };
          }
        });
      } else if (trade.status === 'lost') {
        console.log('Trade lost - no balance update needed (amount already deducted)');
      }
      
      // Force invalidate all trade queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/trades/user', state.userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/trades/user', state.userId, 'open'] });
    },
  });

  const executeTrade = (type: 'CALL' | 'PUT') => {
    if (!state.selectedAsset) return;

    const timeframes = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '1h': 60
    };

    const expiryMinutes = timeframes[state.selectedTimeframe as keyof typeof timeframes] || 1;
    const expiryTime = new Date(Date.now() + expiryMinutes * 60 * 1000);

    executeTradeMutation.mutate({
      type,
      amount: state.tradeAmount,
      assetId: state.selectedAsset.id,
      expiryTime,
      isDemo: state.isDemoAccount
    });
  };

  const closeTrade = (tradeId: string) => {
    closeTradeMutation.mutate(tradeId);
  };

  const updateState = (updates: Partial<TradingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const toggleAccount = () => {
    setState(prev => ({ ...prev, isDemoAccount: !prev.isDemoAccount }));
  };

  // Set default selected asset when assets load
  useEffect(() => {
    if (assets.length > 0 && !state.selectedAsset) {
      setState(prev => ({ ...prev, selectedAsset: assets[0] }));
    }
  }, [assets, state.selectedAsset]);

  return {
    state,
    updateState,
    toggleAccount,
    assets,
    openTrades,
    tradeHistory,
    executeTrade,
    closeTrade,
    isExecuting: executeTradeMutation.isPending,
    isClosing: closeTradeMutation.isPending,
    assetsLoading,
    tradesLoading,
  };
}
