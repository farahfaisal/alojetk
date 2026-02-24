# دليل سريع: تفعيل HTD SMS API

## ✅ تم التحديث

تم تغيير نظام إرسال OTP من Twilio إلى HTD SMS API بنجاح!

## 🔧 خطوات التفعيل

### 1. احصل على API ID من HTD

1. سجل دخول إلى حسابك في HTD SMS: https://sms.HTD.ps
2. اذهب إلى **My Account**
3. انسخ **API ID** الخاص بك

### 2. أضف المتغيرات إلى Supabase

في Supabase Dashboard:

1. اذهب إلى **Project Settings** > **Edge Functions**
2. أضف المتغيرات التالية:

```
HTD_API_ID = [ضع API ID هنا]
HTD_SENDER_ID = Benedek
```

### 3. تأكد من Sender ID

- تأكد من أن `Benedek` معتمد كـ Sender ID في حسابك
- إذا كنت تريد استخدام اسم آخر، غير قيمة `HTD_SENDER_ID`

## 📱 تنسيق الأرقام

النظام يحول الأرقام تلقائياً:
- `0599123456` → `970599123456`

## 🧪 وضع الاختبار

النظام يستخدم OTP ثابت (`123456`) في الحالات:
- رقم الهاتف: `0595284308`
- عدم وجود `HTD_API_ID`

## 🎯 ماذا تغير؟

**قبل:**
- استخدام Twilio لإرسال SMS
- يحتاج Account SID, Auth Token, Phone Number

**بعد:**
- استخدام HTD SMS API
- يحتاج فقط API ID و Sender ID
- أسهل وأرخص للأرقام الفلسطينية

## ✅ الاختبار

بعد إضافة المتغيرات:

1. جرب تسجيل دخول برقم جديد
2. يجب أن تصل رسالة SMS من `Benedek`
3. الرمز صالح لمدة 15 دقيقة

## 🔍 التحقق من المشاكل

إذا لم تصل الرسالة:

1. **تحقق من Logs:**
   - Supabase Dashboard > Edge Functions > send-otp > Logs

2. **أخطاء شائعة:**
   - `Authentication Failed` → تحقق من HTD_API_ID
   - `Insufficient Credit` → رصيد غير كافٍ
   - `Sender Not Allowed` → Sender ID غير معتمد
   - `Invalid Recipient` → تنسيق رقم خاطئ

## 📞 الدعم

للمساعدة، تحقق من:
- ملف `HTD_SMS_SETUP.md` للتفاصيل الكاملة
- Logs في Supabase Dashboard
- حسابك في HTD SMS Dashboard
