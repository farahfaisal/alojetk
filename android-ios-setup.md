# إعداد تطبيقات الجوال لمشروع "بين اديك"

هذا الدليل يشرح كيفية إعداد وبناء تطبيق "بين اديك" لمنصتي Android و iOS باستخدام Capacitor.

## متطلبات مشتركة

- Node.js 14 أو أحدث
- npm 6 أو أحدث
- تطبيق ويب يعمل بشكل صحيح

## إعداد المشروع

1. تثبيت حزم Capacitor:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios @capacitor/app @capacitor/haptics @capacitor/keyboard @capacitor/status-bar
```

2. تهيئة مشروع Capacitor:
```bash
npx cap init بين-اديك com.benedek.app --web-dir dist
```

3. بناء تطبيق الويب:
```bash
npm run build
```

4. إضافة منصات الجوال:
```bash
npx cap add android
npx cap add ios
```

5. مزامنة الملفات:
```bash
npx cap sync
```

## إعداد Android

### المتطلبات
- Android Studio
- JDK 11 أو أحدث
- Android SDK

### خطوات الإعداد
1. فتح المشروع في Android Studio:
```bash
npx cap open android
```

2. تعديل ملف `android/app/build.gradle` لتخصيص إعدادات التطبيق:
   - تعديل `applicationId` إذا لزم الأمر
   - تعديل `versionCode` و `versionName`
   - إعداد `signingConfigs` للإصدار النهائي

3. تخصيص الأيقونات وشاشة البداية:
   - استبدل الملفات في `android/app/src/main/res/mipmap-*`
   - تعديل `android/app/src/main/res/values/styles.xml` لتخصيص شاشة البداية

4. بناء التطبيق:
```bash
cd android
./gradlew assembleDebug    # للإصدار التجريبي
./gradlew assembleRelease  # للإصدار النهائي
```

## إعداد iOS

### المتطلبات
- جهاز Mac
- Xcode 13 أو أحدث
- CocoaPods

### خطوات الإعداد
1. تثبيت CocoaPods إذا لم يكن مثبتاً:
```bash
sudo gem install cocoapods
```

2. فتح المشروع في Xcode:
```bash
npx cap open ios
```

3. تعديل إعدادات المشروع في Xcode:
   - تعيين فريق التطوير
   - تعديل Bundle Identifier إذا لزم الأمر
   - تعديل رقم الإصدار ورقم البناء

4. تخصيص الأيقونات وشاشة البداية:
   - استبدل الأيقونات في Assets.xcassets
   - تعديل LaunchScreen.storyboard

5. بناء التطبيق:
   - اختر جهاز محاكاة أو جهاز حقيقي
   - اضغط على زر التشغيل (▶️) لبناء وتشغيل التطبيق
   - للإصدار النهائي: Product > Archive

## تخصيص التطبيق

### ملف التكوين
يمكن تعديل ملف `capacitor.config.ts` لتخصيص سلوك التطبيق:

```typescript
const config: CapacitorConfig = {
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

### الأذونات

#### Android
تعديل `android/app/src/main/AndroidManifest.xml` لإضافة الأذونات المطلوبة:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

#### iOS
تعديل `ios/App/App/Info.plist` لإضافة أوصاف الأذونات:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>نحتاج إلى موقعك لتوفير خدمات التوصيل بشكل صحيح</string>
```

## النشر

### Android
1. إنشاء ملف keystore للتوقيع:
```bash
keytool -genkey -v -keystore android/benedek.keystore -alias benedek -keyalg RSA -keysize 2048 -validity 10000
```

2. تكوين التوقيع في `android/app/build.gradle`

3. بناء نسخة موقعة:
```bash
cd android
./gradlew assembleRelease
```

4. نشر التطبيق على Google Play Store

### iOS
1. إنشاء Archive في Xcode: Product > Archive

2. استخدام Xcode Organizer لتوقيع وتوزيع التطبيق

3. نشر التطبيق على App Store

## اختبار التطبيق

### Android
- اختبار على أجهزة محاكاة مختلفة
- اختبار على أجهزة حقيقية بإصدارات مختلفة من Android

### iOS
- اختبار على محاكي iOS بأحجام شاشة مختلفة
- اختبار على أجهزة iPhone و iPad حقيقية

## حل المشكلات الشائعة

### Android
- مشاكل التوقيع: تأكد من إعداد ملف keystore بشكل صحيح
- مشاكل الأذونات: تحقق من AndroidManifest.xml
- مشاكل البناء: تحديث Gradle و Android Studio

### iOS
- مشاكل CocoaPods: `pod install --repo-update`
- مشاكل التوقيع: تحقق من شهادات التطوير وملفات التوقيع
- مشاكل البناء: تنظيف المشروع (Product > Clean Build Folder)

## موارد مفيدة
- [توثيق Capacitor](https://capacitorjs.com/docs)
- [دليل Google Play Console](https://play.google.com/console/about/)
- [دليل App Store Connect](https://appstoreconnect.apple.com/)