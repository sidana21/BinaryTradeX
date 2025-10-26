import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, User, Mail, Phone, Globe, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    country: '',
  });

  // Fetch current user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const user = await response.json();
          setCurrentUser(user);
          // Pre-fill email from user data
          setFormData(prev => ({
            ...prev,
            email: user.email || '',
          }));
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUser();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: 'تم التحديث',
      description: 'تم تحديث معلومات الملف الشخصي بنجاح',
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: 'تم تسجيل الخروج',
          description: 'تم تسجيل خروجك بنجاح',
        });
        setLocation('/');
      } else {
        throw new Error('فشل تسجيل الخروج');
      }
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تسجيل الخروج',
        variant: 'destructive',
      });
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
          <h1 className="text-xl font-bold">الملف الشخصي</h1>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 max-w-2xl mx-auto">
        {/* Profile Avatar */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center mb-3">
            <i className="fas fa-user text-white text-3xl"></i>
          </div>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-6 w-32 bg-gray-700 rounded mb-2"></div>
              <div className="h-4 w-24 bg-gray-700 rounded mx-auto"></div>
            </div>
          ) : currentUser ? (
            <>
              <h2 className="text-xl font-bold mb-1">{currentUser.username}</h2>
              <p className="text-sm text-gray-400">{currentUser.email}</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-1">ضيف</h2>
              <p className="text-sm text-gray-400">غير مسجل الدخول</p>
            </>
          )}
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              <User className="inline-block w-4 h-4 mr-2" />
              الاسم الكامل
            </label>
            <Input
              type="text"
              value={formData.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              placeholder="أدخل اسمك الكامل"
              className="bg-[#0f1535] border-[#1a1f3a] text-white"
              data-testid="input-fullname"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              <Mail className="inline-block w-4 h-4 mr-2" />
              البريد الإلكتروني
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="أدخل بريدك الإلكتروني"
              className="bg-[#0f1535] border-[#1a1f3a] text-white"
              data-testid="input-email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              <Phone className="inline-block w-4 h-4 mr-2" />
              رقم الهاتف
            </label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="أدخل رقم هاتفك"
              className="bg-[#0f1535] border-[#1a1f3a] text-white"
              data-testid="input-phone"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              <Globe className="inline-block w-4 h-4 mr-2" />
              البلد
            </label>
            <Input
              type="text"
              value={formData.country}
              onChange={(e) => handleChange('country', e.target.value)}
              placeholder="أدخل بلدك"
              className="bg-[#0f1535] border-[#1a1f3a] text-white"
              data-testid="input-country"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-6 text-lg"
            data-testid="button-save-profile"
          >
            <i className="fas fa-save mr-2"></i>
            حفظ التغييرات
          </Button>
        </form>

        {/* Account Settings */}
        <div className="mt-8 space-y-3">
          <h3 className="text-lg font-semibold mb-4">إعدادات الحساب</h3>
          
          <button 
            className="w-full bg-[#0f1535] border border-[#1a1f3a] rounded-lg p-4 text-left hover:border-emerald-500/30 transition-colors"
            data-testid="button-change-password"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="font-medium">تغيير كلمة المرور</div>
                  <div className="text-sm text-gray-400">قم بتحديث كلمة المرور الخاصة بك</div>
                </div>
              </div>
              <i className="fas fa-chevron-left text-gray-400"></i>
            </div>
          </button>

          <button 
            className="w-full bg-[#0f1535] border border-[#1a1f3a] rounded-lg p-4 text-left hover:border-blue-500/30 transition-colors"
            data-testid="button-verification"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <i className="fas fa-shield-alt text-blue-400 text-xl"></i>
                <div>
                  <div className="font-medium">التحقق من الهوية</div>
                  <div className="text-sm text-gray-400">تحقق من حسابك لرفع حدود السحب</div>
                </div>
              </div>
              <i className="fas fa-chevron-left text-gray-400"></i>
            </div>
          </button>

          <button 
            onClick={handleLogout}
            className="w-full bg-[#0f1535] border border-red-500/20 rounded-lg p-4 text-left hover:border-red-500/50 transition-colors"
            data-testid="button-logout"
          >
            <div className="flex items-center gap-3">
              <i className="fas fa-sign-out-alt text-red-400 text-xl"></i>
              <div>
                <div className="font-medium text-red-400">تسجيل الخروج</div>
                <div className="text-sm text-gray-400">الخروج من حسابك</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
