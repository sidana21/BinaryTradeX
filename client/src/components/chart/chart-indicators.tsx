import { useState } from 'react';
import { TrendingUp, Minus, PenTool, Layers, X } from 'lucide-react';

export interface Indicator {
  id: string;
  name: string;
  type: 'ma' | 'ema' | 'rsi' | 'macd' | 'bb' | 'stochastic';
  enabled: boolean;
  color?: string;
  period?: number;
}

export interface DrawingTool {
  id: string;
  name: string;
  type: 'trendline' | 'horizontal' | 'vertical' | 'rectangle' | 'fibonacci';
  icon: string;
}

interface ChartIndicatorsProps {
  onIndicatorToggle: (indicator: Indicator) => void;
  onDrawingToolSelect: (tool: DrawingTool) => void;
  activeIndicators: Indicator[];
}

export function ChartIndicators({ onIndicatorToggle, onDrawingToolSelect, activeIndicators }: ChartIndicatorsProps) {
  const [showIndicators, setShowIndicators] = useState(false);
  const [showDrawingTools, setShowDrawingTools] = useState(false);

  const availableIndicators: Indicator[] = [
    { id: 'ma20', name: 'MA (20)', type: 'ma', enabled: false, color: '#2196F3', period: 20 },
    { id: 'ma50', name: 'MA (50)', type: 'ma', enabled: false, color: '#FF9800', period: 50 },
    { id: 'ema12', name: 'EMA (12)', type: 'ema', enabled: false, color: '#4CAF50', period: 12 },
    { id: 'ema26', name: 'EMA (26)', type: 'ema', enabled: false, color: '#F44336', period: 26 },
    { id: 'rsi', name: 'RSI (14)', type: 'rsi', enabled: false, color: '#9C27B0', period: 14 },
    { id: 'macd', name: 'MACD', type: 'macd', enabled: false, color: '#00BCD4' },
    { id: 'bb', name: 'Bollinger Bands', type: 'bb', enabled: false, color: '#FFC107', period: 20 },
  ];

  const drawingTools: DrawingTool[] = [
    { id: 'trendline', name: 'خط الاتجاه', type: 'trendline', icon: '📈' },
    { id: 'horizontal', name: 'خط أفقي', type: 'horizontal', icon: '➖' },
    { id: 'vertical', name: 'خط عمودي', type: 'vertical', icon: '|' },
    { id: 'rectangle', name: 'مستطيل', type: 'rectangle', icon: '▭' },
    { id: 'fibonacci', name: 'فيبوناتشي', type: 'fibonacci', icon: '🔢' },
  ];

  const isIndicatorActive = (indicatorId: string) => {
    return activeIndicators.some(ind => ind.id === indicatorId);
  };

  return (
    <div className="absolute top-2 left-2 z-10 flex gap-2">
      {/* Indicators Button */}
      <div className="relative">
        <button
          onClick={() => {
            setShowIndicators(!showIndicators);
            setShowDrawingTools(false);
          }}
          className="bg-[#1a2033] hover:bg-[#252b4a] text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors border border-gray-800 shadow-lg"
          title="المؤشرات الفنية"
        >
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm hidden sm:inline">مؤشرات</span>
        </button>

        {showIndicators && (
          <div className="absolute top-full mt-2 left-0 bg-[#14192a] border border-gray-800 rounded-lg shadow-xl min-w-[200px] overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">المؤشرات الفنية</span>
              <button
                onClick={() => setShowIndicators(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {availableIndicators.map((indicator) => {
                const isActive = isIndicatorActive(indicator.id);
                return (
                  <button
                    key={indicator.id}
                    onClick={() => {
                      onIndicatorToggle({ ...indicator, enabled: !isActive });
                    }}
                    className={`w-full px-3 py-2.5 text-left hover:bg-[#1a2033] transition-colors flex items-center justify-between ${
                      isActive ? 'bg-[#1a2033]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: indicator.color }}
                      ></div>
                      <span className="text-sm text-white">{indicator.name}</span>
                    </div>
                    {isActive && (
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Drawing Tools Button */}
      <div className="relative">
        <button
          onClick={() => {
            setShowDrawingTools(!showDrawingTools);
            setShowIndicators(false);
          }}
          className="bg-[#1a2033] hover:bg-[#252b4a] text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors border border-gray-800 shadow-lg"
          title="أدوات الرسم"
        >
          <PenTool className="w-4 h-4" />
          <span className="text-sm hidden sm:inline">أدوات</span>
        </button>

        {showDrawingTools && (
          <div className="absolute top-full mt-2 left-0 bg-[#14192a] border border-gray-800 rounded-lg shadow-xl min-w-[180px] overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">أدوات الرسم</span>
              <button
                onClick={() => setShowDrawingTools(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              {drawingTools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => {
                    onDrawingToolSelect(tool);
                    setShowDrawingTools(false);
                  }}
                  className="w-full px-3 py-2.5 text-left hover:bg-[#1a2033] transition-colors flex items-center gap-2"
                >
                  <span className="text-lg">{tool.icon}</span>
                  <span className="text-sm text-white">{tool.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Active Indicators Display */}
      {activeIndicators.length > 0 && (
        <div className="flex items-center gap-1 bg-[#1a2033] px-2 py-1 rounded-lg border border-gray-800">
          <Layers className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-gray-400">{activeIndicators.length}</span>
        </div>
      )}
    </div>
  );
}

// Helper functions to calculate indicators
export function calculateMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      result.push(sum / period);
    }
  }
  return result;
}

export function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // First EMA is SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    if (i < data.length) {
      sum += data[i];
    }
  }
  result.push(sum / period);
  
  // Calculate EMA
  for (let i = period; i < data.length; i++) {
    const ema = (data[i] - result[result.length - 1]) * multiplier + result[result.length - 1];
    result.push(ema);
  }
  
  return result;
}

export function calculateRSI(data: number[], period: number = 14): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  // Calculate RSI
  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let avgGain = 0;
      let avgLoss = 0;
      
      for (let j = 0; j < period; j++) {
        avgGain += gains[i - j];
        avgLoss += losses[i - j];
      }
      
      avgGain /= period;
      avgLoss /= period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      result.push(rsi);
    }
  }
  
  return result;
}

export function calculateBollingerBands(data: number[], period: number = 20, stdDev: number = 2): { upper: number[], middle: number[], lower: number[] } {
  const middle = calculateMA(data, period);
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += Math.pow(data[i - j] - middle[i], 2);
      }
      const std = Math.sqrt(sum / period);
      upper.push(middle[i] + (std * stdDev));
      lower.push(middle[i] - (std * stdDev));
    }
  }
  
  return { upper, middle, lower };
}
