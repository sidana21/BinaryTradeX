# 🔧 إصلاح خطأ "email column does not exist"

## المشكلة
قاعدة بيانات Render لا تحتوي على عمود `email` في جدول المستخدمين.

## الحل (خطوة بخطوة)

### الطريقة 1: استخدام NeonDB Console ⭐ (الأسهل)

1. **افتح لوحة تحكم NeonDB**
   - اذهب إلى https://console.neon.tech
   - سجل دخول بحسابك

2. **اختر قاعدة البيانات**
   - اختر المشروع المتصل بـ Render
   - اضغط على "SQL Editor" من القائمة الجانبية

3. **نفّذ هذا الكود SQL**:

```sql
-- إضافة عمود email
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- تعيين إيميلات افتراضية للمستخدمين الموجودين
UPDATE users 
SET email = username || '@trading.local'
WHERE email IS NULL OR email = '';

-- جعل العمود مطلوب وفريد
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- إضافة قيد الفريد
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
    END IF;
END $$;
```

4. **اضغط "Run" أو "Execute"**

5. **تحقق من النجاح**:
```sql
SELECT id, username, email FROM users LIMIT 5;
```

6. **أعد نشر التطبيق على Render**
   - اذهب إلى Render Dashboard
   - اختر المشروع
   - اضغط "Manual Deploy" → "Deploy latest commit"

---

### الطريقة 2: استخدام Render PostgreSQL Client (بديلة)

إذا لم تنجح الطريقة الأولى:

1. افتح Render Dashboard
2. اذهب إلى قاعدة البيانات PostgreSQL
3. اضغط "Connect" → "External Connection"
4. انسخ أمر `psql` 
5. افتح Terminal ونفّذ الأمر
6. نفّذ نفس SQL من الطريقة 1

---

## ✅ بعد الإصلاح

سيعمل التطبيق بشكل طبيعي:
- ✅ تسجيل الدخول
- ✅ إنشاء الحسابات
- ✅ الملف الشخصي
- ✅ جميع الميزات

---

## 📝 ملاحظات

- هذا الحل آمن 100% - لن يؤثر على البيانات الموجودة
- المستخدمون القدامى سيحصلون على إيميلات افتراضية (username@trading.local)
- المستخدمون الجدد سيدخلون إيميلاتهم الحقيقية عند التسجيل
