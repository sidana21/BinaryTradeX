import { useEffect } from 'react';
import { TradingChart } from '@/components/chart/trading-chart';
import { AssetList } from '@/components/trading/asset-list';
import { TradingPanel } from '@/components/trading/trading-panel';
import { TradesPanel } from '@/components/trading/trades-panel';
import { useTrading } from '@/hooks/use-trading';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import type { Asset } from '@shared/schema';

export default function TradingPage() {
  const { toast } = useToast();
  const { lastMessage } = useWebSocket('/ws');
  
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

  // Handle WebSocket price updates
  useEffect(() => {
    if (lastMessage?.type === 'price_update') {
      const updates = lastMessage.data;
      
      // Update selected asset price if it matches
      if (state.selectedAsset) {
        const assetUpdate = updates.find((update: any) => update.id === state.selectedAsset?.id);
        if (assetUpdate) {
          updateState({
            selectedAsset: {
              ...state.selectedAsset,
              currentPrice: assetUpdate.price,
              priceChange: assetUpdate.change,
              priceChangePercent: assetUpdate.changePercent
            }
          });
        }
      }
    }
  }, [lastMessage]);

  const handleAssetSelect = (asset: Asset) => {
    updateState({ selectedAsset: asset });
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

    executeTrade(type);
    
    toast({
      title: 'تم تنفيذ الصفقة',
      description: `تم تنفيذ صفقة ${type === 'CALL' ? 'صعود' : 'هبوط'} على ${state.selectedAsset.name}`,
    });
  };

  const currentBalance = state.isDemoAccount ? state.demoBalance : state.realBalance;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          {/* Logo and Platform Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <i className="fas fa-chart-line text-xl text-primary-foreground"></i>
            </div>
            <h1 className="text-xl font-bold hidden sm:block">منصة التداول</h1>
          </div>

          {/* Center - Current Asset */}
          {state.selectedAsset && (
            <div className="flex items-center gap-4 bg-secondary px-4 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">الأصل:</span>
                <span className="font-semibold text-lg">{state.selectedAsset.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xl font-bold">{state.selectedAsset.currentPrice}</span>
                <span className={`text-sm flex items-center gap-1 ${
                  parseFloat(state.selectedAsset.priceChange || '0') >= 0 ? 'text-success' : 'text-destructive'
                }`}>
                  <i className={`fas fa-arrow-${parseFloat(state.selectedAsset.priceChange || '0') >= 0 ? 'up' : 'down'}`}></i>
                  <span>{state.selectedAsset.priceChangePercent}%</span>
                </span>
              </div>
            </div>
          )}

          {/* Account Controls */}
          <div className="flex items-center gap-4">
            {/* Demo/Real Toggle */}
            <div className="flex items-center gap-2 bg-secondary rounded-lg p-1">
              <button
                onClick={toggleAccount}
                className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${
                  state.isDemoAccount
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                حساب تجريبي
              </button>
              <button
                onClick={toggleAccount}
                className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${
                  !state.isDemoAccount
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                حساب حقيقي
              </button>
            </div>
            
            {/* Balance Display */}
            <div className="flex items-center gap-2 bg-secondary px-4 py-2 rounded-lg">
              <i className="fas fa-wallet text-accent"></i>
              <span className="font-mono font-bold text-lg">
                ${currentBalance.toFixed(2)}
              </span>
            </div>

            {/* User Menu */}
            <button className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
              <i className="fas fa-user"></i>
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Sidebar - Asset List */}
        <aside className="w-80 bg-card border-l border-border overflow-y-auto hidden lg:block">
          <AssetList
            assets={assets}
            selectedAsset={state.selectedAsset}
            onAssetSelect={handleAssetSelect}
            isLoading={assetsLoading}
          />
        </aside>

        {/* Main Content - Chart */}
        <main className="flex-1 flex flex-col bg-background overflow-hidden">
          <div className="flex-1 p-4">
            <TradingChart
              asset={state.selectedAsset}
              timeframe={state.selectedTimeframe}
              onTimeframeChange={(timeframe) => updateState({ selectedTimeframe: timeframe })}
            />
          </div>

          {/* Bottom Trades Panel */}
          <TradesPanel
            openTrades={openTrades}
            tradeHistory={tradeHistory}
            assets={assets}
            onCloseTrade={closeTrade}
            isClosing={isClosing}
          />
        </main>

        {/* Right Sidebar - Trading Panel */}
        <aside className="w-96 bg-card border-r border-border p-4 overflow-y-auto">
          <TradingPanel
            selectedAsset={state.selectedAsset}
            tradeAmount={state.tradeAmount}
            timeframe={state.selectedTimeframe}
            onAmountChange={(amount) => updateState({ tradeAmount: amount })}
            onTimeframeChange={(timeframe) => updateState({ selectedTimeframe: timeframe })}
            onExecuteTrade={handleExecuteTrade}
            isExecuting={isExecuting}
            balance={currentBalance}
            isDemoAccount={state.isDemoAccount}
          />
        </aside>
      </div>
    </div>
  );
}
