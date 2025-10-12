import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import type { Deposit } from '@shared/schema';

export default function TransactionsPage() {
  const userId = 'demo_user';

  const { data: deposits = [], isLoading } = useQuery<Deposit[]>({
    queryKey: ['/api/deposits/user', userId],
  });

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-400 bg-emerald-500/10';
      case 'pending':
        return 'text-yellow-400 bg-yellow-500/10';
      case 'failed':
        return 'text-red-400 bg-red-500/10';
      case 'cancelled':
        return 'text-gray-400 bg-gray-500/10';
      default:
        return 'text-gray-400 bg-gray-500/10';
    }
  };

  const getStatusText = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'مكتمل';
      case 'pending':
        return 'قيد المراجعة';
      case 'failed':
        return 'فشل';
      case 'cancelled':
        return 'ملغي';
      default:
        return 'غير معروف';
    }
  };

  const getMethodText = (method: string) => {
    switch (method) {
      case 'usdt_trc20':
        return 'USDT (TRC20)';
      case 'usdt_erc20':
        return 'USDT (ERC20)';
      case 'usdt_bep20':
        return 'USDT (BEP20)';
      default:
        return method;
    }
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
          <h1 className="text-xl font-bold">سجل المعاملات</h1>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 max-w-2xl mx-auto">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#0f1535] border border-[#1a1f3a] rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : deposits.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#1a1f3a] flex items-center justify-center">
              <i className="fas fa-receipt text-gray-500 text-3xl"></i>
            </div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2">لا توجد معاملات</h3>
            <p className="text-gray-500 mb-6">لم تقم بأي معاملات إيداع حتى الآن</p>
            <Link href="/deposit">
              <Button className="bg-emerald-500 hover:bg-emerald-600" data-testid="button-new-deposit">
                <i className="fas fa-plus mr-2"></i>
                إيداع جديد
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {deposits.map((deposit) => (
              <div
                key={deposit.id}
                className="bg-[#0f1535] border border-[#1a1f3a] rounded-lg p-4 hover:border-emerald-500/30 transition-colors"
                data-testid={`transaction-${deposit.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg" data-testid={`amount-${deposit.id}`}>
                        ${parseFloat(deposit.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(deposit.status)}`} data-testid={`status-${deposit.id}`}>
                        {getStatusText(deposit.status)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">{getMethodText(deposit.method)}</p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    {deposit.createdAt && new Date(deposit.createdAt).toLocaleDateString('ar-SA', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>

                {deposit.transactionHash && (
                  <div className="bg-[#1a1f3a] rounded-lg p-3 mt-3">
                    <div className="text-xs text-gray-400 mb-1">معرف المعاملة</div>
                    <div className="font-mono text-xs break-all text-gray-300" data-testid={`hash-${deposit.id}`}>
                      {deposit.transactionHash}
                    </div>
                  </div>
                )}

                {deposit.status === 'pending' && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-yellow-400">
                    <i className="fas fa-clock"></i>
                    <span>جاري التحقق من المعاملة...</span>
                  </div>
                )}

                {deposit.status === 'completed' && deposit.completedAt && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-emerald-400">
                    <i className="fas fa-check-circle"></i>
                    <span>
                      تم الإيداع في {new Date(deposit.completedAt).toLocaleDateString('ar-SA', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {deposits.length > 0 && (
          <div className="mt-6">
            <Link href="/deposit">
              <Button className="w-full bg-emerald-500 hover:bg-emerald-600" data-testid="button-new-deposit-bottom">
                <i className="fas fa-plus mr-2"></i>
                إيداع جديد
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
