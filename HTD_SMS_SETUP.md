# HTD SMS API Setup Guide

تم تحديث نظام OTP ليستخدم HTD SMS API بدلاً من Twilio.

## المتغيرات البيئية المطلوبة

يجب إضافة المتغيرات التالية إلى ملف `.env`:

```env
# HTD SMS API Configuration
HTD_API_ID=your_api_id_here
HTD_SENDER_ID=Benedek
```

## كيفية الحصول على HTD API ID

1. قم بتسجيل الدخول إلى حسابك في HTD SMS
2. انتقل إلى صفحة "My Account"
3. ستجد API ID الخاص بك - يمكنك إعادة توليده من نفس الصفحة
4. انسخ API ID وضعه في متغير `HTD_API_ID`

## Sender ID

- `HTD_SENDER_ID`: الاسم الذي سيظهر كمرسل للرسالة
- القيمة الافتراضية: `Benedek`
- تأكد من أن Sender ID معتمد ومفعل في حسابك

## تنسيق رقم الهاتف

النظام يقوم تلقائياً بتحويل الأرقام إلى التنسيق الدولي:
- من: `0595284308`
- إلى: `970595284308`

## وضع الاختبار

النظام يدخل في وضع الاختبار تلقائياً في الحالات التالية:
1. رقم الهاتف هو `0595284308` (حساب تجريبي)
2. عدم وجود `HTD_API_ID`

في وضع الاختبار:
- رمز OTP الثابت: `123456`
- لا يتم إرسال رسالة SMS فعلية
- يتم حفظ OTP في قاعدة البيانات

## API Response Codes

### Success
- `Message Sent Successfully`: تم إرسال الرسالة بنجاح

### Errors
- `Authentication Failed`: لم يتم العثور على الحساب
- `Insufficient Credit`: رصيد غير كافٍ
- `IP Not Allowed`: عنوان IP غير مسموح
- `Invalid ID Parameter`: معامل ID فارغ أو يحتوي على أحرف غير صالحة
- `Invalid SENDER Parameter`: معامل SENDER فارغ أو غير صالح
- `Invalid TO Parameters`: معامل TO فارغ أو غير صالح
- `Invalid MSG Parameter`: معامل MSG فارغ أو غير صالح
- `Sender Not Allowed`: اسم المرسل غير موجود أو غير معتمد
- `No Valid Recipients!`: لا يوجد مستلمون صالحون
- `Invalid Recipient`: رقم المستلم غير رقمي أو يحتوي على أحرف غير صالحة
- `Validation Failed`: فشل التحقق
- `Internal Error Occurred`: حدث خطأ داخلي

## اختبار النظام

بعد إعداد المتغيرات البيئية:

1. قم بإرسال OTP لرقم حقيقي (غير 0595284308)
2. تحقق من Logs في Supabase Edge Functions
3. تأكد من رسالة النجاح: `✅ SMS sent successfully via HTD!`

## Delivery Reports (اختياري)

يمكنك إعداد DLR Callback URL في صفحة "My Account" لتلقي تقارير التسليم:
```
https://your-project.supabase.co/functions/v1/htd-dlr-callback
```

## التكامل مع النظام الحالي

لا حاجة لتغيير أي شيء في Frontend - Edge Function تعمل بنفس الطريقة:

```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`
  },
  body: JSON.stringify({ phone: phoneNumber })
});
```

## الدعم الفني

لأي مشاكل:
1. تحقق من Logs في Supabase Dashboard
2. تأكد من صحة HTD_API_ID
3. تأكد من رصيد كافٍ في حساب HTD
4. تحقق من أن Sender ID معتمد
