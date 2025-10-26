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
import { Logo } from '@/components/ui/logo';
import { AssetIcon } from '@/components/ui/asset-icon';
import { DepositWithdraw } from '@/components/wallet/deposit-withdraw';
import { ExternalLink, Menu, X, Wallet, UserCircle } from 'lucide-react';
import type { Asset } from '@shared/schema';
import OtcChart, { OtcChartRef } from '@/components/chart/otc-chart';

export default function TradingPage() {
  const { toast } = useToast();
  const { lastMessage } = useWebSocket('/ws');
  const [isAssetsOpen, setIsAssetsOpen] = useState(false);
  const [isTradingOpen, setIsTradingOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [showDepositPrompt, setShowDepositPrompt] = useState(false);
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

  // Track completed demo trades and show deposit prompt after 5 trades
  useEffect(() => {
    if (!state.isDemoAccount) return; // Only for demo account
    
    const completedDemoTrades = tradeHistory.filter(
      trade => trade.isDemo && trade.status !== 'open'
    );
    
    // Show prompt after 5 completed trades (only once per session)
    if (completedDemoTrades.length === 5 && !sessionStorage.getItem('depositPromptShown')) {
      setTimeout(() => {
        setShowDepositPrompt(true);
        sessionStorage.setItem('depositPromptShown', 'true');
      }, 1000); // Small delay for better UX
    }
  }, [tradeHistory, state.isDemoAccount]);

  const handlePriceUpdate = (price: number) => {
    setCurrentPrice(price);
  };

  const getPairFromAsset = (assetId: string) => {
    return assetId.replace('_OTC', '');
  };

  // Convert selectedTimeframe to duration in seconds
  const getTradeDuration = () => {
    switch (state.selectedTimeframe) {
      case '1m':
        return 60;
      case '5m':
        return 300;
      case '15m':
        return 900;
      default:
        return 60;
    }
  };

  // Update current price from WebSocket messages
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'otc_price_tick') {
      const tick = lastMessage.data;
      if (state.selectedAsset && tick.pair === getPairFromAsset(state.selectedAsset.id)) {
        setCurrentPrice(tick.price);
      }
    }
  }, [lastMessage, state.selectedAsset]);

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

    // احصل على السعر الحالي من الشارت (وليس من state)
    const currentPrice = chartRef.current?.getCurrentPrice();
    if (!currentPrice) {
      toast({
        title: 'خطأ',
        description: 'لا يمكن الحصول على السعر الحالي',
        variant: 'destructive',
      });
      return;
    }

    // رسم الخط الذهبي فوراً للـ visual feedback
    if (chartRef.current) {
      chartRef.current.placeTrade(type === 'CALL' ? 'buy' : 'sell');
    }
    
    // إنشاء الصفقة في قاعدة البيانات مع السعر الصحيح من الشارت
    executeTrade(type, currentPrice);
    
    toast({
      title: 'تم تنفيذ الصفقة',
      description: `تم تنفيذ صفقة ${type === 'CALL' ? 'صعود' : 'هبوط'} على ${state.selectedAsset.name}`,
    });
  };

  const currentBalance = state.isDemoAccount ? state.demoBalance : state.realBalance;

  return (
    <div className="h-screen bg-[#0a0e27] text-foreground flex flex-col overflow-hidden">
      {/* Pocket Option Style Header - Mobile First */}
      <header className="bg-[#0f1535] border-b border-[#1a1f3a] px-3 py-2 z-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Left - Logo */}
          <div className="flex items-center gap-3">
            <Logo size="sm" showText={true} />
          </div>

          {/* Center - Account Type & Balance */}
          <button 
            onClick={() => {
              toggleAccount();
              toast({
                title: 'تم التبديل',
                description: state.isDemoAccount ? 'تم التبديل إلى الحساب الحقيقي' : 'تم التبديل إلى الحساب التجريبي',
              });
            }}
            className="flex flex-col items-center hover:bg-[#1a1f3a] rounded-lg px-3 py-1 transition-colors active:scale-95"
            data-testid="button-toggle-account"
          >
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{state.isDemoAccount ? 'OT Demo' : 'حساب حقيقي'}</span>
              <span className="text-gray-500">USD</span>
              <i className="fas fa-sync-alt text-blue-400 text-[10px]"></i>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">
                ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </button>

          {/* Right - Wallet */}
          <button 
            onClick={() => setIsWalletOpen(true)}
            className="w-12 h-12 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 flex items-center justify-center transition-colors" 
            data-testid="button-wallet"
          >
            <Wallet className="text-emerald-400 w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Asset Selector Bar */}
      <div className="bg-[#0f1535] border-b border-[#1a1f3a] px-3 py-2 relative flex-shrink-0">
        <button 
          type="button"
          onClick={() => {
            console.log('Asset selector BUTTON clicked');
            setIsAssetsOpen(true);
          }}
          className="w-full text-left bg-[#1a1f3a] hover:bg-[#252b4a] rounded-lg px-3 py-2.5 mb-2 transition-colors"
          data-testid="button-select-asset"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {state.selectedAsset && <AssetIcon assetId={state.selectedAsset.id} size="sm" />}
              <span className="text-white font-semibold text-base">{state.selectedAsset?.name || 'اختر زوج'}</span>
              <i className="fas fa-chevron-down text-xs text-blue-400"></i>
            </div>
            <span className="text-xs text-gray-500">
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} UTC+1
            </span>
          </div>
        </button>
        
        {/* Current Price */}
        {state.selectedAsset && (
          <div>
            <span className="text-2xl font-bold text-white">
              {(currentPrice !== null ? currentPrice : parseFloat(state.selectedAsset.currentPrice)).toFixed(5)}
            </span>
          </div>
        )}
      </div>

      {/* Main Chart Area - Full Width */}
      <div className="flex-1 relative bg-[#0a0e27]">
        <OtcChart 
          ref={chartRef}
          pair={state.selectedAsset ? getPairFromAsset(state.selectedAsset.id) : 'USDJPY'}
          duration={getTradeDuration()}
          onPriceUpdate={handlePriceUpdate}
          openTrades={openTrades}
        />
      </div>

      {/* Bottom Trading Panel - Exact Pocket Option Style */}
      <div className="bg-[#0f1535] border-t border-[#1a1f3a] px-3 py-3 space-y-2.5 flex-shrink-0">
        {/* Time & Amount Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Time - Temps */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Temps</label>
            <div className="bg-[#1a1f3a] rounded-lg px-3 py-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-mono text-lg font-bold">
                  {state.selectedTimeframe === '1m' && '1:00'}
                  {state.selectedTimeframe === '5m' && '5:00'}
                  {state.selectedTimeframe === '15m' && '15:00'}
                </span>
                <i className="far fa-clock text-gray-400 text-sm"></i>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateState({ selectedTimeframe: '1m' })}
                  className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
                    state.selectedTimeframe === '1m' 
                      ? 'bg-blue-500 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  data-testid="button-timeframe-1m"
                >
                  1m
                </button>
                <button
                  onClick={() => updateState({ selectedTimeframe: '5m' })}
                  className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
                    state.selectedTimeframe === '5m' 
                      ? 'bg-blue-500 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  data-testid="button-timeframe-5m"
                >
                  5m
                </button>
                <button
                  onClick={() => updateState({ selectedTimeframe: '15m' })}
                  className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
                    state.selectedTimeframe === '15m' 
                      ? 'bg-blue-500 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  data-testid="button-timeframe-15m"
                >
                  15m
                </button>
              </div>
            </div>
          </div>
          
          {/* Amount - Montant */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Montant</label>
            <div className="bg-[#1a1f3a] rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => updateState({ tradeAmount: Math.max(1, state.tradeAmount - 10) })}
                  className="w-6 h-6 rounded bg-[#252b4a] hover:bg-[#2f3555] text-white flex items-center justify-center transition-colors"
                  data-testid="button-decrease-amount"
                >
                  <i className="fas fa-minus text-xs"></i>
                </button>
                <input
                  type="number"
                  value={state.tradeAmount}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value >= 1) {
                      updateState({ tradeAmount: value });
                    }
                  }}
                  min="1"
                  step="1"
                  className="flex-1 bg-transparent text-white font-medium text-center outline-none text-sm"
                  data-testid="input-trade-amount"
                />
                <button
                  onClick={() => updateState({ tradeAmount: Math.min(currentBalance, state.tradeAmount + 10) })}
                  className="w-6 h-6 rounded bg-[#252b4a] hover:bg-[#2f3555] text-white flex items-center justify-center transition-colors"
                  data-testid="button-increase-amount"
                >
                  <i className="fas fa-plus text-xs"></i>
                </button>
                <i className="fas fa-dollar-sign text-gray-400 text-xs"></i>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => updateState({ tradeAmount: 10 })}
                  className="flex-1 px-2 py-0.5 bg-[#252b4a] hover:bg-[#2f3555] text-gray-300 text-xs rounded transition-colors"
                  data-testid="button-amount-10"
                >
                  10
                </button>
                <button
                  onClick={() => updateState({ tradeAmount: 50 })}
                  className="flex-1 px-2 py-0.5 bg-[#252b4a] hover:bg-[#2f3555] text-gray-300 text-xs rounded transition-colors"
                  data-testid="button-amount-50"
                >
                  50
                </button>
                <button
                  onClick={() => updateState({ tradeAmount: 100 })}
                  className="flex-1 px-2 py-0.5 bg-[#252b4a] hover:bg-[#2f3555] text-gray-300 text-xs rounded transition-colors"
                  data-testid="button-amount-100"
                >
                  100
                </button>
                <button
                  onClick={() => updateState({ tradeAmount: Math.min(currentBalance, 500) })}
                  className="flex-1 px-2 py-0.5 bg-[#252b4a] hover:bg-[#2f3555] text-gray-300 text-xs rounded transition-colors"
                  data-testid="button-amount-500"
                >
                  500
                </button>
              </div>
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
      <nav className="bg-[#0f1535] border-t border-[#1a1f3a] px-2 py-2 flex items-center justify-around flex-shrink-0">
        <Link href="/transactions">
          <button 
            className="flex flex-col items-center gap-1 py-1 px-2 text-gray-400 hover:text-blue-400 transition-colors"
            data-testid="nav-transactions"
          >
            <i className="fas fa-history text-base"></i>
            <span className="text-[9px]">Transacti...</span>
          </button>
        </Link>
        
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
        
        <Link href="/profile">
          <button 
            className="flex flex-col items-center gap-1 py-1 px-2 text-gray-400 hover:text-blue-400 transition-colors"
            data-testid="nav-profile"
          >
            <UserCircle className="w-4 h-4" />
            <span className="text-[9px]">Profile</span>
          </button>
        </Link>
        
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

      {/* Wallet Modal - Deposit/Withdraw */}
      {isWalletOpen && (
        <DepositWithdraw
          balance={currentBalance}
          onClose={() => setIsWalletOpen(false)}
        />
      )}

      {/* Deposit Prompt Modal - Pocket Option Style */}
      {showDepositPrompt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#0f1535] rounded-2xl p-6 max-w-md w-full relative border border-[#1a1f3a] shadow-2xl animate-in zoom-in-95 duration-300">
            {/* Close button */}
            <button
              onClick={() => setShowDepositPrompt(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#1a1f3a] hover:bg-[#252b4a] flex items-center justify-center transition-colors group"
            >
              <X className="w-4 h-4 text-gray-400 group-hover:text-white" />
            </button>

            {/* Thumbs up icon */}
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center">
                <svg className="w-12 h-12 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 11H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3" />
                </svg>
              </div>
            </div>

            {/* Title and message */}
            <h2 className="text-2xl font-bold text-white text-center mb-2">
              أحسنت! 
            </h2>
            <p className="text-gray-300 text-center mb-6 leading-relaxed">
              لا تفوت فرصتك للحصول على أرباح حقيقية!
            </p>

            {/* Invest button */}
            <button
              onClick={() => {
                setShowDepositPrompt(false);
                setIsWalletOpen(true);
              }}
              className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold py-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-green-500/20"
            >
              استثمر أموال حقيقية
            </button>

            {/* Continue demo button */}
            <button
              onClick={() => setShowDepositPrompt(false)}
              className="w-full mt-3 text-gray-400 hover:text-white py-3 rounded-xl transition-colors text-sm"
            >
              مواصلة التداول التجريبي
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
