# توثيق عملية تحويل تطبيق الويب إلى تطبيق Android

## المقدمة

هذا المستند يشرح كيفية تحويل تطبيق الويب "بين اديك" إلى تطبيق Android باستخدام Capacitor. يتضمن جميع الخطوات والإعدادات المطلوبة.

## المتطلبات الأساسية

1. تثبيت الحزم المطلوبة:
```bash
npm install @capacitor/core @capacitor/android @capacitor/app @capacitor/haptics @capacitor/keyboard @capacitor/status-bar
```

2. إعداد بيئة Android:
   - تثبيت Android Studio
   - تثبيت Android SDK
   - تثبيت Java Development Kit (JDK)

## خطوات التحويل

### 1. تهيئة المشروع

تم إضافة السكربتات التالية في `package.json`:

```json
{
  "scripts": {
    "cap:init": "cap init بين-اديك com.benedek.app --web-dir dist",
    "cap:add": "cap add android",
    "cap:sync": "cap sync",
    "cap:open": "cap open android",
    "android": "npm run build && cap sync android && cap open android",
    "android:build": "npm run build && cap sync android && cd android && ./gradlew assembleRelease && cd ..",
    "android:build:debug": "npm run build && cap sync android && cd android && ./gradlew assembleDebug && cd .."
  }
}
```

### 2. إعداد Capacitor

تم إنشاء ملف `capacitor.config.ts`:

```typescript
const config = {
  appId: "com.benedek.app",
  appName: "بين اديك",
  webDir: "dist",
  server: {
    androidScheme: "https",
    hostname: "ben-edek.shop",
    cleartext: true
  }
};
```

### 3. إنشاء مشروع Android

1. بناء تطبيق الويب:
```bash
npm run build
```

2. إضافة منصة Android:
```bash
npm run cap:add
```

3. مزامنة الملفات:
```bash
npm run cap:sync
```

### 4. إعداد التوقيع الرقمي

1. إنشاء ملف keystore:
```bash
keytool -genkey -v -keystore android/benedek.keystore -alias benedek -keyalg RSA -keysize 2048 -validity 10000 -storepass benedek2025 -keypass benedek2025
```

2. تكوين التوقيع في `android/app/build.gradle`:
```gradle
android {
  signingConfigs {
    release {
      storeFile file("../benedek.keystore")
      storePassword "benedek2025"
      keyAlias "benedek"
      keyPassword "benedek2025"
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.release
    }
  }
}
```

### 5. تخصيص المظهر

1. تعديل الألوان في `android/app/src/main/res/values/colors.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#F2C230</color>
    <color name="colorPrimaryDark">#024959</color>
    <color name="colorAccent">#024959</color>
</resources>
```

2. تخصيص شاشة البداية في `android/app/src/main/res/values/styles.xml`:
```xml
<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">@color/ic_launcher_background</item>
    <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>
    <item name="postSplashScreenTheme">@style/AppTheme</item>
</style>
```

### 6. بناء التطبيق

1. بناء نسخة release:
```bash
npm run android:build
```

2. بناء نسخة debug:
```bash
npm run android:build:debug
```

ملف APK النهائي يتم إنشاؤه في:
```
android/app/build/outputs/apk/release/app-release.apk
```

### 7. الأذونات المطلوبة

تم تكوين الأذونات في `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
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
4. تحضير التطبيق للنشر على Google Play

## الملاحظات الفنية

1. تم استخدام Capacitor 5.7.0
2. الإصدار المستهدف لـ Android هو API 33
3. الحد الأدنى المدعوم هو API 22
4. تم تكوين التطبيق للعمل مع HTTPS
5. تم إضافة دعم للوضع التجريبي عبر cleartext