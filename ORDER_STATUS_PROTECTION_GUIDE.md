# دليل حماية حالة الطلبات

## ✅ تم التطبيق بنجاح

تم إضافة حماية قوية لمنع تغيير حالة الطلب إلى "في الطريق" قبل بدء السائق فعلياً.

---

## 📋 القواعد الجديدة

### 1. حالة "في الطريق" محمية
- **لا يمكن** تغيير حالة الطلب إلى `shipping`, `on_the_way`, أو `picked_up` إلا إذا:
  - كان السائق قد بدأ الرحلة فعلياً
  - حالة الرحلة في `driver_trips` هي `in_progress` أو `started` أو `picked_up`

### 2. تعيين السائق
عند تعيين سائق للطلب:
```sql
SELECT assign_trip_to_driver(
  p_order_id := 'uuid-here',
  p_driver_id := 'driver-uuid',
  p_driver_name := 'اسم السائق' -- اختياري
);
```

**النتيجة:**
- ✅ يتم تعيين السائق للطلب
- ✅ تُنشأ رحلة بحالة `assigned`
- ⚠️ **الطلب يبقى في حالة `processing`** (لا يتغير)
- 📝 يُضاف سجل في `order_status_history`

### 3. بدء الرحلة
عندما يبدأ السائق الرحلة من تطبيق السائق:
```sql
SELECT start_driver_trip(
  p_order_id := 'uuid-here',
  p_driver_id := 'driver-uuid'
);
```

**النتيجة:**
- ✅ تتغير حالة الرحلة إلى `in_progress`
- ✅ يُسجل وقت البدء `started_at`
- ✅ **الآن فقط** تتغير حالة الطلب إلى `shipping`
- 📝 يُضاف سجل في `order_status_history`

---

## 🔒 الحماية

### ما الذي يمنعه النظام؟

1. ❌ تغيير حالة الطلب يدوياً إلى "في الطريق" بدون بدء الرحلة
2. ❌ تحديث حالة الطلب من أي واجهة إدارية بدون التحقق من حالة الرحلة
3. ❌ أي محاولة لتجاوز التدفق الطبيعي

### رسائل الخطأ

عند محاولة تغيير الحالة بشكل خاطئ:
```
لا يمكن تغيير حالة الطلب إلى "shipping" قبل أن يبدأ السائق الرحلة.
حالة الرحلة الحالية: "assigned"
```

---

## 📊 التدفق الصحيح

```
1. الطلب الجديد
   └─> status: "pending"

2. تأكيد الطلب
   └─> status: "processing"

3. تعيين السائق (assign_trip_to_driver)
   ├─> status: "processing" ⬅️ لا يتغير!
   └─> driver_trips.status: "assigned"

4. السائق يبدأ الرحلة (start_driver_trip)
   ├─> driver_trips.status: "in_progress"
   └─> status: "shipping" ⬅️ الآن يتغير!

5. التوصيل
   └─> status: "delivered"
```

---

## 🧪 الاختبار

للتحقق من أن كل شيء يعمل:

```sql
-- التحقق من جميع الطلبات
SELECT
  o.order_number,
  o.status as order_status,
  dt.status as trip_status,
  CASE
    WHEN o.status IN ('shipping', 'on_the_way', 'picked_up')
         AND dt.status NOT IN ('in_progress', 'started', 'picked_up')
    THEN '❌ خطأ'
    ELSE '✅ صحيح'
  END as validation
FROM orders o
LEFT JOIN driver_trips dt ON dt.order_id = o.id AND dt.driver_id = o.driver_id
WHERE o.driver_id IS NOT NULL;
```

---

## 💡 ملاحظات مهمة

1. **للمطورين:**
   - استخدم دائماً `start_driver_trip()` عندما يبدأ السائق الرحلة
   - لا تحاول تحديث `orders.status` مباشرة

2. **للإداريين:**
   - لا يمكن تغيير حالة الطلب يدوياً من لوحة التحكم إلى "في الطريق"
   - يجب انتظار السائق ليبدأ الرحلة من تطبيقه

3. **للسائقين:**
   - يجب النقر على "بدء الرحلة" في التطبيق
   - بعدها فقط ستتغير حالة الطلب

---

## ✅ الوضع الحالي

- ✅ تم تطبيق الحماية على جميع الطلبات
- ✅ تم تصحيح 10 طلبات قديمة
- ✅ جميع الطلبات الحالية متوافقة مع القواعد الجديدة
- ✅ النظام جاهز للاستخدام
