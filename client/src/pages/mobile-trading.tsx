import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/use-websocket';
import type { Asset, Trade } from '@shared/schema';
import { TrendingUp, TrendingDown, Clock, DollarSign } from 'lucide-react';

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export default function MobileTradingPage() {
  const { toast } = useToast();
  const { lastMessage } = useWebSocket('/ws');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [tradeAmount, setTradeAmount] = useState(10);
  const [tradeDuration, setTradeDuration] = useState(1);
  const [payout, setPayout] = useState(90);
  const [balance, setBalance] = useState(49499.90);
  const [timeRemaining, setTimeRemaining] = useState('23:56:16');

  // Fetch assets
  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['/api/assets'],
  });

  // Fetch candle data
  const { data: candles = [] } = useQuery<Candle[]>({
    queryKey: [`/api/binomo/candles/${selectedAsset?.id}/1m`],
    enabled: !!selectedAsset,
    refetchInterval: 3000,
  });

  // Set default asset
  useEffect(() => {
    if (assets.length > 0 && !selectedAsset) {
      const defaultAsset = assets.find(a => a.id === 'USDJPY_OTC') || assets[0];
      setSelectedAsset(defaultAsset);
    }
  }, [assets, selectedAsset]);

  // Update price from WebSocket
  useEffect(() => {
    if (lastMessage?.type === 'price_update' && selectedAsset) {
      const updates = lastMessage.data;
      const assetUpdate = updates.find((update: any) => update.id === selectedAsset.id);
      if (assetUpdate) {
        setSelectedAsset({
          ...selectedAsset,
          currentPrice: assetUpdate.price,
        });
      }
    }
  }, [lastMessage, selectedAsset]);

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

  // Trade mutation
  const tradeMutation = useMutation({
    mutationFn: async (direction: 'CALL' | 'PUT') => {
      if (!selectedAsset) throw new Error('No asset selected');
      const expiryTime = new Date(Date.now() + tradeDuration * 60000);
      return await apiRequest('POST', '/api/trades', {
        userId: 'demo_user',
        assetId: selectedAsset.id,
        type: direction,
        amount: tradeAmount.toString(),
        openPrice: selectedAsset.currentPrice,
        expiryTime: expiryTime.toISOString(),
        isDemo: true,
      });
    },
    onSuccess: () => {
      toast({
        title: 'تم تنفيذ الصفقة',
        description: `صفقة بمبلغ $${tradeAmount}`,
      });
      setBalance(prev => prev - tradeAmount);
    },
    onError: (error: any) => {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل تنفيذ الصفقة',
        variant: 'destructive',
      });
    }
  });

  // Draw chart
  useEffect(() => {
    if (!canvasRef.current || candles.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas with dark background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, '#1a1e2e');
    bgGradient.addColorStop(1, '#0f1118');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate price range
    const prices = candles.flatMap(c => [c.high, c.low]);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const priceRange = maxPrice - minPrice || 1;
    const padding = priceRange * 0.1;

    // Calculate dimensions
    const rightMargin = 80;
    const leftMargin = 10;
    const topMargin = 10;
    const bottomMargin = 30;
    const chartWidth = canvas.width - leftMargin - rightMargin;
    const chartHeight = canvas.height - topMargin - bottomMargin;
    
    const visibleCandles = Math.min(candles.length, 60);
    const candleWidth = Math.max(3, chartWidth / visibleCandles - 2);
    const candleSpacing = chartWidth / visibleCandles;
    const startIndex = Math.max(0, candles.length - visibleCandles);

    // Scale price to Y coordinate
    const scalePrice = (price: number) => {
      return topMargin + chartHeight - ((price - (minPrice - padding)) / (priceRange + padding * 2)) * chartHeight;
    };

    // Draw horizontal grid lines
    const gridSteps = 6;
    for (let i = 0; i <= gridSteps; i++) {
      const price = minPrice - padding + (priceRange + padding * 2) * (i / gridSteps);
      const y = scalePrice(price);
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(canvas.width - rightMargin, y);
      ctx.stroke();
      
      // Draw price labels on right
      const labelText = price.toFixed(3);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(labelText, canvas.width - rightMargin + 5, y + 4);
    }

    // Draw candlesticks
    candles.slice(startIndex).forEach((candle, i) => {
      const x = leftMargin + i * candleSpacing + candleSpacing / 2;
      const isGreen = candle.close >= candle.open;
      
      const openY = scalePrice(candle.open);
      const closeY = scalePrice(candle.close);
      const highY = scalePrice(candle.high);
      const lowY = scalePrice(candle.low);
      
      const bodyHeight = Math.max(Math.abs(closeY - openY), 1);
      const bodyY = Math.min(openY, closeY);
      
      // Colors from the screenshot
      const greenColor = '#22c55e'; // bright green
      const redColor = '#ef4444'; // red
      
      // Draw wick
      ctx.strokeStyle = isGreen ? greenColor : redColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();
      
      // Draw body
      ctx.fillStyle = isGreen ? greenColor : redColor;
      ctx.fillRect(x - candleWidth/2, bodyY, candleWidth, bodyHeight);
    });

    // Draw current price line
    if (selectedAsset) {
      const currentPrice = parseFloat(selectedAsset.currentPrice);
      const currentPriceY = scalePrice(currentPrice);
      
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(leftMargin, currentPriceY);
      ctx.lineTo(canvas.width - rightMargin, currentPriceY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Current price label
      const priceText = currentPrice.toFixed(3);
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
      const textWidth = ctx.measureText(priceText).width;
      
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(canvas.width - rightMargin + 2, currentPriceY - 10, textWidth + 8, 20);
      
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(priceText, canvas.width - rightMargin + 6, currentPriceY + 4);
    }
  }, [candles, selectedAsset]);

  const currentPrice = selectedAsset ? parseFloat(selectedAsset.currentPrice) : 0;
  const profit = (tradeAmount * payout / 100).toFixed(2);

  return (
    <div className="h-screen w-screen bg-[#0f1118] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-[#1a1e2e] px-4 py-3 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
          <div>
            <div className="text-gray-400 text-xs">QT Demo</div>
            <div className="text-white text-lg font-bold">
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
          <DollarSign className="text-green-500 w-6 h-6" />
        </div>
      </div>

      {/* Asset Info */}
      <div className="bg-[#1a1e2e] px-4 py-2 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              className="text-white font-medium text-sm flex items-center gap-1"
              data-testid="button-asset-selector"
            >
              {selectedAsset?.symbol || 'USD/JPY OTC'} ▼
            </button>
          </div>
          <div className="text-gray-400 text-xs flex items-center gap-2">
            <Clock className="w-3 h-3" />
            Délai d'expiration {timeRemaining}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="text-white text-2xl font-bold" data-testid="text-asset-price">
            ${currentPrice.toFixed(3)}
          </div>
          <div className="text-green-400 text-sm">↑ 0.23%</div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          data-testid="mobile-chart-canvas"
        />
      </div>

      {/* Trading Controls */}
      <div className="bg-[#1a1e2e] px-4 py-3 border-t border-gray-800">
        {/* Time and Amount */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="text-gray-400 text-xs mb-1">Temps</div>
            <button 
              className="w-full bg-[#0f1118] text-white px-3 py-2 rounded-lg flex items-center justify-between border border-gray-700"
              data-testid="button-time-selector"
            >
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">00:01:00</span>
            </button>
          </div>
          <div>
            <div className="text-gray-400 text-xs mb-1">Montant</div>
            <button 
              className="w-full bg-[#0f1118] text-white px-3 py-2 rounded-lg flex items-center justify-between border border-gray-700"
              data-testid="button-amount-selector"
            >
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-medium">{tradeAmount}</span>
            </button>
          </div>
        </div>

        {/* Payout and Profit */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-gray-400 text-xs">Paiement</div>
            <div className="text-sm" data-testid="text-payout">
              <span className="text-gray-300">${tradeAmount}</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-green-400 text-2xl font-bold">+{payout}%</div>
          </div>
          <div className="text-right">
            <div className="text-gray-400 text-xs">Profit</div>
            <div className="text-sm" data-testid="text-profit">
              <span className="text-green-400">+${profit}</span>
            </div>
          </div>
        </div>

        {/* Trade Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => tradeMutation.mutate('CALL')}
            disabled={tradeMutation.isPending}
            className="bg-gradient-to-b from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 transition-all active:scale-95"
            data-testid="button-achat"
          >
            <TrendingUp className="w-5 h-5" />
            ACHAT
          </button>
          <button
            onClick={() => tradeMutation.mutate('PUT')}
            disabled={tradeMutation.isPending}
            className="bg-gradient-to-b from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 transition-all active:scale-95"
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
