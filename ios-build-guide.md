# دليل بناء تطبيق iOS لمشروع "بين اديك"

## المقدمة

هذا الدليل يشرح بالتفصيل كيفية بناء وتوقيع ونشر تطبيق iOS لمشروع "بين اديك" باستخدام Capacitor. يغطي الدليل جميع الخطوات من إعداد البيئة وحتى نشر التطبيق على App Store.

## المتطلبات الأساسية

1. **الأجهزة والبرامج**:
   - جهاز Mac مع نظام macOS 11 (Big Sur) أو أحدث
   - Xcode 13 أو أحدث
   - حساب Apple Developer (مطلوب للنشر)
   - Node.js 14 أو أحدث
   - CocoaPods

2. **تثبيت الأدوات**:
   ```bash
   # تثبيت CocoaPods
   sudo gem install cocoapods
   
   # تثبيت حزم Capacitor
   npm install @capacitor/ios @capacitor/cli
   ```

## إعداد المشروع

### 1. بناء تطبيق الويب
```bash
npm run build
```

### 2. إضافة منصة iOS
```bash
npx cap add ios
```

### 3. مزامنة الملفات
```bash
npx cap sync
```

### 4. فتح المشروع في Xcode
```bash
npx cap open ios
```

## تكوين المشروع في Xcode

### 1. إعداد معلومات التطبيق
1. حدد مشروع App في المتصفح
2. انتقل إلى علامة التبويب "General"
3. تحقق من المعلومات التالية:
   - Display Name: بين اديك
   - Bundle Identifier: com.benedek.app
   - Version: 1.0
   - Build: 1

### 2. إعداد فريق التطوير
1. انتقل إلى علامة التبويب "Signing & Capabilities"
2. حدد فريق التطوير الخاص بك
3. تأكد من تمكين "Automatically manage signing"

### 3. تخصيص الأيقونات
1. افتح Assets.xcassets
2. استبدل الأيقونات الافتراضية بأيقونات التطبيق
3. تأكد من توفير جميع أحجام الأيقونات المطلوبة

### 4. تخصيص شاشة البداية
1. افتح LaunchScreen.storyboard
2. قم بتخصيص شاشة البداية بشعار التطبيق والألوان المناسبة

### 5. إعداد الأذونات
1. افتح Info.plist
2. أضف أوصاف الأذونات المطلوبة:
   ```xml
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>نحتاج إلى موقعك لتوفير خدمات التوصيل بشكل صحيح</string>
   
   <key>NSCameraUsageDescription</key>
   <string>نحتاج إلى الكاميرا لمسح رموز QR</string>
   ```

## بناء التطبيق للاختبار

### 1. اختبار على المحاكي
1. اختر جهاز محاكاة من قائمة الأجهزة
2. اضغط على زر التشغيل (▶️)
3. تحقق من عمل التطبيق بشكل صحيح

### 2. اختبار على جهاز حقيقي
1. وصل جهاز iOS بجهاز Mac
2. اختر الجهاز من قائمة الأجهزة
3. اضغط على زر التشغيل (▶️)
4. قد تحتاج إلى الثقة بشهادة المطور على الجهاز

## إعداد التوقيع للنشر

### 1. إنشاء شهادات التوقيع
1. انتقل إلى [Apple Developer Portal](https://developer.apple.com/account/resources/certificates/list)
2. أنشئ شهادة توقيع جديدة من نوع "Apple Distribution"
3. قم بتنزيل الشهادة وتثبيتها في Keychain Access

### 2. إنشاء ملفات التوقيع
1. انتقل إلى [Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. أنشئ معرف تطبيق جديد (App ID) باستخدام Bundle Identifier الخاص بك
3. انتقل إلى [Profiles](https://developer.apple.com/account/resources/profiles/list)
4. أنشئ ملف توقيع جديد (Provisioning Profile) من نوع "App Store"
5. قم بتنزيل ملف التوقيع وتثبيته بالنقر المزدوج عليه

### 3. تكوين التوقيع في Xcode
1. انتقل إلى علامة التبويب "Signing & Capabilities"
2. قم بإلغاء تحديد "Automatically manage signing"
3. اختر ملف التوقيع الذي أنشأته للإصدار

## بناء التطبيق للنشر

### 1. إنشاء Archive
1. اختر "Generic iOS Device" من قائمة الأجهزة
2. اختر Product > Archive من القائمة
3. انتظر حتى يكتمل بناء Archive

### 2. توزيع التطبيق
1. بعد اكتمال بناء Archive، سيفتح Xcode Organizer
2. حدد Archive الذي أنشأته
3. انقر على "Distribute App"
4. اختر "App Store Connect"
5. اتبع الخطوات لتوقيع وتحميل التطبيق

## نشر التطبيق على App Store

### 1. إعداد التطبيق في App Store Connect
1. انتقل إلى [App Store Connect](https://appstoreconnect.apple.com/)
2. أنشئ تطبيقًا جديدًا باستخدام Bundle ID الخاص بك
3. أدخل معلومات التطبيق:
   - الاسم: بين اديك
   - الوصف
   - لقطات الشاشة
   - الأيقونة

### 2. تقديم التطبيق للمراجعة
1. بعد تحميل الإصدار، أكمل جميع المعلومات المطلوبة
2. أجب على أسئلة مراجعة التطبيق
3. قدم التطبيق للمراجعة

### 3. متابعة حالة المراجعة
1. راقب حالة المراجعة في App Store Connect
2. استعد للرد على أي استفسارات من فريق مراجعة Apple

## تحديث التطبيق

### 1. تحديث الإصدار
1. قم بزيادة رقم الإصدار في Xcode
2. قم بزيادة رقم البناء

### 2. بناء وتوزيع التحديث
1. اتبع نفس خطوات بناء Archive والتوزيع
2. أضف ملاحظات الإصدار في App Store Connect

## حل المشكلات الشائعة

### 1. مشاكل التوقيع
- تحقق من صلاحية الشهادات وملفات التوقيع
- تأكد من تطابق Bundle Identifier مع معرف التطبيق المسجل

### 2. مشاكل البناء
- قم بتنظيف المشروع: Product > Clean Build Folder
- تحقق من تثبيت CocoaPods بشكل صحيح: `pod install --repo-update`

### 3. مشاكل التحميل
- تأكد من اتصال الإنترنت
- تحقق من حجم التطبيق (الحد الأقصى 4GB)

## الخلاصة

باتباع هذا الدليل، يمكنك بناء وتوقيع ونشر تطبيق iOS لمشروع "بين اديك" بنجاح. تأكد من اختبار التطبيق جيدًا قبل تقديمه للمراجعة لتجنب الرفض.

## موارد إضافية
- [توثيق Capacitor لـ iOS](https://capacitorjs.com/docs/ios)
- [دليل نشر تطبيقات iOS](https://developer.apple.com/app-store/submissions/)
- [إرشادات مراجعة App Store](https://developer.apple.com/app-store/review/guidelines/)