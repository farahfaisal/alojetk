# 🚀 دليل سريع لإصلاح خطأ HTD SMS

## ❌ المشكلة الحالية

```
H005|Invalid SENDER Parameter
```

هذا يعني أن **Sender ID** غير معتمد من HTD.

---

## ✅ الحل السريع

### الخطوة 1: تحديد Sender ID المعتمد

تواصل مع HTD وأسألهم عن **Sender IDs** المعتمدة لحسابك. عادةً ما تكون:

- `SMS` (الأكثر شيوعاً)
- `Alert`
- `Info`
- `Notice`
- أو اسم خاص تم اعتماده مسبقاً

**كيف تتحقق؟**
1. سجّل دخول إلى [HTD Dashboard](http://sms.htd.ps)
2. انتقل إلى **Settings** أو **Sender IDs**
3. أو اتصل بالدعم الفني: support@htd.ps

---

### الخطوة 2: تحديث المتغيرات

#### في Supabase Dashboard:

1. افتح مشروعك في Supabase
2. اذهب إلى: **Project Settings** → **Edge Functions**
3. أضف/حدّث المتغيرات:

```
HTD_API_ID = 6a149c3f0fb541ede8c0dd87327d915d
HTD_SENDER_ID = SMS
```

(استبدل `SMS` بالاسم المعتمد لديك)

---

### الخطوة 3: اختبار

افتح `test-htd-api.html` وجرب sender IDs مختلفة حتى تجد الصحيح.

---

## 📞 الدعم الفني

**HTD SMS:**
- الموقع: http://sms.htd.ps
- البريد: support@htd.ps
