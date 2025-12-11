# دليل بناء تطبيق Android لمشروع "بين اديك"

## المقدمة

هذا الدليل يشرح بالتفصيل كيفية بناء وتوقيع ونشر تطبيق Android لمشروع "بين اديك" باستخدام Capacitor. يغطي الدليل جميع الخطوات من إعداد البيئة وحتى نشر التطبيق على Google Play Store.

## المتطلبات الأساسية

1. **الأجهزة والبرامج**:
   - Android Studio (أحدث إصدار)
   - JDK 11 أو أحدث
   - Node.js 14 أو أحدث
   - حساب Google Play Developer (مطلوب للنشر)

2. **تثبيت الأدوات**:
   ```bash
   # تثبيت حزم Capacitor
   npm install @capacitor/android @capacitor/cli
   ```

## إعداد المشروع

### 1. بناء تطبيق الويب
```bash
npm run build
```

### 2. إضافة منصة Android
```bash
npx cap add android
```

### 3. مزامنة الملفات
```bash
npx cap sync
```

### 4. فتح المشروع في Android Studio
```bash
npx cap open android
```

## تكوين المشروع في Android Studio

### 1. إعداد معلومات التطبيق
1. افتح ملف `android/app/build.gradle`
2. تحقق من المعلومات التالية:
   - applicationId: "com.benedek.app"
   - versionCode: 1
   - versionName: "1.0"

### 2. تخصيص الأيقونات
1. استبدل الأيقونات الافتراضية في المجلدات التالية:
   - `android/app/src/main/res/mipmap-hdpi`
   - `android/app/src/main/res/mipmap-mdpi`
   - `android/app/src/main/res/mipmap-xhdpi`
   - `android/app/src/main/res/mipmap-xxhdpi`
   - `android/app/src/main/res/mipmap-xxxhdpi`

### 3. تخصيص شاشة البداية
1. تعديل ملف `android/app/src/main/res/values/styles.xml`
2. تخصيص الألوان في `android/app/src/main/res/values/colors.xml`
3. تعديل صور شاشة البداية في مجلدات `drawable-*`

### 4. إعداد الأذونات
1. افتح ملف `android/app/src/main/AndroidManifest.xml`
2. أضف الأذونات المطلوبة:
   ```xml
   <uses-permission android:name="android.permission.INTERNET" />
   <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
   <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
   ```

## إعداد التوقيع الرقمي

### 1. إنشاء ملف keystore
```bash
keytool -genkey -v -keystore android/benedek.keystore -alias benedek -keyalg RSA -keysize 2048 -validity 10000 -storepass benedek2025 -keypass benedek2025
```

### 2. تكوين التوقيع في `android/app/build.gradle`
```groovy
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

## بناء التطبيق للاختبار

### 1. بناء نسخة Debug
```bash
cd android
./gradlew assembleDebug
```

### 2. تثبيت النسخة على جهاز متصل
```bash
./gradlew installDebug
```

### 3. اختبار على أجهزة مختلفة
- اختبر التطبيق على أجهزة بأحجام شاشة مختلفة
- اختبر على إصدارات مختلفة من Android (من API 22 إلى أحدث إصدار)

## بناء التطبيق للنشر

### 1. بناء نسخة Release
```bash
cd android
./gradlew assembleRelease
```

### 2. اختبار نسخة Release
```bash
./gradlew installRelease
```

### 3. التحقق من ملف APK
ملف APK النهائي سيكون في:
```
android/app/build/outputs/apk/release/app-release.apk
```

## إنشاء حزمة Android App Bundle (AAB)

### 1. بناء حزمة AAB
```bash
cd android
./gradlew bundleRelease
```

### 2. التحقق من ملف AAB
ملف AAB سيكون في:
```
android/app/build/outputs/bundle/release/app-release.aab
```

## نشر التطبيق على Google Play Store

### 1. إعداد حساب Google Play Developer
1. سجل في [Google Play Developer Console](https://play.google.com/console/signup)
2. ادفع رسوم التسجيل (25 دولار أمريكي لمرة واحدة)
3. أكمل معلومات الحساب

### 2. إنشاء تطبيق جديد
1. انتقل إلى [Google Play Console](https://play.google.com/console)
2. انقر على "إنشاء تطبيق"
3. أدخل معلومات التطبيق:
   - الاسم: بين اديك
   - اللغة الافتراضية: العربية
   - نوع التطبيق: تطبيق
   - مجاني أو مدفوع: مجاني

### 3. إعداد صفحة المتجر
1. أضف وصف التطبيق
2. أضف لقطات الشاشة (للهاتف والجهاز اللوحي)
3. أضف رمز التطبيق
4. أضف تصنيف المحتوى
5. أكمل معلومات جهة الاتصال

### 4. تحميل ملف AAB
1. انتقل إلى "إنتاج" > "إصدارات التطبيق"
2. انقر على "إنشاء إصدار"
3. حمّل ملف AAB الذي أنشأته
4. أدخل ملاحظات الإصدار
5. انقر على "مراجعة"

### 5. نشر التطبيق
1. بعد مراجعة جميع المعلومات، انقر على "بدء الطرح إلى الإنتاج"
2. اختر نوع الطرح (كامل، تدريجي، إلخ)
3. انتظر مراجعة Google (قد تستغرق من ساعات إلى أيام)

## تحديث التطبيق

### 1. تحديث الإصدار
1. قم بزيادة `versionCode` و `versionName` في `android/app/build.gradle`
2. قم ببناء تطبيق الويب وتحديث الملفات:
   ```bash
   npm run build
   npx cap sync android
   ```

### 2. بناء وتوزيع التحديث
1. اتبع نفس خطوات بناء AAB
2. حمّل الإصدار الجديد إلى Google Play Console

## حل المشكلات الشائعة

### 1. مشاكل التوقيع
- تحقق من مسار ملف keystore
- تأكد من صحة كلمات المرور

### 2. مشاكل البناء
- قم بتحديث Gradle: `./gradlew wrapper --gradle-version=7.4.2`
- تحقق من تثبيت JDK بشكل صحيح
- تأكد من تحديث Android Studio

### 3. مشاكل التوافق
- تحقق من `minSdkVersion` (يجب أن تكون 22 أو أعلى)
- تأكد من توافق الإضافات مع إصدار Android المستهدف

## الخلاصة

باتباع هذا الدليل، يمكنك بناء وتوقيع ونشر تطبيق Android لمشروع "بين اديك" بنجاح. تأكد من اختبار التطبيق جيدًا على مجموعة متنوعة من الأجهزة قبل النشر.

## موارد إضافية
- [توثيق Capacitor لـ Android](https://capacitorjs.com/docs/android)
- [دليل نشر تطبيقات Android](https://developer.android.com/studio/publish)
- [إرشادات Google Play](https://developer.android.com/distribute/best-practices/launch/launch-checklist)