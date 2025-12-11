# إعداد تطبيق iOS لمشروع "بين اديك"

## الخطوات المطلوبة لإعداد تطبيق iOS

### 1. متطلبات النظام
- جهاز Mac مع نظام macOS 11 (Big Sur) أو أحدث
- Xcode 13 أو أحدث
- Node.js 14 أو أحدث
- CocoaPods (يمكن تثبيته عبر `sudo gem install cocoapods`)

### 2. تثبيت الحزم المطلوبة
```bash
npm install @capacitor/ios @capacitor/cli
```

### 3. بناء تطبيق الويب
```bash
npm run build
```

### 4. إضافة منصة iOS
```bash
npx cap add ios
```

### 5. مزامنة الملفات
```bash
npx cap sync
```

### 6. فتح المشروع في Xcode
```bash
npx cap open ios
```

## إعدادات Xcode

### 1. إعداد فريق التطوير
- افتح Xcode
- حدد مشروع App في المتصفح
- انتقل إلى علامة التبويب "Signing & Capabilities"
- حدد فريق التطوير الخاص بك
- إذا لم يكن لديك فريق، قم بتسجيل الدخول باستخدام Apple ID الخاص بك

### 2. تعديل معلومات التطبيق
- قم بتعديل Bundle Identifier إذا لزم الأمر
- تأكد من أن الإصدار والبناء صحيحان
- أضف أي قدرات إضافية مطلوبة (مثل Push Notifications)

### 3. تخصيص الأيقونات وشاشة البداية
- استبدل الأيقونات الافتراضية في Assets.xcassets
- قم بتخصيص LaunchScreen.storyboard

## بناء ونشر التطبيق

### 1. بناء للاختبار
- اختر جهاز محاكاة أو جهاز حقيقي متصل
- اضغط على زر التشغيل (▶️) لبناء وتشغيل التطبيق

### 2. بناء للتوزيع
- اختر Product > Archive من القائمة
- اتبع الخطوات لتوقيع وتوزيع التطبيق
- يمكنك التوزيع عبر App Store أو Ad Hoc أو Enterprise

## حل المشكلات الشائعة

### 1. مشاكل CocoaPods
إذا واجهت مشاكل مع CocoaPods، جرب:
```bash
cd ios/App
pod install --repo-update
```

### 2. مشاكل التوقيع
- تأكد من أن لديك شهادة توقيع صالحة
- تحقق من ملف التوقيع (Provisioning Profile)
- قد تحتاج إلى تجديد الشهادات من موقع Apple Developer

### 3. مشاكل البناء
- قم بتنظيف المشروع: Product > Clean Build Folder
- تأكد من تحديث Xcode إلى أحدث إصدار
- تحقق من سجلات البناء للحصول على تفاصيل الأخطاء

## موارد إضافية
- [توثيق Capacitor الرسمي](https://capacitorjs.com/docs/ios)
- [دليل Apple لنشر التطبيقات](https://developer.apple.com/app-store/submissions/)
- [استكشاف أخطاء Xcode وإصلاحها](https://developer.apple.com/documentation/xcode/diagnosing-issues-using-crash-reports-and-device-logs)