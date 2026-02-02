# 🚀 دليل سريع: إصلاح مشكلة وقت التوصيل

## المشكلة
رسالة تظهر للعملاء: **"⏱️ وقت التوصيل تقريبي - معلومات موقع المتجر غير محددة بدقة"**

## السبب
المتاجر في قاعدة البيانات **لا تحتوي على إحداثيات GPS** (latitude & longitude)

---

## ✅ الحل السريع (5 دقائق لكل متجر)

### 1️⃣ اعرف المتاجر بدون موقع

```sql
-- في Supabase Dashboard > SQL Editor
SELECT store_name, address, city
FROM vendors
WHERE latitude IS NULL OR longitude IS NULL;
```

### 2️⃣ اجلب الإحداثيات من Google Maps

1. افتح [Google Maps](https://maps.google.com)
2. ابحث عن عنوان المتجر
3. انقر بالزر الأيمن على الموقع
4. اختر **"What's here?"**
5. انسخ الأرقام: `31.5000, 34.4500`

### 3️⃣ حدّث قاعدة البيانات

```sql
-- استبدل القيم بالقيم الصحيحة
UPDATE vendors
SET
  latitude = 31.5000,    -- الرقم الأول من Google Maps
  longitude = 34.4500    -- الرقم الثاني من Google Maps
WHERE store_name = 'اسم المتجر';
```

### 4️⃣ تحقق من النتيجة

افتح التطبيق → اختر المتجر → **يجب ألا تظهر رسالة التحذير** ✨

---

## 📋 إحداثيات المدن الرئيسية (للبدء السريع)

| المدينة | Latitude | Longitude |
|---------|----------|-----------|
| غزة | `31.5000` | `34.4500` |
| خان يونس | `31.3463` | `34.3028` |
| رفح | `31.2900` | `34.2422` |
| دير البلح | `31.4192` | `34.3500` |
| جباليا | `31.5281` | `34.4831` |

> ⚠️ هذه إحداثيات **مركزية** للمدن. استخدمها كبداية، ثم حدّث كل متجر بموقعه الدقيق!

---

## 🔍 تحديث سريع حسب المدينة

```sql
-- مثال: تحديث جميع متاجر غزة (استخدم بحذر!)
UPDATE vendors
SET latitude = 31.5000, longitude = 34.4500
WHERE city ILIKE '%غزة%'
  AND (latitude IS NULL OR longitude IS NULL);
```

> ⚠️ **بعد ذلك:** حدّث كل متجر بموقعه الدقيق الخاص!

---

## 📊 تتبع التقدم

```sql
-- كم متجر تم تحديث موقعه؟
SELECT
  COUNT(*) FILTER (WHERE latitude IS NOT NULL) as "✅ بموقع",
  COUNT(*) FILTER (WHERE latitude IS NULL) as "❌ بدون موقع",
  ROUND(
    COUNT(*) FILTER (WHERE latitude IS NOT NULL)::numeric / COUNT(*) * 100
  ) as "% الاكتمال"
FROM vendors;
```

---

## 🎯 الهدف

**100% من المتاجر يجب أن تحتوي على latitude و longitude دقيقة!**

---

## 📚 المزيد من التفاصيل

- [دليل شامل](/docs/vendor-location-guide.md)
- [SQL Scripts جاهزة](/docs/check-vendors-location.sql)
- [تقرير المشكلة الكامل](/docs/location-problem-summary.md)

---

## 💡 نصائح سريعة

✅ **افعل:**
- استخدم Google Maps للدقة
- تحقق من كل موقع قبل الحفظ
- ابدأ بالمتاجر المميزة والنشطة

❌ **لا تفعل:**
- تخمين الإحداثيات
- نسخ نفس الموقع لمتاجر مختلفة
- استخدام إحداثيات مدن كاملة للمتاجر الفردية

---

**أي سؤال؟** راجع الدليل الشامل في `/docs/vendor-location-guide.md`
