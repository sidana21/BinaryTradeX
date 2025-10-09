import { useEffect, useState, useRef } from 'react';
import { Link } from 'wouter';
import { AssetList } from '@/components/trading/asset-list';
import { TradingPanel } from '@/components/trading/trading-panel';
import { TradesPanel } from '@/components/trading/trades-panel';
import { useTrading } from '@/hooks/use-trading';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ExternalLink, Menu, X } from 'lucide-react';
import type { Asset } from '@shared/schema';
import OtcChart, { OtcChartRef } from '@/components/chart/otc-chart';

export default function TradingPage() {
  const { toast } = useToast();
  const { lastMessage } = useWebSocket('/ws');
  const [isAssetsOpen, setIsAssetsOpen] = useState(false);
  const [isTradingOpen, setIsTradingOpen] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(0);
  const chartRef = useRef<OtcChartRef>(null);
  
  useEffect(() => {
    console.log('isAssetsOpen changed:', isAssetsOpen);
  }, [isAssetsOpen]);
  
  const {
    state,
    updateState,
    toggleAccount,
    assets,
    openTrades,
    tradeHistory,
    executeTrade,
    closeTrade,
    isExecuting,
    isClosing,
    assetsLoading,
    tradesLoading,
  } = useTrading();

  const handlePriceUpdate = (price: number) => {
    setCurrentPrice(price);
  };

  const getPairFromAsset = (assetId: string) => {
    return assetId.replace('_OTC', '');
  };

  const handleAssetSelect = (asset: Asset) => {
    console.log('Asset selected:', asset.name, asset.id);
    updateState({ selectedAsset: asset });
    setIsAssetsOpen(false);
  };

  const handleExecuteTrade = (type: 'CALL' | 'PUT') => {
    if (!state.selectedAsset) {
      toast({
        title: 'خطأ',
        description: 'يرجى اختيار أصل للتداول',
        variant: 'destructive',
      });
      return;
    }

    if (state.tradeAmount > (state.isDemoAccount ? state.demoBalance : state.realBalance)) {
      toast({
        title: 'خطأ',
        description: 'مبلغ التداول أكبر من الرصيد المتاح',
        variant: 'destructive',
      });
      return;
    }

    // Place trade marker on chart
    const tradeType = type === 'CALL' ? 'buy' : 'sell';
    chartRef.current?.placeTrade(tradeType);

    executeTrade(type);
    
    toast({
      title: 'تم تنفيذ الصفقة',
      description: `تم تنفيذ صفقة ${type === 'CALL' ? 'صعود' : 'هبوط'} على ${state.selectedAsset.name}`,
    });
  };

  const currentBalance = state.isDemoAccount ? state.demoBalance : state.realBalance;

  return (
    <div className="min-h-screen bg-[#0a0e27] text-foreground flex flex-col">
      {/* Pocket Option Style Header - Mobile First */}
      <header className="bg-[#0f1535] border-b border-[#1a1f3a] px-3 py-2 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          {/* Left - User Avatar & Gift */}
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
              <i className="fas fa-user text-gray-300 text-sm"></i>
            </button>
            <button className="w-9 h-9 rounded-lg bg-[#1a1f3a] flex items-center justify-center">
              <i className="fas fa-gift text-blue-400"></i>
            </button>
          </div>

          {/* Center - Account Type & Balance */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{state.isDemoAccount ? 'OT Demo' : 'حساب حقيقي'}</span>
              <span className="text-gray-500">USD</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">
                ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <button className="text-blue-400" onClick={toggleAccount}>
                <i className="fas fa-sync-alt text-xs"></i>
              </button>
            </div>
          </div>

          {/* Right - Wallet */}
          <button className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <i className="fas fa-wallet text-emerald-400 text-xl"></i>
          </button>
        </div>
      </header>

      {/* Asset Selector Bar */}
      <div className="bg-[#0f1535] border-b border-[#1a1f3a] px-3 py-2">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => {
              console.log('Asset selector button clicked');
              setIsAssetsOpen(true);
            }}
            className="flex items-center gap-2 text-white font-medium"
            data-testid="button-select-asset"
          >
            <span className="text-base">{state.selectedAsset?.name || 'اختر زوج'}</span>
            <i className="fas fa-chevron-down text-xs text-gray-400"></i>
          </button>
          
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} UTC+1
            </span>
            <button className="text-gray-400">
              <i className="fas fa-ellipsis-h"></i>
            </button>
          </div>
        </div>
        
        {/* Current Price */}
        {state.selectedAsset && (
          <div className="mt-1">
            <span className="text-2xl font-bold text-white">{currentPrice ? currentPrice.toFixed(5) : state.selectedAsset.currentPrice}</span>
          </div>
        )}
      </div>

      {/* Main Chart Area - Full Width */}
      <div className="flex-1 overflow-hidden bg-[#0a0e27]">
        <OtcChart 
          ref={chartRef}
          pair={state.selectedAsset ? getPairFromAsset(state.selectedAsset.id) : 'USDJPY'}
          onPriceUpdate={handlePriceUpdate}
        />
      </div>

      {/* Bottom Trading Panel - Exact Pocket Option Style */}
      <div className="bg-[#0f1535] border-t border-[#1a1f3a] px-3 py-3 space-y-2.5">
        {/* Time & Amount Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Time - Temps */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Temps</label>
            <div className="bg-[#1a1f3a] rounded-lg px-3 py-2.5 flex items-center justify-between">
              <span className="text-white font-medium text-sm">00:01:00</span>
              <i className="far fa-clock text-gray-400 text-sm"></i>
            </div>
          </div>
          
          {/* Amount - Montant */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Montant</label>
            <div className="bg-[#1a1f3a] rounded-lg px-3 py-2.5 flex items-center justify-between">
              <input
                type="number"
                value={state.tradeAmount}
                onChange={(e) => updateState({ tradeAmount: parseFloat(e.target.value) || 10 })}
                className="bg-transparent text-white font-medium w-full outline-none text-sm"
                data-testid="input-trade-amount"
              />
              <i className="fas fa-dollar-sign text-gray-400 text-xs"></i>
            </div>
          </div>
        </div>

        {/* Payment & Profit Row - Paiement & Profit */}
        <div className="flex items-center justify-between px-1 py-1">
          <div className="text-left">
            <div className="text-xs text-gray-400">Paiement</div>
            <div className="text-white font-medium text-sm">${(state.tradeAmount * 1.92).toFixed(2)}</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-400">+92%</div>
          </div>
          
          <div className="text-right">
            <div className="text-xs text-gray-400">Profit</div>
            <div className="text-emerald-400 font-medium text-sm">+${(state.tradeAmount * 0.92).toFixed(2)}</div>
          </div>
        </div>

        {/* Trade Buttons - ACHAT & VENTE */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => handleExecuteTrade('CALL')}
            disabled={!state.selectedAsset || isExecuting}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 text-base transition-colors uppercase"
            data-testid="button-call"
          >
            <i className="fas fa-arrow-up text-lg"></i>
            <span>ACHAT</span>
          </button>
          
          <button
            onClick={() => handleExecuteTrade('PUT')}
            disabled={!state.selectedAsset || isExecuting}
            className="bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 text-base transition-colors uppercase"
            data-testid="button-put"
          >
            <i className="fas fa-arrow-down text-lg"></i>
            <span>VENTE</span>
          </button>
        </div>
      </div>

      {/* Bottom Navigation Bar - Exact Pocket Option Labels */}
      <nav className="bg-[#0f1535] border-t border-[#1a1f3a] px-2 py-2 flex items-center justify-around">
        <button 
          className="flex flex-col items-center gap-1 py-1 px-2 text-gray-400 hover:text-blue-400 transition-colors"
          data-testid="nav-transactions"
        >
          <i className="fas fa-history text-base"></i>
          <span className="text-[9px]">Transacti...</span>
        </button>
        
        <button 
          className="flex flex-col items-center gap-1 py-1 px-2 text-gray-400 hover:text-blue-400 transition-colors"
          data-testid="nav-signals"
        >
          <i className="fas fa-signal text-base"></i>
          <span className="text-[9px]">Signaux</span>
        </button>
        
        <button 
          onClick={() => setIsAssetsOpen(true)}
          className="flex flex-col items-center gap-1 py-1 px-2 text-blue-400"
          data-testid="nav-trading"
        >
          <i className="fas fa-chart-bar text-base"></i>
          <span className="text-[9px]">Trading s.</span>
        </button>
        
        <button 
          className="flex flex-col items-center gap-1 py-1 px-2 text-gray-400 hover:text-blue-400 transition-colors"
          data-testid="nav-community"
        >
          <i className="fas fa-users text-base"></i>
          <span className="text-[9px]">Transacti...</span>
        </button>
        
        <button 
          className="flex flex-col items-center gap-1 py-1 px-2 text-gray-400 hover:text-blue-400 transition-colors"
          data-testid="nav-tournaments"
        >
          <i className="fas fa-trophy text-base"></i>
          <span className="text-[9px]">Tournois</span>
        </button>
      </nav>

      {/* Assets Drawer - Full Screen on Mobile */}
      <Sheet open={isAssetsOpen} onOpenChange={setIsAssetsOpen}>
        <SheetContent side="bottom" className="h-[90vh] p-0 bg-[#0f1535] border-[#1a1f3a]">
          <SheetHeader className="px-4 pt-4 pb-2 border-b border-[#1a1f3a]">
            <SheetTitle className="text-right text-white">اختر الأصل للتداول</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-[calc(90vh-80px)]">
            <AssetList
              assets={assets}
              selectedAsset={state.selectedAsset}
              onAssetSelect={handleAssetSelect}
              isLoading={assetsLoading}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
