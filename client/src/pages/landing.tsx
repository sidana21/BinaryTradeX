import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Shield, Smartphone, Award, DollarSign, BarChart3, Globe, Clock } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary" dir="rtl">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-right space-y-6">
              <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight" data-testid="text-hero-title">
                منصة التداول الأفضل<br />
                <span className="text-primary">للخيارات الثنائية</span>
              </h1>
              <p className="text-lg lg:text-xl text-muted-foreground" data-testid="text-hero-subtitle">
                تداول أكثر من 200+ أصل مع حد أدنى للإيداع 10 دولار فقط
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-end">
                <Link href="/signup" data-testid="link-signup">
                  <Button 
                    size="lg" 
                    className="text-lg px-8 py-6 w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                    data-testid="button-signup"
                  >
                    <TrendingUp className="ml-2 h-5 w-5" />
                    إنشاء حساب
                  </Button>
                </Link>
                <Link href="/login" data-testid="link-login">
                  <Button 
                    size="lg" 
                    variant="outline"
                    className="text-lg px-8 py-6 w-full sm:w-auto"
                    data-testid="button-login"
                  >
                    تسجيل الدخول
                  </Button>
                </Link>
                <Link href="/trading" data-testid="link-try-demo">
                  <Button 
                    size="lg" 
                    variant="secondary"
                    className="text-lg px-8 py-6 w-full sm:w-auto"
                    data-testid="button-try-demo"
                  >
                    جرب الحساب التجريبي
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-8">
                <div className="text-center" data-testid="stat-demo-balance">
                  <p className="text-2xl lg:text-3xl font-bold text-primary">10,000$</p>
                  <p className="text-sm text-muted-foreground">حساب تجريبي</p>
                </div>
                <div className="text-center" data-testid="stat-users">
                  <p className="text-2xl lg:text-3xl font-bold text-primary">100M+</p>
                  <p className="text-sm text-muted-foreground">مستخدم نشط</p>
                </div>
                <div className="text-center" data-testid="stat-assets">
                  <p className="text-2xl lg:text-3xl font-bold text-primary">200+</p>
                  <p className="text-sm text-muted-foreground">أصل للتداول</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl">
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="h-24 w-24 text-primary mx-auto mb-4" />
                    <p className="text-lg font-semibold text-foreground">واجهة التداول المتقدمة</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12" data-testid="text-features-title">
            لماذا تختار منصتنا؟
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card data-testid="card-feature-deposit">
              <CardContent className="p-6 text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full">
                  <DollarSign className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">حد أدنى منخفض</h3>
                <p className="text-muted-foreground">ابدأ بإيداع 10 دولار فقط</p>
              </CardContent>
            </Card>

            <Card data-testid="card-feature-demo">
              <CardContent className="p-6 text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">حساب تجريبي مجاني</h3>
                <p className="text-muted-foreground">10,000$ للتدريب بدون مخاطر</p>
              </CardContent>
            </Card>

            <Card data-testid="card-feature-mobile">
              <CardContent className="p-6 text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full">
                  <Smartphone className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">تداول من أي مكان</h3>
                <p className="text-muted-foreground">منصة متوافقة مع جميع الأجهزة</p>
              </CardContent>
            </Card>

            <Card data-testid="card-feature-support">
              <CardContent className="p-6 text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">دعم 24/7</h3>
                <p className="text-muted-foreground">خدمة عملاء متاحة دائماً</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Asset Categories Section */}
      <section className="py-16 bg-secondary/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12" data-testid="text-assets-title">
            تداول في أسواق متنوعة
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-lg transition-shadow" data-testid="card-asset-forex">
              <CardContent className="p-6">
                <Globe className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">فوركس</h3>
                <p className="text-muted-foreground mb-4">أزواج العملات الرئيسية والثانوية</p>
                <p className="text-sm text-primary font-medium">EUR/USD, GBP/USD, USD/JPY...</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow" data-testid="card-asset-crypto">
              <CardContent className="p-6">
                <BarChart3 className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">العملات الرقمية</h3>
                <p className="text-muted-foreground mb-4">تداول العملات المشفرة الشائعة</p>
                <p className="text-sm text-primary font-medium">BTC, ETH, XRP...</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow" data-testid="card-asset-commodities">
              <CardContent className="p-6">
                <Award className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">السلع</h3>
                <p className="text-muted-foreground mb-4">الذهب والنفط والمعادن الثمينة</p>
                <p className="text-sm text-primary font-medium">الذهب, النفط, الفضة...</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow" data-testid="card-asset-stocks">
              <CardContent className="p-6">
                <TrendingUp className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">الأسهم</h3>
                <p className="text-muted-foreground mb-4">أسهم الشركات العالمية الكبرى</p>
                <p className="text-sm text-primary font-medium">Apple, Tesla, Amazon...</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Platform Benefits */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12" data-testid="text-benefits-title">
              مميزات المنصة
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex gap-4" data-testid="benefit-charts">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">رسوم بيانية متقدمة</h3>
                  <p className="text-muted-foreground">مؤشرات فنية وأدوات تحليل احترافية</p>
                </div>
              </div>

              <div className="flex gap-4" data-testid="benefit-execution">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">تنفيذ سريع</h3>
                  <p className="text-muted-foreground">صفقات فورية بدون تأخير</p>
                </div>
              </div>

              <div className="flex gap-4" data-testid="benefit-security">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">أمان عالي</h3>
                  <p className="text-muted-foreground">حماية متقدمة لبياناتك وأموالك</p>
                </div>
              </div>

              <div className="flex gap-4" data-testid="benefit-interface">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Smartphone className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">واجهة بسيطة</h3>
                  <p className="text-muted-foreground">سهلة الاستخدام للمبتدئين والمحترفين</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6" data-testid="text-cta-title">
            هل أنت مستعد للبدء؟
          </h2>
          <p className="text-lg mb-8 opacity-90" data-testid="text-cta-subtitle">
            انضم الآن إلى ملايين المتداولين حول العالم
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" data-testid="link-cta-signup">
              <Button 
                size="lg" 
                variant="secondary"
                className="text-lg px-8 py-6 w-full sm:w-auto"
                data-testid="button-cta-signup"
              >
                إنشاء حساب
              </Button>
            </Link>
            <Link href="/trading" data-testid="link-cta-demo">
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 py-6 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary w-full sm:w-auto"
                data-testid="button-cta-demo"
              >
                جرب الحساب التجريبي
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-background border-t border-border">
        <div className="container mx-auto px-4">
          <div className="text-center text-muted-foreground text-sm">
            <p className="mb-2" data-testid="text-footer-warning">
              ⚠️ تحذير من المخاطر: رأس المال الخاص بك في خطر. تداول الخيارات الثنائية يحمل مخاطر عالية.
            </p>
            <p data-testid="text-footer-copyright">
              © 2025 منصة التداول. جميع الحقوق محفوظة.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
