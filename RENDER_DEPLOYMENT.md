# دليل نشر التطبيق على Render

## المشكلة التي كانت تحدث
كان الخطأ: `Error: Cannot find module '/opt/render/project/src/dist/index.js'`

السبب: Render كان يبحث في المسار الخاطئ `/opt/render/project/src/dist/index.js` بدلاً من `/opt/render/project/dist/index.js`

## الحل ✅

تم إصلاح المشكلة في ملف `render.yaml`. الآن عليك فقط:

### الخطوة 1: تحديث الكود على Git
```bash
git add .
git commit -m "Fix Render deployment configuration"
git push
```

### الخطوة 2: إعدادات Render

في لوحة تحكم Render، تأكد من الإعدادات التالية:

#### أ) إعدادات Build & Deploy:
- **Root Directory**: اتركه فارغاً أو ضع `.` (نقطة)
  - **مهم جداً**: إذا كان مضبوط على `src`، قم بحذفه أو تغييره إلى `.`
  
- **Build Command**: 
  ```
  npm install && npm run build
  ```

- **Start Command**: 
  ```
  node ./dist/index.js
  ```

#### ب) متغيرات البيئة (Environment Variables):
أضف المتغيرات التالية:

1. `NODE_ENV` = `production`
2. `PORT` = `10000` (Render يستخدم المنفذ 10000 افتراضياً)
3. أي متغيرات أخرى يحتاجها تطبيقك (مثل `DATABASE_URL` إذا كنت تستخدم قاعدة بيانات)

### الخطوة 3: إعادة النشر

بعد تطبيق هذه الإعدادات، انقر على **"Manual Deploy"** أو انتظر النشر التلقائي.

## ملاحظات مهمة

1. **ملف render.yaml موجود الآن**: يحتوي على جميع الإعدادات الصحيحة
2. **rootDir مضبوط على `.`**: هذا يضمن أن Render يبحث في المسار الصحيح
3. **الملف يُبنى في `dist/index.js`**: وهذا هو المسار الذي سيجده Render

## إذا استمرت المشكلة

1. تحقق من سجلات البناء (Build Logs) في Render للتأكد من أن الأمر `npm run build` ينجح
2. تأكد من أن مجلد `dist` يتم إنشاؤه بنجاح
3. تأكد من حذف أي إعداد `Root Directory` قديم من Render

---

## معلومات إضافية

**البنية الصحيحة للملفات بعد البناء:**
```
/opt/render/project/
├── dist/
│   ├── index.js        ← هنا الملف المطلوب
│   └── public/
├── node_modules/
├── package.json
└── render.yaml
```

**وليس:**
```
/opt/render/project/src/dist/index.js  ← مسار خاطئ
```
