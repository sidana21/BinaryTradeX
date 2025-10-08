# Binomo API Integration

تم تثبيت تكامل Binomo API بنجاح على التطبيق.

## المعلومات المستخدمة

البيانات محفوظة بشكل آمن في Replit Secrets:
- **BINOMO_AUTHTOKEN**: محفوظ في Secrets ✓
- **BINOMO_DEVICE_ID**: محفوظ في Secrets ✓
- **BINOMO_DEVICE_TYPE**: `web`
- **PORT**: `5001`

## كيفية تشغيل خدمة Binomo

### الطريقة 1: استخدام Python مباشرة

```bash
export BINOMO_AUTHTOKEN=2ba71577-82f7-4751-8902-4de7f0c94831
export BINOMO_DEVICE_ID=636d5616769d02c84c488e3353f28789
export BINOMO_DEVICE_TYPE=web
export BINOMO_SERVICE_PORT=5001

python binomo_service.py
```

### الطريقة 2: استخدام Bash Script

```bash
./start_binomo.sh
```

### الطريقة 3: استخدام Python Runner

```bash
python run_binomo.py
```

## API Endpoints المتاحة

### 1. فحص حالة الاتصال
```bash
GET /health
```

### 2. الحصول على الرصيد
```bash
GET /balance?type=demo
```

### 3. الحصول على الأصول المتاحة
```bash
GET /assets
```

### 4. الحصول على بيانات الشموع
```bash
GET /candles/:assetId?size=60&count=100
```

### 5. تنفيذ صفقة
```bash
POST /trade
Content-Type: application/json

{
  "asset_id": "EURUSD",
  "amount": 1,
  "direction": "call",
  "duration": 1
}
```

### 6. فحص نتيجة الصفقة
```bash
GET /trade/check/:tradeId
```

### 7. تبديل نوع الحساب
```bash
POST /account/switch
Content-Type: application/json

{
  "type": "PRACTICE"
}
```

### 8. الحصول على السعر الحالي
```bash
GET /price/current/:assetId
```

## الوصول من التطبيق

تم إنشاء proxy endpoints في التطبيق Node.js:

- `/api/binomo/health` - فحص حالة خدمة Binomo
- `/api/binomo/balance` - الحصول على الرصيد
- `/api/binomo/assets` - الحصول على الأصول
- `/api/binomo/candles/:assetId` - الحصول على الشموع
- `/api/binomo/trade` - تنفيذ صفقة
- `/api/binomo/trade/check/:tradeId` - فحص الصفقة
- `/api/binomo/account/switch` - تبديل الحساب
- `/api/binomo/price/:assetId` - السعر الحالي

## الواجهة الأمامية

تم إنشاء صفحة مخصصة لـ Binomo API:

```
http://localhost:5000/binomo
```

## الملفات المهمة

1. **binomo_service.py** - خدمة Binomo API الرئيسية
2. **server/routes.ts** - Proxy endpoints
3. **client/src/pages/binomo.tsx** - صفحة الواجهة الأمامية
4. **start_binomo.sh** - Script لتشغيل الخدمة
5. **run_binomo.py** - Python runner script

## ملاحظات

- الخدمة تعمل على المنفذ 5001 بشكل افتراضي
- التطبيق الرئيسي يعمل على المنفذ 5000
- يجب تشغيل خدمة Binomo في terminal منفصل
- استخدم مكتبة `binomoapi` للاتصال بـ Binomo
