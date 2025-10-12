import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { InsertDeposit } from '@shared/schema';

export default function DepositPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<'usdt_trc20' | 'usdt_erc20' | 'usdt_bep20'>('usdt_trc20');
  const [transactionHash, setTransactionHash] = useState('');
  const [copied, setCopied] = useState(false);

  const walletAddresses = {
    usdt_trc20: 'TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXxx',
    usdt_erc20: '0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    usdt_bep20: '0xYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
  };

  const depositMutation = useMutation({
    mutationFn: async (depositData: InsertDeposit) => {
      const response = await apiRequest('POST', '/api/deposits', depositData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'تم إرسال الطلب',
        description: 'سيتم مراجعة طلب الإيداع الخاص بك قريباً',
      });
      setAmount('');
      setTransactionHash('');
      queryClient.invalidateQueries({ queryKey: ['/api/deposits/user', 'demo_user'] });
    },
    onError: () => {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إرسال طلب الإيداع',
        variant: 'destructive',
      });
    },
  });

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(walletAddresses[selectedMethod]);
    setCopied(true);
    toast({
      title: 'تم النسخ',
      description: 'تم نسخ العنوان إلى الحافظة',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال مبلغ صحيح',
        variant: 'destructive',
      });
      return;
    }

    if (!transactionHash) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال معرف المعاملة',
        variant: 'destructive',
      });
      return;
    }

    depositMutation.mutate({
      userId: 'demo_user',
      amount: amount,
      method: selectedMethod,
      transactionHash,
      walletAddress: walletAddresses[selectedMethod],
      status: 'pending',
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0e27] text-white">
      {/* Header */}
      <header className="bg-[#0f1535] border-b border-[#1a1f3a] px-4 py-4">
        <div className="flex items-center gap-4">
          <Link href="/trading">
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">شحن الحساب</h1>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 max-w-2xl mx-auto">
        {/* Payment Methods */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">اختر طريقة الدفع</h2>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => setSelectedMethod('usdt_trc20')}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedMethod === 'usdt_trc20'
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-[#1a1f3a] bg-[#0f1535] hover:border-emerald-500/50'
              }`}
              data-testid="button-method-trc20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <i className="fas fa-coins text-emerald-400 text-xl"></i>
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">USDT (TRC20)</div>
                    <div className="text-sm text-gray-400">Tron Network - رسوم منخفضة</div>
                  </div>
                </div>
                {selectedMethod === 'usdt_trc20' && (
                  <i className="fas fa-check-circle text-emerald-400 text-xl"></i>
                )}
              </div>
            </button>

            <button
              onClick={() => setSelectedMethod('usdt_erc20')}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedMethod === 'usdt_erc20'
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-[#1a1f3a] bg-[#0f1535] hover:border-emerald-500/50'
              }`}
              data-testid="button-method-erc20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <i className="fab fa-ethereum text-blue-400 text-xl"></i>
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">USDT (ERC20)</div>
                    <div className="text-sm text-gray-400">Ethereum Network</div>
                  </div>
                </div>
                {selectedMethod === 'usdt_erc20' && (
                  <i className="fas fa-check-circle text-emerald-400 text-xl"></i>
                )}
              </div>
            </button>

            <button
              onClick={() => setSelectedMethod('usdt_bep20')}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedMethod === 'usdt_bep20'
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-[#1a1f3a] bg-[#0f1535] hover:border-emerald-500/50'
              }`}
              data-testid="button-method-bep20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <i className="fas fa-link text-yellow-400 text-xl"></i>
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">USDT (BEP20)</div>
                    <div className="text-sm text-gray-400">Binance Smart Chain</div>
                  </div>
                </div>
                {selectedMethod === 'usdt_bep20' && (
                  <i className="fas fa-check-circle text-emerald-400 text-xl"></i>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Wallet Address */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">عنوان المحفظة</h2>
          <div className="bg-[#0f1535] border border-[#1a1f3a] rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 overflow-hidden">
                <div className="text-sm text-gray-400 mb-1">أرسل USDT إلى هذا العنوان</div>
                <div className="font-mono text-sm break-all" data-testid="text-wallet-address">
                  {walletAddresses[selectedMethod]}
                </div>
              </div>
              <Button
                onClick={handleCopyAddress}
                variant="outline"
                size="icon"
                className="shrink-0"
                data-testid="button-copy-address"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Deposit Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">المبلغ (USDT)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="أدخل المبلغ"
              min="1"
              step="0.01"
              className="bg-[#0f1535] border-[#1a1f3a] text-white"
              data-testid="input-amount"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">معرف المعاملة (Transaction Hash)</label>
            <Input
              type="text"
              value={transactionHash}
              onChange={(e) => setTransactionHash(e.target.value)}
              placeholder="أدخل معرف المعاملة بعد الإرسال"
              className="bg-[#0f1535] border-[#1a1f3a] text-white"
              data-testid="input-transaction-hash"
            />
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <i className="fas fa-info-circle text-blue-400 text-xl shrink-0"></i>
              <div className="text-sm text-gray-300">
                <p className="mb-2">تعليمات مهمة:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>قم بإرسال USDT فقط على الشبكة المختارة</li>
                  <li>انتظر تأكيد المعاملة على البلوكشين</li>
                  <li>أدخل معرف المعاملة (Hash) بعد الإرسال</li>
                  <li>سيتم إضافة الرصيد بعد التحقق من المعاملة</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-6 text-lg"
            disabled={depositMutation.isPending}
            data-testid="button-submit-deposit"
          >
            {depositMutation.isPending ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                جاري الإرسال...
              </>
            ) : (
              <>
                <i className="fas fa-check mr-2"></i>
                تأكيد الإيداع
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
