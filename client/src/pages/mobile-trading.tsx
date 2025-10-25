import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/use-websocket';
import { Logo } from '@/components/ui/logo';
import { AssetIcon } from '@/components/ui/asset-icon';
import type { Asset } from '@shared/schema';
import { TrendingUp, TrendingDown, Clock, DollarSign } from 'lucide-react';
import OtcChart, { OtcChartRef } from '@/components/chart/otc-chart';

export default function MobileTradingPage() {
  const { toast } = useToast();
  const { lastMessage } = useWebSocket('/ws');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [tradeAmount, setTradeAmount] = useState(10);
  const [tradeDuration, setTradeDuration] = useState(1);
  const [payout, setPayout] = useState(92);
  const [balance, setBalance] = useState(49499.90);
  const [timeRemaining, setTimeRemaining] = useState('23:56:16');
  const [currentPrice, setCurrentPrice] = useState(0);
  
  const chartRef = useRef<OtcChartRef>(null);

  // Fetch assets
  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['/api/assets'],
  });

  // Set default asset
  useEffect(() => {
    if (assets.length > 0 && !selectedAsset) {
      const defaultAsset = assets.find(a => a.id === 'USDJPY_OTC') || assets[0];
      setSelectedAsset(defaultAsset);
    }
  }, [assets, selectedAsset]);

  const handlePriceUpdate = (price: number) => {
    setCurrentPrice(price);
  };

  // Update time remaining
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setTimeRemaining(`${hours}:${minutes}:${seconds}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTrade = (direction: 'CALL' | 'PUT') => {
    if (!selectedAsset) {
      toast({
        title: 'خطأ',
        description: 'يرجى اختيار أصل',
        variant: 'destructive',
      });
      return;
    }
    
    const type = direction === 'CALL' ? 'buy' : 'sell';
    chartRef.current?.placeTrade(type);
    
    toast({
      title: 'تم تنفيذ الصفقة',
      description: `صفقة ${type === 'buy' ? 'شراء' : 'بيع'} بمبلغ $${tradeAmount}`,
    });
    
    setBalance(prev => prev - tradeAmount);
  };


  const profit = (tradeAmount * payout / 100).toFixed(2);
  
  const getPairFromAsset = (assetId: string) => {
    return assetId.replace('_OTC', '');
  };

  return (
    <div className="h-screen w-screen bg-[#0a0e1a] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-[#14192a] px-4 py-2.5 flex items-center justify-between border-b border-gray-900">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" showText={false} />
          <div>
            <div className="text-gray-500 text-[10px] uppercase">Demo Account</div>
            <div className="text-white text-base font-semibold">
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] text-gray-500">USD</span>
            </div>
          </div>
        </div>
        <div className="w-11 h-11 bg-green-600/20 rounded-lg flex items-center justify-center">
          <div className="text-green-500 text-lg font-bold">💼</div>
        </div>
      </div>

      {/* Asset Info */}
      <div className="bg-[#14192a] px-4 py-2 border-b border-gray-900">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <button 
              className="text-white font-medium text-sm flex items-center gap-2 bg-[#1a2033] px-2 py-1 rounded"
              data-testid="button-asset-selector"
            >
              {selectedAsset && <AssetIcon assetId={selectedAsset.id} size="sm" />}
              {selectedAsset?.symbol || 'USD/JPY OTC'} <span className="text-[10px]">▼</span>
            </button>
          </div>
          <div className="text-gray-500 text-[10px] flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-gray-700 rounded-sm"></div>
            Délai d'expiration
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-white text-2xl font-bold" data-testid="text-asset-price">
            ${currentPrice ? currentPrice.toFixed(5) : '0.00000'}
          </div>
          <div className="text-gray-500 text-xs">{timeRemaining}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 relative bg-[#0a0e1a]">
        <OtcChart 
          ref={chartRef}
          pair={selectedAsset ? getPairFromAsset(selectedAsset.id) : 'USDJPY'}
          duration={tradeDuration * 60}
          onPriceUpdate={handlePriceUpdate}
        />
      </div>

      {/* Trading Controls */}
      <div className="bg-[#14192a] px-4 py-3.5 border-t border-gray-900">
        {/* Time and Amount */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="text-gray-500 text-[11px] mb-1.5">Temps</div>
            <button 
              className="w-full bg-[#1a2033] text-white px-3 py-2.5 rounded-lg flex items-center justify-center gap-2 border border-gray-800"
              data-testid="button-time-selector"
            >
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium">00:01:00</span>
            </button>
          </div>
          <div>
            <div className="text-gray-500 text-[11px] mb-1.5">Montant</div>
            <div className="w-full bg-[#1a2033] text-white px-3 py-2.5 rounded-lg border border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setTradeAmount(Math.max(1, tradeAmount - 10))}
                  className="w-6 h-6 rounded bg-[#0a0e1a] hover:bg-[#14192a] text-white flex items-center justify-center transition-colors"
                >
                  <span className="text-xs font-bold">−</span>
                </button>
                <input
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value >= 1) {
                      setTradeAmount(value);
                    }
                  }}
                  min="1"
                  className="flex-1 bg-transparent text-white font-medium text-center outline-none text-sm"
                  data-testid="input-trade-amount"
                />
                <button
                  onClick={() => setTradeAmount(Math.min(balance, tradeAmount + 10))}
                  className="w-6 h-6 rounded bg-[#0a0e1a] hover:bg-[#14192a] text-white flex items-center justify-center transition-colors"
                >
                  <span className="text-xs font-bold">+</span>
                </button>
                <DollarSign className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setTradeAmount(10)}
                  className="flex-1 px-2 py-0.5 bg-[#0a0e1a] hover:bg-[#14192a] text-gray-300 text-xs rounded transition-colors"
                >
                  10
                </button>
                <button
                  onClick={() => setTradeAmount(50)}
                  className="flex-1 px-2 py-0.5 bg-[#0a0e1a] hover:bg-[#14192a] text-gray-300 text-xs rounded transition-colors"
                >
                  50
                </button>
                <button
                  onClick={() => setTradeAmount(100)}
                  className="flex-1 px-2 py-0.5 bg-[#0a0e1a] hover:bg-[#14192a] text-gray-300 text-xs rounded transition-colors"
                >
                  100
                </button>
                <button
                  onClick={() => setTradeAmount(Math.min(balance, 500))}
                  className="flex-1 px-2 py-0.5 bg-[#0a0e1a] hover:bg-[#14192a] text-gray-300 text-xs rounded transition-colors"
                >
                  500
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Payout and Profit */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div>
            <div className="text-gray-500 text-[11px]">Paiement</div>
            <div className="text-sm mt-0.5" data-testid="text-payout">
              <span className="text-white">${tradeAmount}</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-[#4ade80] text-3xl font-bold">+{payout}%</div>
          </div>
          <div className="text-right">
            <div className="text-gray-500 text-[11px]">Profit</div>
            <div className="text-sm mt-0.5" data-testid="text-profit">
              <span className="text-[#4ade80]">+${profit}</span>
            </div>
          </div>
        </div>

        {/* Trade Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleTrade('CALL')}
            className="bg-[#4ade80] hover:bg-[#3dca6f] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 transition-all active:scale-95"
            data-testid="button-achat"
          >
            <TrendingUp className="w-5 h-5" />
            ACHAT
          </button>
          <button
            onClick={() => handleTrade('PUT')}
            className="bg-[#fb923c] hover:bg-[#f97316] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition-all active:scale-95"
            data-testid="button-vente"
          >
            <TrendingDown className="w-5 h-5" />
            VENTE
          </button>
        </div>
      </div>
    </div>
  );
}
