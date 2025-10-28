# دليل نشر التطبيق على Render

## المشاكل الشائعة والحلول

### 1. إعدادات Render الأساسية
في لوحة تحكم Render:
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment**: Node
- **Port**: سيتم اختياره تلقائياً من `process.env.PORT`

### 2. متغيرات البيئة المطلوبة
أضف هذه المتغيرات في Render Dashboard → Environment:
```
NODE_ENV=production
SESSION_SECRET=your-secret-key-change-this
```

### 3. مشكلة WebSocket
التطبيق مُعَد بشكل صحيح للعمل على Render:
- ✅ WebSocket مرتبط بنفس HTTP server
- ✅ البروتوكول يتم اكتشافه تلقائياً (ws/wss)
- ✅ المنفذ يستخدم process.env.PORT

### 4. التأكد من عمل WebSocket على Render

افتح Console في المتصفح وابحث عن:
- إذا رأيت خطأ `WebSocket connection failed`، تحقق من:
  1. أن التطبيق يستخدم `wss://` وليس `ws://`
  2. أن الخادم يستمع على المنفذ الصحيح

### 5. نصائح مهمة

#### A. الاتصال بقاعدة البيانات
إذا كنت تستخدم قاعدة بيانات:
- استخدم متغير البيئة `DATABASE_URL` على Render
- تأكد من أن قاعدة البيانات في نفس المنطقة الجغرافية

#### B. معالج الإيقاف السلس (Graceful Shutdown)
الكود الحالي لا يتضمن معالج SIGTERM. أضف هذا في نهاية `server/index.ts`:

```typescript
// Graceful shutdown for Render deployments
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully...');
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

#### C. الاحتفاظ بالاتصال (Keep-Alive)
على الخطة المجانية من Render، الخدمة تتوقف بعد 15 دقيقة من عدم النشاط.
لمنع ذلك:
- استخدم خدمة ping مثل UptimeRobot
- أو ترقية للخطة المدفوعة

### 6. اختبار WebSocket بعد النشر

استخدم أدوات المطور في المتصفح:
```javascript
// افتح Console في المتصفح وجرب:
const ws = new WebSocket('wss://your-app.onrender.com/ws');
ws.onopen = () => console.log('✅ Connected');
ws.onmessage = (e) => console.log('📨 Received:', e.data);
ws.onerror = (e) => console.error('❌ Error:', e);
```

### 7. الأخطاء الشائعة وحلولها

| المشكلة | السبب | الحل |
|---------|-------|------|
| الشموع لا تظهر | WebSocket غير متصل | تحقق من Console للأخطاء |
| `400 Bad Request` | خطأ في handshake | تأكد من استخدام wss:// |
| `Connection timeout` | المنفذ غير صحيح | استخدم process.env.PORT |
| التطبيق يتوقف | الخطة المجانية | استخدم ping service |

### 8. فحص السجلات (Logs) على Render

في Render Dashboard → Logs، ابحث عن:
```
🚀 Initializing OTC markets...
serving on port [رقم المنفذ]
```

إذا رأيت هذه الرسائل، الخادم يعمل بشكل صحيح.

### 9. الفرق بين Replit و Render

| الميزة | Replit | Render |
|--------|--------|--------|
| WebSocket | يعمل مباشرة | يحتاج wss:// |
| Port | 5000 ثابت | متغير (10000 عادة) |
| Always-On | نعم (مع Replit) | لا (مجاناً) |
| Database | مدمجة | منفصلة |

## خلاصة
التطبيق مُعَد بشكل صحيح، لكن تأكد من:
1. استخدام `wss://` على Render (يتم تلقائياً)
2. المنفذ الصحيح من `process.env.PORT` (موجود)
3. إضافة معالج SIGTERM (موصى به)
4. استخدام ping service للخطة المجانية
