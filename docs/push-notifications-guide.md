# دليل إعداد الإشعارات في تطبيق بين اديك

## المقدمة

هذا الدليل يشرح كيفية إعداد وتكوين الإشعارات في تطبيق بين اديك لكل من منصتي Android و iOS. يستخدم التطبيق Firebase Cloud Messaging (FCM) لإرسال الإشعارات.

## المتطلبات الأساسية

1. حساب Firebase
2. مشروع Firebase مع تكوين Android و iOS
3. ملفات التكوين:
   - `google-services.json` لـ Android
   - `GoogleService-Info.plist` لـ iOS

## إعداد Firebase

### إنشاء مشروع Firebase

1. انتقل إلى [Firebase Console](https://console.firebase.google.com/)
2. أنشئ مشروعًا جديدًا أو استخدم مشروعًا موجودًا
3. أضف تطبيق Android:
   - معرف الحزمة: `com.benedek.app`
   - اسم التطبيق: `بين اديك`
   - قم بتنزيل ملف `google-services.json`
4. أضف تطبيق iOS:
   - معرف الحزمة: `com.benedek.app`
   - اسم التطبيق: `بين اديك`
   - قم بتنزيل ملف `GoogleService-Info.plist`

## إعداد Android

1. ضع ملف `google-services.json` في مجلد `android/app`
2. تأكد من إضافة التبعيات في ملف `android/build.gradle`:
   ```gradle
   buildscript {
       dependencies {
           classpath 'com.google.gms:google-services:4.4.0'
       }
   }
   ```
3. تأكد من تطبيق البلاجن في ملف `android/app/build.gradle`:
   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```
4. أضف تبعيات Firebase في ملف `android/app/build.gradle`:
   ```gradle
   dependencies {
       implementation platform('com.google.firebase:firebase-bom:32.7.2')
       implementation 'com.google.firebase:firebase-messaging'
       implementation 'com.google.firebase:firebase-analytics'
   }
   ```
5. أنشئ فئة خدمة الإشعارات في `android/app/src/main/java/com/benedek/app/PushNotificationService.java`
6. أضف الخدمة والإعدادات في `AndroidManifest.xml`

## إعداد iOS

1. ضع ملف `GoogleService-Info.plist` في مجلد `ios/App/App`
2. أضف تبعيات Firebase في ملف `ios/App/Podfile`:
   ```ruby
   target 'App' do
     # ...
     pod 'FirebaseAnalytics'
     pod 'FirebaseMessaging'
   end
   ```
3. قم بتكوين `AppDelegate.swift` لتهيئة Firebase وتسجيل الإشعارات
4. أضف الإعدادات المطلوبة في `Info.plist`:
   ```xml
   <key>FirebaseAppDelegateProxyEnabled</key>
   <false/>
   <key>UIBackgroundModes</key>
   <array>
     <string>fetch</string>
     <string>remote-notification</string>
   </array>
   ```

## إعداد Capacitor

1. قم بتثبيت حزمة الإشعارات:
   ```bash
   npm install @capacitor/push-notifications
   ```
2. قم بمزامنة التغييرات مع التطبيقات الأصلية:
   ```bash
   npx cap sync
   ```

## استخدام الإشعارات في التطبيق

### تهيئة الإشعارات

```typescript
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export async function initPushNotifications() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    const permissionStatus = await PushNotifications.requestPermissions();
    
    if (permissionStatus.receive === 'granted') {
      await PushNotifications.register();
      setupPushListeners();
    }
  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
}
```

### الاستماع للإشعارات

```typescript
function setupPushListeners() {
  PushNotifications.addListener('registration', (token) => {
    console.log('Push registration success, token:', token.value);
    // أرسل الرمز إلى الخادم الخاص بك
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push notification received:', notification);
    // معالجة الإشعار عندما يكون التطبيق في المقدمة
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push notification action performed:', notification);
    // معالجة النقر على الإشعار
  });
}
```

## إرسال الإشعارات

### من لوحة تحكم Firebase

1. انتقل إلى Firebase Console > Messaging
2. انقر على "إرسال إشعار أول"
3. أدخل عنوان الإشعار ونصه
4. حدد الجمهور المستهدف
5. أرسل الإشعار

### من خلال Firebase Admin SDK (للخادم)

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const message = {
  notification: {
    title: 'عنوان الإشعار',
    body: 'محتوى الإشعار'
  },
  data: {
    type: 'order_update',
    orderId: 'ORD-12345'
  },
  token: 'رمز-الجهاز'
};

admin.messaging().send(message)
  .then((response) => {
    console.log('تم إرسال الإشعار بنجاح:', response);
  })
  .catch((error) => {
    console.error('فشل إرسال الإشعار:', error);
  });
```

## اختبار الإشعارات

### اختبار على Android

1. قم ببناء وتشغيل التطبيق على جهاز Android
2. تأكد من تسجيل رمز FCM في سجلات التطبيق
3. أرسل إشعارًا تجريبيًا من لوحة تحكم Firebase

### اختبار على iOS

1. قم ببناء وتشغيل التطبيق على جهاز iOS
2. اقبل طلب الإذن لتلقي الإشعارات
3. تأكد من تسجيل رمز APNs في سجلات التطبيق
4. أرسل إشعارًا تجريبيًا من لوحة تحكم Firebase

## استكشاف الأخطاء وإصلاحها

### مشاكل شائعة في Android

- تأكد من وجود ملف `google-services.json` في المكان الصحيح
- تحقق من تكوين `AndroidManifest.xml` بشكل صحيح
- تأكد من تسجيل خدمة FCM في المانيفست

### مشاكل شائعة في iOS

- تأكد من وجود ملف `GoogleService-Info.plist` في المكان الصحيح
- تحقق من تكوين `AppDelegate.swift` بشكل صحيح
- تأكد من تمكين وضع الخلفية وإعدادات الإشعارات في `Info.plist`
- تحقق من إعدادات القدرات في Xcode (Push Notifications)

## الخلاصة

باتباع هذا الدليل، يمكنك إعداد وتكوين الإشعارات في تطبيق بين اديك لكل من منصتي Android و iOS. تأكد من اختبار الإشعارات على كلا المنصتين للتأكد من عملها بشكل صحيح.