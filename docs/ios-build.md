# توثيق عملية تحويل تطبيق الويب إلى تطبيق iOS

## المقدمة

هذا المستند يشرح كيفية تحويل تطبيق الويب "بين اديك" إلى تطبيق iOS باستخدام Capacitor. يتضمن جميع الخطوات والإعدادات المطلوبة.

## المتطلبات الأساسية

1. تثبيت الحزم المطلوبة:
```bash
npm install @capacitor/core @capacitor/ios @capacitor/app @capacitor/haptics @capacitor/keyboard @capacitor/status-bar
```

2. إعداد بيئة iOS:
   - تثبيت Xcode (أحدث إصدار)
   - تثبيت أدوات سطر الأوامر لـ Xcode: `xcode-select --install`
   - تثبيت CocoaPods: `sudo gem install cocoapods`
   - حساب Apple Developer (مطلوب للنشر)

## خطوات التحويل

### 1. تهيئة المشروع

تم إضافة السكربتات التالية في `package.json`:

```json
{
  "scripts": {
    "cap:init": "cap init بين-اديك com.benedek.app --web-dir dist",
    "cap:add:ios": "cap add ios",
    "cap:sync": "cap sync",
    "cap:open:ios": "cap open ios",
    "ios": "npm run build && cap sync ios && cap open ios",
    "ios:build": "npm run build && cap sync ios && cd ios && xcodebuild -workspace App/App.xcworkspace -scheme App -configuration Release && cd .."
  }
}
```

### 2. إعداد Capacitor

تم تحديث ملف `capacitor.config.ts` ليشمل إعدادات iOS:

```typescript
const config = {
  appId: "com.benedek.app",
  appName: "بين اديك",
  webDir: "dist",
  server: {
    androidScheme: "https",
    hostname: "ben-edek.shop",
    cleartext: true
  },
  ios: {
    contentInset: "always",
    scheme: "بين اديك",
    backgroundColor: "#FFFFFF"
  },
  android: {
    backgroundColor: "#FFFFFF"
  }
};
```

### 3. إنشاء مشروع iOS

1. بناء تطبيق الويب:
```bash
npm run build
```

2. إضافة منصة iOS:
```bash
npm run cap:add:ios
```

3. مزامنة الملفات:
```bash
npm run cap:sync
```

### 4. تخصيص المظهر

1. تعديل الألوان والأيقونات:
   - تم تخصيص ملفات الأيقونات في مجلد `ios/App/App/Assets.xcassets`
   - تم تعديل ملف `Info.plist` لتخصيص شاشة البداية

2. تخصيص شاشة البداية:
   - تم إنشاء ملف `LaunchScreen.storyboard` مخصص
   - تم تعديل الألوان لتتناسب مع هوية التطبيق

### 5. إعداد التوقيع الرقمي

1. فتح المشروع في Xcode:
```bash
npm run cap:open:ios
```

2. تكوين التوقيع الرقمي:
   - تحديد فريق التطوير
   - إنشاء ملف توقيع (Provisioning Profile)
   - تكوين معرفات التطبيق (App Identifiers)

### 6. بناء التطبيق

1. بناء نسخة للاختبار:
```bash
npm run ios:build
```

2. بناء نسخة للنشر:
   - استخدم Xcode لإنشاء نسخة Archive
   - استخدم App Store Connect لنشر التطبيق

### 7. الأذونات المطلوبة

تم تكوين الأذونات في `Info.plist`:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>نحتاج إلى موقعك لتوفير خدمات التوصيل بشكل صحيح</string>
```

### 8. الإضافات المثبتة

- @capacitor/app: لإدارة دورة حياة التطبيق
- @capacitor/haptics: للاهتزازات واللمس
- @capacitor/keyboard: للتحكم في لوحة المفاتيح
- @capacitor/status-bar: للتحكم في شريط الحالة

## الميزات المضافة

1. دعم اللغة العربية والتوجيه RTL
2. شاشة بداية مخصصة
3. أيقونات وألوان مخصصة
4. دعم العمل دون اتصال
5. تكامل مع خدمات الويب
6. تخزين محلي للبيانات

## الاختبار والنشر

1. اختبار التطبيق على أجهزة مختلفة
2. التأكد من عمل جميع الوظائف
3. مراجعة الأداء والاستجابة
4. تحضير التطبيق للنشر على App Store

## الملاحظات الفنية

1. تم استخدام Capacitor 5.7.0
2. تم تكوين التطبيق للعمل مع HTTPS
3. تم إضافة دعم للوضع التجريبي عبر cleartext
4. تم تحسين أداء التطبيق للأجهزة ذات الشاشات المختلفة
5. تم تكوين التطبيق للتعامل مع اللغة العربية بشكل صحيح