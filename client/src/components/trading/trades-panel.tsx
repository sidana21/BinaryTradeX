import { useState } from 'react';
import type { Trade, Asset } from '@shared/schema';

interface TradesPanelProps {
  openTrades: Trade[];
  tradeHistory: Trade[];
  assets: Asset[];
  onCloseTrade: (tradeId: string) => void;
  isClosing: boolean;
}

export function TradesPanel({ openTrades, tradeHistory, assets, onCloseTrade, isClosing }: TradesPanelProps) {
  const [activeTab, setActiveTab] = useState<'open' | 'history' | 'indicators'>('open');

  const getAssetName = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    return asset?.name || assetId;
  };

  const formatTimeRemaining = (expiryTime: string | Date) => {
    const expiry = new Date(expiryTime);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return '00:00';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const calculatePnL = (trade: Trade) => {
    if (!trade.closePrice || !trade.openPrice) return 0;
    
    const openPrice = parseFloat(trade.openPrice);
    const closePrice = parseFloat(trade.closePrice);
    const amount = parseFloat(trade.amount);
    
    const isWin = (trade.type === 'CALL' && closePrice > openPrice) ||
                  (trade.type === 'PUT' && closePrice < openPrice);
    
    return isWin ? amount * 0.82 : -amount; // 82% payout rate
  };

  const tabs = [
    { key: 'open' as const, label: 'الصفقات المفتوحة', icon: 'fas fa-history' },
    { key: 'history' as const, label: 'السجل', icon: 'fas fa-list' },
    { key: 'indicators' as const, label: 'المؤشرات الفنية', icon: 'fas fa-chart-line' },
  ];

  return (
    <div className="bg-card border-t border-border">
      {/* Tab Headers */}
      <div className="flex items-center gap-1 px-4 pt-3 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <i className={tab.icon}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4 h-48 overflow-y-auto">
        {activeTab === 'open' && (
          <div className="space-y-2">
            {openTrades.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                <i className="fas fa-inbox text-2xl mb-2"></i>
                <p>لا توجد صفقات مفتوحة</p>
              </div>
            ) : (
              openTrades.map(trade => {
                const asset = assets.find(a => a.id === trade.assetId);
                const currentPrice = asset?.currentPrice || trade.openPrice;
                const openPrice = parseFloat(trade.openPrice);
                const currentPriceNum = parseFloat(currentPrice);
                
                const isWinning = (trade.type === 'CALL' && currentPriceNum > openPrice) ||
                                 (trade.type === 'PUT' && currentPriceNum < openPrice);
                
                const unrealizedPnL = isWinning 
                  ? parseFloat(trade.amount) * 0.82 
                  : -parseFloat(trade.amount);

                return (
                  <div key={trade.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border transition-all hover:bg-secondary">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">الأصل</span>
                        <span className="font-semibold">{getAssetName(trade.assetId)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">النوع</span>
                        <span className={`flex items-center gap-1 ${trade.type === 'CALL' ? 'text-success' : 'text-destructive'}`}>
                          <i className={`fas fa-arrow-${trade.type === 'CALL' ? 'up' : 'down'}`}></i>
                          <span className="font-medium">{trade.type === 'CALL' ? 'صعود' : 'هبوط'}</span>
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">المبلغ</span>
                        <span className="font-mono font-semibold">${trade.amount}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">السعر</span>
                        <span className="font-mono">{trade.openPrice}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">الوقت المتبقي</span>
                        <span className="font-mono text-accent">
                          {formatTimeRemaining(trade.expiryTime)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <div className="text-xs text-muted-foreground">الربح/الخسارة</div>
                        <div className={`font-mono font-bold ${isWinning ? 'text-success' : 'text-destructive'}`}>
                          {isWinning ? '+' : ''}${unrealizedPnL.toFixed(2)}
                        </div>
                      </div>
                      <button
                        onClick={() => onCloseTrade(trade.id)}
                        disabled={isClosing}
                        className="px-3 py-1.5 bg-destructive hover:bg-destructive/90 disabled:opacity-50 text-destructive-foreground rounded-md text-xs font-medium transition-colors"
                      >
                        {isClosing ? 'جاري الإغلاق...' : 'إغلاق'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            {tradeHistory.filter(trade => trade.status !== 'open').length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                <i className="fas fa-history text-2xl mb-2"></i>
                <p>لا يوجد سجل صفقات</p>
              </div>
            ) : (
              tradeHistory
                .filter(trade => trade.status !== 'open')
                .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                .map(trade => {
                  const pnl = calculatePnL(trade);
                  const isWon = trade.status === 'won';

                  return (
                    <div key={trade.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border/50">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">الأصل</span>
                          <span className="font-semibold">{getAssetName(trade.assetId)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">النوع</span>
                          <span className={`flex items-center gap-1 ${trade.type === 'CALL' ? 'text-success' : 'text-destructive'}`}>
                            <i className={`fas fa-arrow-${trade.type === 'CALL' ? 'up' : 'down'}`}></i>
                            <span className="font-medium">{trade.type === 'CALL' ? 'صعود' : 'هبوط'}</span>
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">المبلغ</span>
                          <span className="font-mono font-semibold">${trade.amount}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">الوقت</span>
                          <span className="text-xs">{new Date(trade.createdAt || 0).toLocaleDateString('ar-SA')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-left">
                          <div className="text-xs text-muted-foreground">النتيجة</div>
                          <div className={`font-mono font-bold ${isWon ? 'text-success' : 'text-destructive'}`}>
                            {isWon ? '+' : ''}${pnl.toFixed(2)}
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                          isWon ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                        }`}>
                          {isWon ? 'فوز' : 'خسارة'}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}

        {activeTab === 'indicators' && (
          <div className="text-center text-muted-foreground text-sm py-8">
            <i className="fas fa-chart-line text-2xl mb-2"></i>
            <p>المؤشرات الفنية</p>
            <p className="text-xs mt-1">ستتوفر قريباً</p>
          </div>
        )}
      </div>
    </div>
  );
}
