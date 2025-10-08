import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { TradingChart } from '@/components/chart/trading-chart';
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

export default function TradingPage() {
  const { toast } = useToast();
  const { lastMessage } = useWebSocket('/ws');
  const [isAssetsOpen, setIsAssetsOpen] = useState(false);
  const [isTradingOpen, setIsTradingOpen] = useState(false);
  
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

    executeTrade(type);
    
    toast({
      title: 'تم تنفيذ الصفقة',
      description: `تم تنفيذ صفقة ${type === 'CALL' ? 'صعود' : 'هبوط'} على ${state.selectedAsset.name}`,
    });
  };

  const currentBalance = state.isDemoAccount ? state.demoBalance : state.realBalance;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header - Mobile Optimized */}
      <header className="bg-card border-b border-border px-3 md:px-4 py-2 md:py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between gap-2">
          {/* Left - Menu & Logo */}
          <div className="flex items-center gap-2">
            {/* Mobile Menu - Assets */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsAssetsOpen(true)}
              className="lg:hidden"
              data-testid="button-open-assets"
            >
              <Menu className="w-5 h-5" />
            </Button>
            
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-chart-line text-lg md:text-xl text-primary-foreground"></i>
              </div>
              <h1 className="text-base md:text-xl font-bold hidden sm:block">منصة OTC</h1>
            </div>
          </div>

          {/* Center - Current Asset (Mobile Optimized) */}
          {state.selectedAsset && (
            <button
              onClick={() => setIsAssetsOpen(true)}
              className="flex items-center gap-2 md:gap-4 bg-secondary px-2 md:px-4 py-1.5 md:py-2 rounded-lg hover:bg-secondary/80 transition-colors"
              data-testid="button-current-asset"
            >
              <div className="flex items-center gap-1 md:gap-2">
                <span className="text-xs md:text-sm text-muted-foreground hidden sm:inline">الأصل:</span>
                <span className="font-semibold text-sm md:text-lg">{state.selectedAsset.name}</span>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <span className="font-mono text-base md:text-xl font-bold">{state.selectedAsset.currentPrice}</span>
                <span className={`text-xs md:text-sm flex items-center gap-0.5 ${
                  parseFloat(state.selectedAsset.priceChange || '0') >= 0 ? 'text-success' : 'text-destructive'
                }`}>
                  <i className={`fas fa-arrow-${parseFloat(state.selectedAsset.priceChange || '0') >= 0 ? 'up' : 'down'} text-xs`}></i>
                  <span className="hidden sm:inline">{state.selectedAsset.priceChangePercent}%</span>
                </span>
              </div>
            </button>
          )}

          {/* Right - Account Controls (Mobile Optimized) */}
          <div className="flex items-center gap-1 md:gap-3">
            {/* Balance Display */}
            <div className="flex items-center gap-1.5 md:gap-2 bg-secondary px-2 md:px-4 py-1.5 md:py-2 rounded-lg">
              <i className="fas fa-wallet text-accent text-sm md:text-base"></i>
              <span className="font-mono font-bold text-sm md:text-lg">
                ${currentBalance.toFixed(2)}
              </span>
            </div>

            {/* Demo/Real Toggle - Hidden on very small screens */}
            <div className="hidden sm:flex items-center gap-1 bg-secondary rounded-lg p-0.5 md:p-1">
              <button
                onClick={toggleAccount}
                className={`px-2 md:px-4 py-1 md:py-2 rounded-md font-medium text-xs md:text-sm transition-all ${
                  state.isDemoAccount
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid="button-demo-account"
              >
                تجريبي
              </button>
              <button
                onClick={toggleAccount}
                className={`px-2 md:px-4 py-1 md:py-2 rounded-md font-medium text-xs md:text-sm transition-all ${
                  !state.isDemoAccount
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid="button-real-account"
              >
                حقيقي
              </button>
            </div>

            {/* Mobile Trade Button */}
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsTradingOpen(true)}
              className="md:hidden"
              data-testid="button-open-trade"
            >
              تداول
            </Button>
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
          <div className="flex-1 p-1 md:p-4">
            <TradingChart
              asset={state.selectedAsset}
              timeframe={state.selectedTimeframe}
              onTimeframeChange={(timeframe) => updateState({ selectedTimeframe: timeframe })}
              openTrades={openTrades}
              tradeHistory={tradeHistory}
            />
          </div>

          {/* Bottom Trades Panel - Hidden on small mobile */}
          <div className="hidden md:block">
            <TradesPanel
              openTrades={openTrades}
              tradeHistory={tradeHistory}
              assets={assets}
              onCloseTrade={closeTrade}
              isClosing={isClosing}
            />
          </div>
        </main>

        {/* Right Sidebar - Trading Panel (Desktop Only) */}
        <aside className="w-96 bg-card border-r border-border p-4 overflow-y-auto hidden md:block">
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

      {/* Mobile Drawers */}
      {/* Assets Drawer */}
      <Sheet open={isAssetsOpen} onOpenChange={setIsAssetsOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md p-0">
          <SheetHeader className="px-4 pt-4 pb-2 border-b">
            <SheetTitle className="text-right">اختر الأصل للتداول</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-[calc(100vh-80px)]">
            <AssetList
              assets={assets}
              selectedAsset={state.selectedAsset}
              onAssetSelect={handleAssetSelect}
              isLoading={assetsLoading}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Trading Panel Drawer (Mobile) */}
      <Sheet open={isTradingOpen} onOpenChange={setIsTradingOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0">
          <SheetHeader className="px-4 pt-4 pb-2 border-b">
            <SheetTitle className="text-right">لوحة التداول</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-[calc(85vh-80px)] p-4">
            <TradingPanel
              selectedAsset={state.selectedAsset}
              tradeAmount={state.tradeAmount}
              timeframe={state.selectedTimeframe}
              onAmountChange={(amount) => updateState({ tradeAmount: amount })}
              onTimeframeChange={(timeframe) => updateState({ selectedTimeframe: timeframe })}
              onExecuteTrade={(type) => {
                handleExecuteTrade(type);
                setIsTradingOpen(false);
              }}
              isExecuting={isExecuting}
              balance={currentBalance}
              isDemoAccount={state.isDemoAccount}
            />
            
            {/* Trades Panel on Mobile */}
            <div className="mt-6">
              <TradesPanel
                openTrades={openTrades}
                tradeHistory={tradeHistory}
                assets={assets}
                onCloseTrade={closeTrade}
                isClosing={isClosing}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
