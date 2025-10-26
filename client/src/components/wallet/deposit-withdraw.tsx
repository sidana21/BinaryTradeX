import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, Wallet, ArrowDownToLine, ArrowUpFromLine, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';

interface DepositWithdrawProps {
  balance: number;
  onClose: () => void;
}

export function DepositWithdraw({ balance, onClose }: DepositWithdrawProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // عنوان الإيداع (في التطبيق الحقيقي، سيتم إنشاء عنوان فريد لكل مستخدم)
  const depositAddress = 'TYASr8VZJ7RdmJQcFz7TGFDdELvXaKfqVW'; // عنوان USDT TRC20 تجريبي
  const minDeposit = 10;
  const minWithdraw = 20;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      toast({
        title: 'تم النسخ! ✅',
        description: 'تم نسخ عنوان المحفظة',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل نسخ العنوان',
        variant: 'destructive',
      });
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    
    // التحقق من المدخلات
    if (!withdrawAddress || withdrawAddress.length < 30) {
      toast({
        title: 'خطأ',
        description: 'الرجاء إدخال عنوان محفظة صالح',
        variant: 'destructive',
      });
      return;
    }

    if (!amount || amount < minWithdraw) {
      toast({
        title: 'خطأ',
        description: `الحد الأدنى للسحب هو ${minWithdraw} USDT`,
        variant: 'destructive',
      });
      return;
    }

    if (amount > balance) {
      toast({
        title: 'خطأ',
        description: 'رصيدك غير كافٍ',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'demo_user',
          amount: amount.toString(),
          address: withdrawAddress,
          method: 'USDT_TRC20',
        }),
      });

      if (!response.ok) {
        throw new Error('فشل طلب السحب');
      }

      const data = await response.json();

      toast({
        title: 'تم تقديم طلب السحب! ✅',
        description: `سيتم معالجة ${amount} USDT خلال 24 ساعة`,
      });

      setWithdrawAmount('');
      setWithdrawAddress('');
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل إرسال طلب السحب',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-[#1a2847] to-[#0c1e3e] rounded-2xl shadow-2xl max-w-lg w-full border border-blue-500/20">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-blue-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">المحفظة</h2>
              <p className="text-sm text-gray-400">إيداع وسحب USDT</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Balance Display */}
        <div className="p-6 bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-b border-blue-500/20">
          <p className="text-sm text-gray-400 mb-1">الرصيد الحالي</p>
          <p className="text-3xl font-bold text-white">${balance.toFixed(2)}</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-blue-500/20">
          <button
            onClick={() => setActiveTab('deposit')}
            className={`flex-1 py-4 text-center font-semibold transition-all ${
              activeTab === 'deposit'
                ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-blue-600/5'
            }`}
          >
            <ArrowDownToLine className="w-5 h-5 inline-block ml-2" />
            إيداع USDT
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`flex-1 py-4 text-center font-semibold transition-all ${
              activeTab === 'withdraw'
                ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-blue-600/5'
            }`}
          >
            <ArrowUpFromLine className="w-5 h-5 inline-block ml-2" />
            سحب USDT
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'deposit' ? (
            <div className="space-y-6">
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-xl">
                  <QRCode value={depositAddress} size={200} />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  عنوان المحفظة (USDT TRC20)
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-[#0a0e1a] border border-blue-500/30 rounded-lg px-4 py-3 text-white font-mono text-sm overflow-hidden text-ellipsis">
                    {depositAddress}
                  </div>
                  <Button
                    onClick={handleCopy}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4"
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </Button>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h3 className="text-yellow-400 font-semibold mb-2 flex items-center gap-2">
                  <QrCode className="w-5 h-5" />
                  تعليمات الإيداع
                </h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• أرسل USDT فقط على شبكة TRC20</li>
                  <li>• الحد الأدنى للإيداع: {minDeposit} USDT</li>
                  <li>• سيتم إضافة الرصيد تلقائياً بعد التأكيد</li>
                  <li>• عدد التأكيدات المطلوبة: 1</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Withdraw Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  المبلغ (USDT)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder={`الحد الأدنى: ${minWithdraw} USDT`}
                    className="w-full bg-[#0a0e1a] border border-blue-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    min={minWithdraw}
                    max={balance}
                  />
                  <button
                    onClick={() => setWithdrawAmount(balance.toString())}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 text-sm font-semibold hover:text-blue-300"
                  >
                    الكل
                  </button>
                </div>
              </div>

              {/* Withdraw Address */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  عنوان المحفظة (USDT TRC20)
                </label>
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  placeholder="مثال: TYASr8VZJ7RdmJQcFz7TGFDdELvXaKfqVW"
                  className="w-full bg-[#0a0e1a] border border-blue-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
                />
              </div>

              {/* Withdraw Info */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">رسوم السحب:</span>
                  <span className="text-white font-semibold">1 USDT</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">المبلغ المستلم:</span>
                  <span className="text-green-400 font-semibold">
                    {withdrawAmount ? (parseFloat(withdrawAmount) - 1).toFixed(2) : '0.00'} USDT
                  </span>
                </div>
              </div>

              {/* Withdraw Button */}
              <Button
                onClick={handleWithdraw}
                disabled={isProcessing || !withdrawAmount || !withdrawAddress}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري المعالجة...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <ArrowUpFromLine className="w-5 h-5" />
                    تأكيد السحب
                  </span>
                )}
              </Button>

              {/* Warning */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h3 className="text-red-400 font-semibold mb-2">⚠️ تحذير مهم</h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• تأكد من صحة العنوان قبل التأكيد</li>
                  <li>• المعاملات غير قابلة للإلغاء</li>
                  <li>• وقت المعالجة: 1-24 ساعة</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
