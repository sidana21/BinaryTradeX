import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { ArrowLeft, Users, DollarSign, TrendingUp, Activity, Settings as SettingsIcon } from 'lucide-react';
import type { User, Deposit, Trade, Settings, Withdrawal } from '@shared/schema';

interface AdminStats {
  users: { total: number };
  deposits: { total: number; pending: number; completed: number; count: number };
  trades: { total: number; open: number; won: number; lost: number; volume: number; payout: number };
  withdrawals: { total: number; pending: number; completed: number; count: number };
}

export default function AdminPage() {
  const { toast } = useToast();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [demoBalance, setDemoBalance] = useState('');
  const [realBalance, setRealBalance] = useState('');
  const [winRate, setWinRate] = useState('');
  const [usdtTrc20Address, setUsdtTrc20Address] = useState('');
  const [usdtErc20Address, setUsdtErc20Address] = useState('');
  const [usdtBep20Address, setUsdtBep20Address] = useState('');

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
    refetchInterval: 3000, // Auto-refresh every 3 seconds
    refetchOnWindowFocus: true,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
    refetchInterval: 5000, // Auto-refresh every 5 seconds
    refetchOnWindowFocus: true,
  });

  const { data: deposits = [] } = useQuery<Deposit[]>({
    queryKey: ['/api/admin/deposits'],
    refetchInterval: 3000, // Auto-refresh every 3 seconds
    refetchOnWindowFocus: true,
  });

  const { data: trades = [] } = useQuery<Trade[]>({
    queryKey: ['/api/admin/trades'],
  });

  const { data: withdrawals = [] } = useQuery<Withdrawal[]>({
    queryKey: ['/api/admin/withdrawals'],
    refetchInterval: 3000, // Auto-refresh every 3 seconds
    refetchOnWindowFocus: true,
  });

  const { data: settings } = useQuery<Settings>({
    queryKey: ['/api/admin/settings'],
  });

  const updateBalanceMutation = useMutation({
    mutationFn: async ({ userId, demoBalance, realBalance }: { userId: string; demoBalance: string; realBalance: string }) => {
      return apiRequest('PATCH', `/api/admin/users/${userId}/balance`, { demoBalance, realBalance });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      setEditingUserId(null);
      toast({
        title: 'تم التحديث',
        description: 'تم تحديث رصيد المستخدم بنجاح',
      });
    },
    onError: () => {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تحديث الرصيد',
        variant: 'destructive',
      });
    },
  });

  const updateDepositStatusMutation = useMutation({
    mutationFn: async ({ depositId, status }: { depositId: string; status: string }) => {
      return apiRequest('PATCH', `/api/deposits/${depositId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/deposits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: 'تم التحديث',
        description: 'تم تحديث حالة الإيداع بنجاح',
      });
    },
    onError: () => {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تحديث حالة الإيداع',
        variant: 'destructive',
      });
    },
  });

  const updateWithdrawalStatusMutation = useMutation({
    mutationFn: async ({ withdrawalId, status, notes }: { withdrawalId: string; status: string; notes?: string }) => {
      return apiRequest('PATCH', `/api/withdrawals/${withdrawalId}/status`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: 'تم التحديث',
        description: 'تم تحديث حالة السحب بنجاح',
      });
    },
    onError: () => {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تحديث حالة السحب',
        variant: 'destructive',
      });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { winRate?: string; usdtTrc20Address?: string; usdtErc20Address?: string; usdtBep20Address?: string }) => {
      return apiRequest('PATCH', '/api/admin/settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      setWinRate('');
      setUsdtTrc20Address('');
      setUsdtErc20Address('');
      setUsdtBep20Address('');
      toast({
        title: 'تم التحديث',
        description: 'تم تحديث الإعدادات بنجاح',
      });
    },
    onError: () => {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تحديث الإعدادات',
        variant: 'destructive',
      });
    },
  });

  const handleUpdateBalance = (userId: string) => {
    if (demoBalance && realBalance) {
      updateBalanceMutation.mutate({ userId, demoBalance, realBalance });
    }
  };

  const handleUpdateSettings = () => {
    const updates: any = {};
    if (winRate) updates.winRate = winRate;
    if (usdtTrc20Address) updates.usdtTrc20Address = usdtTrc20Address;
    if (usdtErc20Address) updates.usdtErc20Address = usdtErc20Address;
    if (usdtBep20Address) updates.usdtBep20Address = usdtBep20Address;
    
    if (Object.keys(updates).length > 0) {
      updateSettingsMutation.mutate(updates);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      completed: 'default',
      failed: 'destructive',
      cancelled: 'outline',
      open: 'secondary',
      won: 'default',
      lost: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <div className="min-h-screen bg-[#0a0e27] text-white p-6">
      <header className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/trading">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">لوحة تحكم المشرف</h1>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-[#0f1535] border-[#1a1f3a]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">إجمالي المستخدمين</CardTitle>
                <Users className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white" data-testid="text-total-users">{stats.users.total}</div>
              </CardContent>
            </Card>

            <Card className="bg-[#0f1535] border-[#1a1f3a]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">إجمالي الودائع</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white" data-testid="text-total-deposits">
                  ${stats.deposits.total.toFixed(2)}
                </div>
                <p className="text-xs text-gray-500">
                  {stats.deposits.pending} قيد الانتظار / {stats.deposits.completed} مكتمل
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#0f1535] border-[#1a1f3a]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">إجمالي الصفقات</CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white" data-testid="text-total-trades">{stats.trades.total}</div>
                <p className="text-xs text-gray-500">
                  {stats.trades.won} ربح / {stats.trades.lost} خسارة
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#0f1535] border-[#1a1f3a]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">حجم التداول</CardTitle>
                <Activity className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white" data-testid="text-trade-volume">
                  ${stats.trades.volume.toFixed(2)}
                </div>
                <p className="text-xs text-gray-500">
                  عوائد: ${stats.trades.payout.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </header>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="bg-[#0f1535] border-[#1a1f3a]">
          <TabsTrigger value="users" data-testid="tab-users">المستخدمون</TabsTrigger>
          <TabsTrigger value="deposits" data-testid="tab-deposits" className="relative">
            الودائع
            {stats && stats.deposits.pending > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                {stats.deposits.pending}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="withdrawals" data-testid="tab-withdrawals" className="relative">
            السحوبات
            {stats && stats.withdrawals.pending > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                {stats.withdrawals.pending}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="trades" data-testid="tab-trades">الصفقات</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">الإعدادات</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card className="bg-[#0f1535] border-[#1a1f3a]">
            <CardHeader>
              <CardTitle className="text-white">إدارة المستخدمين</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1a1f3a]">
                    <TableHead className="text-gray-400">المعرف</TableHead>
                    <TableHead className="text-gray-400">اسم المستخدم</TableHead>
                    <TableHead className="text-gray-400">الرصيد التجريبي</TableHead>
                    <TableHead className="text-gray-400">الرصيد الحقيقي</TableHead>
                    <TableHead className="text-gray-400">مشرف</TableHead>
                    <TableHead className="text-gray-400">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="border-[#1a1f3a]" data-testid={`row-user-${user.id}`}>
                      <TableCell className="text-gray-300 font-mono text-xs">{user.id.slice(0, 8)}...</TableCell>
                      <TableCell className="text-white">{user.username}</TableCell>
                      <TableCell className="text-gray-300">
                        {editingUserId === user.id ? (
                          <Input
                            type="number"
                            value={demoBalance}
                            onChange={(e) => setDemoBalance(e.target.value)}
                            className="w-24 bg-[#1a1f3a] border-[#252b4a] text-white"
                            data-testid={`input-demo-balance-${user.id}`}
                          />
                        ) : (
                          `$${parseFloat(user.demoBalance || '0').toFixed(2)}`
                        )}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {editingUserId === user.id ? (
                          <Input
                            type="number"
                            value={realBalance}
                            onChange={(e) => setRealBalance(e.target.value)}
                            className="w-24 bg-[#1a1f3a] border-[#252b4a] text-white"
                            data-testid={`input-real-balance-${user.id}`}
                          />
                        ) : (
                          `$${parseFloat(user.realBalance || '0').toFixed(2)}`
                        )}
                      </TableCell>
                      <TableCell>{user.isAdmin ? <Badge>نعم</Badge> : <Badge variant="outline">لا</Badge>}</TableCell>
                      <TableCell>
                        {editingUserId === user.id ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleUpdateBalance(user.id)}
                              disabled={updateBalanceMutation.isPending}
                              data-testid={`button-save-${user.id}`}
                            >
                              حفظ
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingUserId(null)}
                              data-testid={`button-cancel-${user.id}`}
                            >
                              إلغاء
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingUserId(user.id);
                              setDemoBalance(user.demoBalance || '0');
                              setRealBalance(user.realBalance || '0');
                            }}
                            data-testid={`button-edit-${user.id}`}
                          >
                            تعديل الرصيد
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deposits" className="mt-4">
          <Card className="bg-[#0f1535] border-[#1a1f3a]">
            <CardHeader>
              <CardTitle className="text-white">إدارة الودائع</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1a1f3a]">
                    <TableHead className="text-gray-400">المعرف</TableHead>
                    <TableHead className="text-gray-400">معرف المستخدم</TableHead>
                    <TableHead className="text-gray-400">المبلغ</TableHead>
                    <TableHead className="text-gray-400">الطريقة</TableHead>
                    <TableHead className="text-gray-400">الحالة</TableHead>
                    <TableHead className="text-gray-400">التاريخ</TableHead>
                    <TableHead className="text-gray-400">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deposits.map((deposit) => (
                    <TableRow key={deposit.id} className="border-[#1a1f3a]" data-testid={`row-deposit-${deposit.id}`}>
                      <TableCell className="text-gray-300 font-mono text-xs">{deposit.id.slice(0, 8)}...</TableCell>
                      <TableCell className="text-gray-300 font-mono text-xs">{deposit.userId.slice(0, 8)}...</TableCell>
                      <TableCell className="text-white font-semibold">${parseFloat(deposit.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-gray-300">{deposit.method}</TableCell>
                      <TableCell>{getStatusBadge(deposit.status || 'pending')}</TableCell>
                      <TableCell className="text-gray-400 text-sm">
                        {deposit.createdAt ? new Date(deposit.createdAt).toLocaleDateString('ar-SA') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {deposit.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => updateDepositStatusMutation.mutate({ depositId: deposit.id, status: 'completed' })}
                                disabled={updateDepositStatusMutation.isPending}
                                data-testid={`button-approve-${deposit.id}`}
                              >
                                موافقة
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateDepositStatusMutation.mutate({ depositId: deposit.id, status: 'failed' })}
                                disabled={updateDepositStatusMutation.isPending}
                                data-testid={`button-reject-${deposit.id}`}
                              >
                                رفض
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-4">
          <Card className="bg-[#0f1535] border-[#1a1f3a]">
            <CardHeader>
              <CardTitle className="text-white">إدارة السحوبات</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1a1f3a]">
                    <TableHead className="text-gray-400">المعرف</TableHead>
                    <TableHead className="text-gray-400">معرف المستخدم</TableHead>
                    <TableHead className="text-gray-400">المبلغ</TableHead>
                    <TableHead className="text-gray-400">العنوان</TableHead>
                    <TableHead className="text-gray-400">الحالة</TableHead>
                    <TableHead className="text-gray-400">التاريخ</TableHead>
                    <TableHead className="text-gray-400">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal.id} className="border-[#1a1f3a]" data-testid={`row-withdrawal-${withdrawal.id}`}>
                      <TableCell className="text-gray-300 font-mono text-xs">{withdrawal.id.slice(0, 8)}...</TableCell>
                      <TableCell className="text-gray-300 font-mono text-xs">{withdrawal.userId.slice(0, 8)}...</TableCell>
                      <TableCell className="text-white font-semibold">${parseFloat(withdrawal.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-gray-300 font-mono text-xs" title={withdrawal.address}>
                        {withdrawal.address.slice(0, 8)}...{withdrawal.address.slice(-6)}
                      </TableCell>
                      <TableCell>{getStatusBadge(withdrawal.status || 'pending')}</TableCell>
                      <TableCell className="text-gray-400 text-sm">
                        {withdrawal.createdAt ? new Date(withdrawal.createdAt).toLocaleDateString('ar-SA') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {withdrawal.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => updateWithdrawalStatusMutation.mutate({ withdrawalId: withdrawal.id, status: 'completed' })}
                                disabled={updateWithdrawalStatusMutation.isPending}
                                data-testid={`button-approve-${withdrawal.id}`}
                              >
                                موافقة
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateWithdrawalStatusMutation.mutate({ withdrawalId: withdrawal.id, status: 'rejected', notes: 'تم رفض الطلب' })}
                                disabled={updateWithdrawalStatusMutation.isPending}
                                data-testid={`button-reject-${withdrawal.id}`}
                              >
                                رفض
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trades" className="mt-4">
          <Card className="bg-[#0f1535] border-[#1a1f3a]">
            <CardHeader>
              <CardTitle className="text-white">إدارة الصفقات</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1a1f3a]">
                    <TableHead className="text-gray-400">المعرف</TableHead>
                    <TableHead className="text-gray-400">المستخدم</TableHead>
                    <TableHead className="text-gray-400">الأصل</TableHead>
                    <TableHead className="text-gray-400">النوع</TableHead>
                    <TableHead className="text-gray-400">المبلغ</TableHead>
                    <TableHead className="text-gray-400">الحالة</TableHead>
                    <TableHead className="text-gray-400">العوائد</TableHead>
                    <TableHead className="text-gray-400">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((trade) => (
                    <TableRow key={trade.id} className="border-[#1a1f3a]" data-testid={`row-trade-${trade.id}`}>
                      <TableCell className="text-gray-300 font-mono text-xs">{trade.id.slice(0, 8)}...</TableCell>
                      <TableCell className="text-gray-300 font-mono text-xs">{trade.userId.slice(0, 8)}...</TableCell>
                      <TableCell className="text-white">{trade.assetId}</TableCell>
                      <TableCell>
                        <Badge variant={trade.type === 'CALL' ? 'default' : 'destructive'}>
                          {trade.type === 'CALL' ? 'صعود' : 'هبوط'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-white font-semibold">${parseFloat(trade.amount).toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(trade.status || 'open')}</TableCell>
                      <TableCell className="text-gray-300">
                        {trade.payout ? `$${parseFloat(trade.payout).toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm">
                        {trade.createdAt ? new Date(trade.createdAt).toLocaleDateString('ar-SA') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card className="bg-[#0f1535] border-[#1a1f3a]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                إعدادات النظام
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-[#1a1f3a] p-6 rounded-lg space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">التحكم في احتمالية الربح</h3>
                
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">
                    نسبة الربح (%)
                  </label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={winRate || settings?.winRate || ''}
                      onChange={(e) => setWinRate(e.target.value)}
                      placeholder={settings?.winRate || '20.00'}
                      className="w-40 bg-[#0f1535] border-[#252b4a] text-white"
                      data-testid="input-win-rate"
                    />
                    <span className="text-gray-400">%</span>
                    <Button
                      onClick={handleUpdateSettings}
                      disabled={updateSettingsMutation.isPending || (!winRate && !usdtTrc20Address && !usdtErc20Address && !usdtBep20Address)}
                      data-testid="button-save-settings"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {updateSettingsMutation.isPending ? 'جاري الحفظ...' : 'حفظ جميع التغييرات'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    النسبة الحالية: {settings?.winRate || '20.00'}%
                  </p>
                </div>

                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-300">
                    <strong>ملاحظة:</strong> هذه النسبة تتحكم في احتمالية ربح الصفقات. على سبيل المثال:
                  </p>
                  <ul className="text-xs text-blue-200 mt-2 space-y-1 mr-4">
                    <li>• نسبة 20% = المستخدمون يربحون 20 صفقة من كل 100 صفقة</li>
                    <li>• نسبة 50% = المستخدمون يربحون 50 صفقة من كل 100 صفقة</li>
                    <li>• نسبة 80% = المستخدمون يربحون 80 صفقة من كل 100 صفقة</li>
                  </ul>
                </div>
              </div>

              {settings && (
                <div className="bg-[#1a1f3a] p-6 rounded-lg space-y-4">
                  <h3 className="text-lg font-semibold text-white mb-4">عناوين المحافظ للإيداع</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">USDT TRC20</label>
                      <Input
                        type="text"
                        value={usdtTrc20Address}
                        onChange={(e) => setUsdtTrc20Address(e.target.value)}
                        placeholder={settings.usdtTrc20Address || 'أدخل عنوان المحفظة'}
                        className="bg-[#0f1535] border-[#252b4a] text-white font-mono text-sm"
                        data-testid="input-trc20-address"
                      />
                      {settings.usdtTrc20Address && !usdtTrc20Address && (
                        <p className="text-xs text-gray-500 mt-1">العنوان الحالي: {settings.usdtTrc20Address}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">USDT ERC20</label>
                      <Input
                        type="text"
                        value={usdtErc20Address}
                        onChange={(e) => setUsdtErc20Address(e.target.value)}
                        placeholder={settings.usdtErc20Address || 'أدخل عنوان المحفظة'}
                        className="bg-[#0f1535] border-[#252b4a] text-white font-mono text-sm"
                        data-testid="input-erc20-address"
                      />
                      {settings.usdtErc20Address && !usdtErc20Address && (
                        <p className="text-xs text-gray-500 mt-1">العنوان الحالي: {settings.usdtErc20Address}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">USDT BEP20</label>
                      <Input
                        type="text"
                        value={usdtBep20Address}
                        onChange={(e) => setUsdtBep20Address(e.target.value)}
                        placeholder={settings.usdtBep20Address || 'أدخل عنوان المحفظة'}
                        className="bg-[#0f1535] border-[#252b4a] text-white font-mono text-sm"
                        data-testid="input-bep20-address"
                      />
                      {settings.usdtBep20Address && !usdtBep20Address && (
                        <p className="text-xs text-gray-500 mt-1">العنوان الحالي: {settings.usdtBep20Address}</p>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 mt-4">
                    آخر تحديث: {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString('ar-SA') : '-'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
