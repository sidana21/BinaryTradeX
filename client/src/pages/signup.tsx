import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/ui/logo';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

export default function SignUpPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.username || !formData.email || !formData.password) {
      toast({
        title: 'خطأ',
        description: 'يرجى ملء جميع الحقول',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'خطأ',
        description: 'كلمات المرور غير متطابقة',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: 'خطأ',
        description: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'فشل التسجيل');
      }
      
      toast({
        title: 'تم التسجيل بنجاح! 🎉',
        description: 'مرحباً بك في Bok Option - حصلت على +200$ مجاناً!',
      });

      // Redirect to trading page
      setTimeout(() => {
        setLocation('/trading');
      }, 1500);
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'حدث خطأ أثناء التسجيل، يرجى المحاولة مرة أخرى',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#0f1535] to-[#0a0e27] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="lg" showText={true} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">إنشاء حساب جديد</h1>
          <p className="text-gray-400">ابدأ التداول الآن مع +200$ مجاناً</p>
        </div>

        {/* Sign Up Form */}
        <form onSubmit={handleSubmit} className="bg-[#0f1535] rounded-2xl p-6 border border-[#1a1f3a] shadow-2xl">
          {/* Username */}
          <div className="mb-4">
            <Label htmlFor="username" className="text-gray-300 mb-2 block">
              اسم المستخدم
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="bg-[#1a1f3a] border-[#252b4a] text-white pl-12 h-12 rounded-xl focus:border-blue-500"
                placeholder="اختر اسم مستخدم"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Email */}
          <div className="mb-4">
            <Label htmlFor="email" className="text-gray-300 mb-2 block">
              البريد الإلكتروني
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-[#1a1f3a] border-[#252b4a] text-white pl-12 h-12 rounded-xl focus:border-blue-500"
                placeholder="example@email.com"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-4">
            <Label htmlFor="password" className="text-gray-300 mb-2 block">
              كلمة المرور
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-[#1a1f3a] border-[#252b4a] text-white pl-12 pr-12 h-12 rounded-xl focus:border-blue-500"
                placeholder="أدخل كلمة المرور"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="mb-6">
            <Label htmlFor="confirmPassword" className="text-gray-300 mb-2 block">
              تأكيد كلمة المرور
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="bg-[#1a1f3a] border-[#252b4a] text-white pl-12 h-12 rounded-xl focus:border-blue-500"
                placeholder="أعد إدخال كلمة المرور"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-500/20"
          >
            {isLoading ? 'جاري التسجيل...' : 'إنشاء الحساب'}
          </Button>

          {/* Login Link */}
          <p className="text-center text-gray-400 mt-4 text-sm">
            لديك حساب بالفعل؟{' '}
            <button
              type="button"
              onClick={() => setLocation('/trading')}
              className="text-blue-400 hover:text-blue-300 font-semibold"
            >
              تسجيل الدخول
            </button>
          </p>
        </form>

        {/* Terms */}
        <p className="text-center text-gray-500 text-xs mt-6">
          بالتسجيل، أنت توافق على{' '}
          <a href="#" className="text-blue-400 hover:underline">شروط الخدمة</a>
          {' '}و{' '}
          <a href="#" className="text-blue-400 hover:underline">سياسة الخصوصية</a>
        </p>
      </div>
    </div>
  );
}
