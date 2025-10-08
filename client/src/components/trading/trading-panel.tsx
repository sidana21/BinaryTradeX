import { useState } from 'react';
import type { Asset } from '@shared/schema';

interface TradingPanelProps {
  selectedAsset: Asset | null;
  tradeAmount: number;
  timeframe: string;
  onAmountChange: (amount: number) => void;
  onTimeframeChange: (timeframe: string) => void;
  onExecuteTrade: (type: 'CALL' | 'PUT') => void;
  isExecuting: boolean;
  balance: number;
  isDemoAccount: boolean;
}

export function TradingPanel({
  selectedAsset,
  tradeAmount,
  timeframe,
  onAmountChange,
  onTimeframeChange,
  onExecuteTrade,
  isExecuting,
  balance,
  isDemoAccount
}: TradingPanelProps) {
  const [quickAmountButtons] = useState([10, 50, 100]);
  
  const timeframes = [
    { key: '1m', label: '1 دقيقة' },
    { key: '5m', label: '5 دقائق' },
    { key: '15m', label: '15 دقيقة' },
    { key: '1h', label: '1 ساعة' },
  ];

  const payoutRate = selectedAsset ? parseFloat(selectedAsset.payoutRate || "82") : 82;
  const potentialProfit = (tradeAmount * payoutRate) / 100;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    if (value >= 1 && value <= 1000) {
      onAmountChange(value);
    }
  };

  const handleQuickAmount = (amount: number) => {
    const newAmount = tradeAmount + amount;
    if (newAmount <= 1000 && newAmount <= balance) {
      onAmountChange(newAmount);
    }
  };

  const handleMaxAmount = () => {
    const maxAmount = Math.min(1000, balance);
    onAmountChange(maxAmount);
  };

  const canTrade = selectedAsset && tradeAmount > 0 && tradeAmount <= balance && !isExecuting;

  return (
    <div className="space-y-4">
      {/* Asset Selector */}
      <div>
        <label className="block text-sm font-medium mb-2 text-muted-foreground">اختر الأصل</label>
        <div className="relative">
          <div className="w-full bg-secondary border border-input rounded-lg px-4 py-3 text-base font-semibold">
            {selectedAsset ? `${selectedAsset.name} - ${selectedAsset.category}` : 'اختر أصل للتداول'}
          </div>
          <i className="fas fa-chevron-down absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"></i>
        </div>
      </div>

      {/* Time Frame Selector */}
      <div>
        <label className="block text-sm font-medium mb-2 text-muted-foreground">توقيت الصفقة</label>
        <div className="grid grid-cols-2 gap-2">
          {timeframes.map(tf => (
            <button
              key={tf.key}
              onClick={() => onTimeframeChange(tf.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                timeframe === tf.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-muted'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Investment Amount - Pocket Option Style */}
      <div>
        <label className="block text-sm font-semibold mb-3 text-foreground">مبلغ الاستثمار</label>
        <div className="relative bg-gradient-to-r from-secondary/80 to-secondary rounded-xl p-1 border border-border/50">
          <div className="flex items-center gap-2 bg-background/50 rounded-lg px-4 py-2">
            <span className="text-xl font-bold text-accent">$</span>
            <input
              type="number"
              value={tradeAmount}
              onChange={handleAmountChange}
              min="1"
              max="1000"
              data-testid="input-amount"
              className="flex-1 bg-transparent border-0 outline-none text-2xl font-bold font-mono focus:ring-0 text-foreground"
            />
            <div className="flex gap-1">
              <button
                onClick={() => handleQuickAmount(-10)}
                className="w-8 h-8 bg-secondary hover:bg-muted rounded-md flex items-center justify-center transition-colors"
                data-testid="button-decrease"
              >
                <i className="fas fa-minus text-xs"></i>
              </button>
              <button
                onClick={() => handleQuickAmount(10)}
                className="w-8 h-8 bg-secondary hover:bg-muted rounded-md flex items-center justify-center transition-colors"
                data-testid="button-increase"
              >
                <i className="fas fa-plus text-xs"></i>
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-2">
            {quickAmountButtons.map(amount => (
              <button
                key={amount}
                onClick={() => handleQuickAmount(amount)}
                className="px-4 py-1.5 bg-gradient-to-r from-primary/10 to-primary/20 hover:from-primary/20 hover:to-primary/30 border border-primary/30 rounded-lg text-xs font-semibold text-primary transition-all"
                data-testid={`button-quick-${amount}`}
              >
                +${amount}
              </button>
            ))}
          </div>
          <button
            onClick={handleMaxAmount}
            className="px-3 py-1.5 bg-gradient-to-r from-accent/10 to-accent/20 border border-accent/30 rounded-lg text-xs font-semibold text-accent hover:from-accent/20 hover:to-accent/30 transition-all"
            data-testid="button-max"
          >
            <i className="fas fa-arrow-up mr-1"></i>
            الحد الأقصى
          </button>
        </div>
      </div>

      {/* Payout Display - Enhanced */}
      {selectedAsset && (
        <div className="relative bg-gradient-to-br from-accent/10 via-accent/5 to-transparent rounded-xl p-4 border border-accent/20 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                  <i className="fas fa-percentage text-accent text-sm"></i>
                </div>
                <span className="text-sm font-medium text-muted-foreground">نسبة العائد</span>
              </div>
              <div className="px-3 py-1 bg-accent/20 rounded-lg">
                <span className="text-lg font-bold text-accent">{payoutRate.toFixed(0)}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-accent/10">
              <span className="text-sm font-medium text-muted-foreground">الربح المحتمل</span>
              <div className="flex items-center gap-2">
                <i className="fas fa-dollar-sign text-emerald-500 text-sm"></i>
                <span className="text-2xl font-bold font-mono bg-gradient-to-r from-emerald-500 to-emerald-400 bg-clip-text text-transparent">
                  {potentialProfit.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trade Buttons - Pocket Option Style */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onExecuteTrade('CALL')}
          disabled={!canTrade}
          data-testid="button-buy"
          className="relative bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-6 rounded-xl font-bold text-xl transition-all flex flex-col items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/50 active:scale-95"
        >
          {isExecuting ? (
            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <i className="fas fa-arrow-up text-2xl"></i>
              <span>شراء</span>
              <span className="text-xs font-normal opacity-90">CALL</span>
            </>
          )}
        </button>
        <button
          onClick={() => onExecuteTrade('PUT')}
          disabled={!canTrade}
          data-testid="button-sell"
          className="relative bg-gradient-to-br from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-6 rounded-xl font-bold text-xl transition-all flex flex-col items-center justify-center gap-2 shadow-lg hover:shadow-rose-500/50 active:scale-95"
        >
          {isExecuting ? (
            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <i className="fas fa-arrow-down text-2xl"></i>
              <span>بيع</span>
              <span className="text-xs font-normal opacity-90">PUT</span>
            </>
          )}
        </button>
      </div>

      {/* Trading Tips */}
      <div className="bg-secondary/30 rounded-lg p-4 border border-border/50">
        <div className="flex items-start gap-3">
          <i className="fas fa-lightbulb text-accent text-lg"></i>
          <div>
            <h4 className="font-semibold text-sm mb-1">نصيحة التداول</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isDemoAccount 
                ? 'استخدم الحساب التجريبي لتجربة استراتيجياتك قبل التداول بأموال حقيقية.'
                : 'تذكر أن التداول يحمل مخاطر. لا تستثمر أكثر مما تستطيع تحمل خسارته.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="space-y-3 pt-4 border-t border-border">
        <h3 className="font-semibold text-sm text-muted-foreground">معلومات الحساب</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary/50 rounded-lg p-3 border border-border">
            <div className="text-xs text-muted-foreground mb-1">الرصيد المتاح</div>
            <div className="text-lg font-bold font-mono text-accent">
              ${balance.toFixed(2)}
            </div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 border border-border">
            <div className="text-xs text-muted-foreground mb-1">نوع الحساب</div>
            <div className="text-lg font-bold">
              {isDemoAccount ? 'تجريبي' : 'حقيقي'}
            </div>
          </div>
        </div>
      </div>

      {/* Market Status */}
      <div className="bg-secondary/30 rounded-lg p-4 border border-border/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">حالة السوق</h3>
          <span className="px-2 py-1 bg-success/20 text-success rounded text-xs font-medium flex items-center gap-1">
            <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
            مفتوح
          </span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">ساعات التداول</span>
            <span className="font-mono">24/7</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">التوقيت</span>
            <span className="font-mono">
              {new Date().toLocaleTimeString('ar-SA')} GMT
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
