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

      {/* Investment Amount */}
      <div>
        <label className="block text-sm font-medium mb-2 text-muted-foreground">مبلغ الاستثمار</label>
        <div className="relative">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
          <input
            type="number"
            value={tradeAmount}
            onChange={handleAmountChange}
            min="1"
            max="1000"
            className="w-full bg-secondary border border-input rounded-lg pr-8 pl-4 py-3 text-lg font-bold font-mono focus:ring-2 focus:ring-ring transition-all"
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-2">
            {quickAmountButtons.map(amount => (
              <button
                key={amount}
                onClick={() => handleQuickAmount(amount)}
                className="px-3 py-1 bg-secondary hover:bg-muted rounded text-xs font-medium transition-colors"
              >
                +{amount}
              </button>
            ))}
          </div>
          <button
            onClick={handleMaxAmount}
            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            الحد الأقصى
          </button>
        </div>
      </div>

      {/* Payout Display */}
      {selectedAsset && (
        <div className="bg-secondary/50 rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">العائد المحتمل</span>
            <span className="text-lg font-bold text-accent">{payoutRate.toFixed(0)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">الربح المحتمل</span>
            <span className="text-xl font-bold font-mono text-success">
              ${potentialProfit.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Trade Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onExecuteTrade('CALL')}
          disabled={!canTrade}
          className="bg-success hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed text-success-foreground py-4 rounded-lg font-bold text-lg transition-all flex items-center justify-center gap-2"
        >
          {isExecuting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <i className="fas fa-arrow-up"></i>
              <span>صعود</span>
            </>
          )}
        </button>
        <button
          onClick={() => onExecuteTrade('PUT')}
          disabled={!canTrade}
          className="bg-destructive hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed text-destructive-foreground py-4 rounded-lg font-bold text-lg transition-all flex items-center justify-center gap-2"
        >
          {isExecuting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <i className="fas fa-arrow-down"></i>
              <span>هبوط</span>
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
