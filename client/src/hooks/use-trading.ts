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

// حفظ فقط ID الأصل بدلاً من الأصل كاملاً
const getStoredAssetId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('selectedAssetId');
};

const setStoredAssetId = (assetId: string | null) => {
  if (typeof window !== 'undefined') {
    if (assetId) {
      localStorage.setItem('selectedAssetId', assetId);
    } else {
      localStorage.removeItem('selectedAssetId');
    }
  }
};

export function useTrading() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<TradingState>({
    selectedAsset: null, // سيتم تعيينه بعد تحميل الأصول
    selectedTimeframe: '1m',
    tradeAmount: 100,
    isDemoAccount: true,
    demoBalance: getStoredBalance('demoBalance', 10000),
    realBalance: getStoredBalance('realBalance', 0),
    userId: 'demo_user', // In a real app, this would come from authentication
  });

  // Fetch user data to get real balances from database
  const { data: userData } = useQuery<{ demoBalance: string; realBalance: string }>({
    queryKey: ['/api/users', state.userId],
    refetchInterval: 5000, // Refetch every 5 seconds to keep balance updated
    refetchOnWindowFocus: true,
  });

  // Update balances when user data is fetched
  useEffect(() => {
    if (userData) {
      const newDemoBalance = parseFloat(userData.demoBalance || '10000');
      const newRealBalance = parseFloat(userData.realBalance || '0');
      
      setState(prev => ({
        ...prev,
        demoBalance: newDemoBalance,
        realBalance: newRealBalance,
      }));
      
      setStoredBalance('demoBalance', newDemoBalance);
      setStoredBalance('realBalance', newRealBalance);
    }
  }, [userData]);

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
      openPrice: number; // إضافة السعر الفعلي من الشارت
      entryTime?: Date; // إضافة entryTime
    }) => {
      const response = await apiRequest('POST', '/api/trades', {
        userId: state.userId,
        assetId: tradeData.assetId,
        type: tradeData.type,
        amount: tradeData.amount.toString(),
        openPrice: tradeData.openPrice.toString(), // استخدام السعر من الشارت
        expiryTime: tradeData.expiryTime.toISOString(),
        createdAt: tradeData.entryTime?.toISOString(), // إرسال وقت الدخول من المتصفح
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
    onSuccess: async (trade: Trade) => {
      console.log('Trade closed successfully:', trade);
      console.log('Trade status:', trade.status, 'Payout:', trade.payout, 'IsDemo:', trade.isDemo);
      
      // Invalidate user query to fetch updated balance from server
      await queryClient.invalidateQueries({ queryKey: ['/api/users', state.userId] });
      
      // Fetch fresh user data from server
      const userResponse = await fetch(`/api/users/${state.userId}`);
      if (userResponse.ok) {
        const updatedUser = await userResponse.json();
        console.log('Updated user balance from server:', updatedUser);
        
        // Update state and localStorage with server data
        setState(prev => ({
          ...prev,
          demoBalance: parseFloat(updatedUser.demoBalance || "10000.00"),
          realBalance: parseFloat(updatedUser.realBalance || "0.00")
        }));
        
        setStoredBalance('demoBalance', parseFloat(updatedUser.demoBalance || "10000.00"));
        setStoredBalance('realBalance', parseFloat(updatedUser.realBalance || "0.00"));
        
        console.log('Balance updated from server - Demo:', updatedUser.demoBalance, 'Real:', updatedUser.realBalance);
      }
      
      // Force invalidate all trade queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/trades/user', state.userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/trades/user', state.userId, 'open'] });
    },
  });

  const executeTrade = (type: 'CALL' | 'PUT', currentPrice: number) => {
    // حماية من التنفيذ المزدوج
    if (executeTradeMutation.isPending) {
      console.warn('🛑 Trade already executing, blocking duplicate call');
      return;
    }

    if (!state.selectedAsset) return;

    console.log('✅ Executing trade:', type, 'at price:', currentPrice);

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
      openPrice: currentPrice, // استخدام السعر الفعلي من الشارت
      isDemo: state.isDemoAccount
    });
  };

  const closeTrade = (tradeId: string) => {
    closeTradeMutation.mutate(tradeId);
  };

  const updateState = (updates: Partial<TradingState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      // حفظ ID الأصل المختار في localStorage
      if (updates.selectedAsset !== undefined) {
        setStoredAssetId(updates.selectedAsset?.id || null);
      }
      return newState;
    });
  };

  const toggleAccount = () => {
    setState(prev => ({ ...prev, isDemoAccount: !prev.isDemoAccount }));
  };

  // استعادة الأصل المحفوظ أو تعيين أصل افتراضي
  useEffect(() => {
    if (assets.length > 0 && !state.selectedAsset) {
      const storedAssetId = getStoredAssetId();
      let assetToSelect: Asset;
      
      if (storedAssetId) {
        // محاولة إيجاد الأصل المحفوظ
        const storedAsset = assets.find(a => a.id === storedAssetId);
        assetToSelect = storedAsset || assets[0];
        console.log('Restoring selected asset:', assetToSelect.id);
      } else {
        // استخدام أول أصل كافتراضي
        assetToSelect = assets[0];
        console.log('Setting default asset:', assetToSelect.id);
      }
      
      setState(prev => ({ ...prev, selectedAsset: assetToSelect }));
      setStoredAssetId(assetToSelect.id);
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
