import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, Wallet, RefreshCw } from "lucide-react";

interface BinomoHealth {
  status: string;
  connected: boolean;
  service: string;
}

interface BinomoBalance {
  demo: number;
  real: number;
  current: number;
}

interface BinomoAsset {
  id: string;
  name: string;
  symbol: string;
  category: string;
  isActive: boolean;
  payoutRate?: number;
}

interface BinomoCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export default function BinomoPage() {
  const { toast } = useToast();
  const [selectedAsset, setSelectedAsset] = useState<BinomoAsset | null>(null);
  const [tradeAmount, setTradeAmount] = useState(1);
  const [tradeDuration, setTradeDuration] = useState(1);

  const { data: health } = useQuery<BinomoHealth>({
    queryKey: ['/api/binomo/health'],
    refetchInterval: 5000,
  });

  const { data: balance, refetch: refetchBalance } = useQuery<BinomoBalance>({
    queryKey: ['/api/binomo/balance'],
    enabled: health?.connected,
  });

  const { data: assets, isLoading: assetsLoading } = useQuery<BinomoAsset[]>({
    queryKey: ['/api/binomo/assets'],
    enabled: health?.connected,
  });

  const { data: candles } = useQuery<BinomoCandle[]>({
    queryKey: ['/api/binomo/candles', selectedAsset?.id],
    enabled: !!selectedAsset?.id && health?.connected,
    refetchInterval: 3000,
  });

  const tradeMutation = useMutation({
    mutationFn: async ({ direction }: { direction: 'call' | 'put' }) => {
      return await apiRequest('/api/binomo/trade', 'POST', {
        asset_id: selectedAsset?.id,
        amount: tradeAmount,
        direction: direction,
        duration: tradeDuration
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "صفقة ناجحة!",
        description: `تم تنفيذ الصفقة برقم: ${data.trade_id}`,
      });
      refetchBalance();
    },
    onError: (error: any) => {
      toast({
        title: "فشل تنفيذ الصفقة",
        description: error.message || "حدث خطأ أثناء تنفيذ الصفقة",
        variant: "destructive"
      });
    }
  });

  const switchAccountMutation = useMutation({
    mutationFn: async (type: 'PRACTICE' | 'REAL') => {
      return await apiRequest('/api/binomo/account/switch', 'POST', { type });
    },
    onSuccess: () => {
      refetchBalance();
      toast({
        title: "تم التبديل",
        description: "تم تبديل الحساب بنجاح"
      });
    }
  });

  const currentPrice = candles && candles.length > 0 ? candles[candles.length - 1].close : null;

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Binomo API Integration</h1>
          <div className="flex items-center gap-2">
            {health?.connected ? (
              <Badge variant="default" className="gap-2" data-testid="badge-status">
                <CheckCircle2 className="w-4 h-4" />
                متصل
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-2" data-testid="badge-status">
                <XCircle className="w-4 h-4" />
                غير متصل
              </Badge>
            )}
          </div>
        </div>

        {health?.connected && balance && (
          <Card data-testid="card-balance">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                الرصيد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="text-sm text-muted-foreground">حساب تجريبي</div>
                  <div className="text-2xl font-bold" data-testid="text-demo-balance">${balance.demo}</div>
                </div>
                <div className="flex-1">
                  <div className="text-sm text-muted-foreground">حساب حقيقي</div>
                  <div className="text-2xl font-bold" data-testid="text-real-balance">${balance.real}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => switchAccountMutation.mutate('PRACTICE')}
                  disabled={switchAccountMutation.isPending}
                  data-testid="button-switch-demo"
                >
                  التبديل إلى التجريبي
                </Button>
                <Button 
                  onClick={() => switchAccountMutation.mutate('REAL')}
                  disabled={switchAccountMutation.isPending}
                  variant="outline"
                  data-testid="button-switch-real"
                >
                  التبديل إلى الحقيقي
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="card-assets">
            <CardHeader>
              <CardTitle>الأصول المتاحة</CardTitle>
            </CardHeader>
            <CardContent>
              {assetsLoading ? (
                <div className="text-center py-8">جاري التحميل...</div>
              ) : assets && assets.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {assets.map((asset: any) => (
                    <button
                      key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      className={`w-full p-3 rounded-lg border transition-colors text-right ${
                        selectedAsset?.id === asset.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'hover:bg-muted border-border'
                      }`}
                      data-testid={`button-asset-${asset.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold">{asset.name}</div>
                          <div className="text-sm opacity-80">{asset.symbol}</div>
                        </div>
                        {asset.payoutRate && (
                          <Badge variant="secondary" data-testid={`badge-payout-${asset.id}`}>
                            {asset.payoutRate}%
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد أصول متاحة
                </div>
              )}
            </CardContent>
          </Card>

          {selectedAsset && (
            <Card data-testid="card-trading">
              <CardHeader>
                <CardTitle>تداول {selectedAsset.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentPrice && (
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">السعر الحالي</div>
                    <div className="text-3xl font-bold" data-testid="text-current-price">
                      ${currentPrice.toFixed(2)}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">المبلغ ($)</label>
                  <input
                    type="number"
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(Number(e.target.value))}
                    min="1"
                    className="w-full p-2 border rounded-lg bg-background"
                    data-testid="input-amount"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">المدة (دقائق)</label>
                  <input
                    type="number"
                    value={tradeDuration}
                    onChange={(e) => setTradeDuration(Number(e.target.value))}
                    min="1"
                    max="60"
                    className="w-full p-2 border rounded-lg bg-background"
                    data-testid="input-duration"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4">
                  <Button
                    onClick={() => tradeMutation.mutate({ direction: 'call' })}
                    disabled={tradeMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-call"
                  >
                    <TrendingUp className="w-5 h-5 ml-2" />
                    صعود (Call)
                  </Button>
                  <Button
                    onClick={() => tradeMutation.mutate({ direction: 'put' })}
                    disabled={tradeMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                    data-testid="button-put"
                  >
                    <TrendingDown className="w-5 h-5 ml-2" />
                    هبوط (Put)
                  </Button>
                </div>

                {candles && candles.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">آخر الشموع</h4>
                      <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {candles.slice(-10).reverse().map((candle: any, idx: number) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                          data-testid={`candle-${idx}`}
                        >
                          <span>{new Date(candle.timestamp * 1000).toLocaleTimeString('ar-SA')}</span>
                          <div className="flex gap-2">
                            <span>O: {candle.open.toFixed(2)}</span>
                            <span>H: {candle.high.toFixed(2)}</span>
                            <span>L: {candle.low.toFixed(2)}</span>
                            <span className="font-bold">C: {candle.close.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
