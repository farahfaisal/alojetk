# 🚚 تحديث تلقائي لحالة "في الطريق"

## ✅ تم التطبيق

تم إضافة نظام تلقائي يغير حالة الطلب إلى **"في الطريق" (shipping)** بمجرد بدء السائق رحلته.

---

## 📋 الملفات المضافة

### 1. Migration
```
supabase/migrations/20260202220000_add_shipping_status_and_auto_update.sql
```
ملف قاعدة البيانات الذي يحتوي على:
- تحديث constraint لدعم حالة 'shipping'
- دالة تلقائية لتغيير الحالة عند تعيين سائق
- دوال للتحكم اليدوي

### 2. التوثيق
```
docs/shipping-status-auto-update.md
```
دليل استخدام شامل يشمل:
- شرح النظام
- أمثلة عملية
- كود للتطبيق
- استكشاف الأخطاء

### 3. صفحة التطبيق
```
apply-shipping-status-migration.html
```
صفحة HTML سهلة لإرشادك خطوة بخطوة

---

## ⚡ تطبيق سريع (3 دقائق)

### الخطوة 1: افتح صفحة التطبيق
افتح في المتصفح:
```
apply-shipping-status-migration.html
```

### الخطوة 2: اتبع الخطوات
الصفحة ستوجهك خطوة بخطوة لتطبيق Migration في Supabase

### الخطوة 3: تحقق من النجاح
بعد التطبيق، شغّل هذا الأمر في Supabase SQL Editor:
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'start_delivery_trip';
```

إذا ظهرت النتيجة → ✅ التطبيق نجح!

---

## 🎯 كيف يعمل؟

### تلقائياً:
```
1. سائق يُعيّن للطلب في driver_waiting_list
   ↓
2. Trigger يعمل تلقائياً
   ↓
3. حالة الطلب تتغير إلى 'shipping'
   ↓
4. العميل يرى "السائق في الطريق إليك"
```

### يدوياً (للسائق):
```typescript
// عند بدء رحلة التوصيل
await supabase.rpc('start_delivery_trip', {
  p_order_id: orderId,
  p_driver_id: driverId,
  p_driver_name: driverName
});

// ✅ الحالة تتغير إلى 'shipping' فوراً
```

---

## 📊 الحالات المدعومة

| الحالة | الوصف | متى تحدث |
|--------|-------|----------|
| `pending` | معلق | عند إنشاء الطلب |
| `processing` | قيد التحضير | المتجر يحضر الطلب |
| **`shipping`** | **في الطريق** | **السائق بدأ الرحلة** ✅ |
| `delivering` | التوصيل | مصطلح عام |
| `completed` | مكتمل | تم التسليم |
| `cancelled` | ملغي | تم الإلغاء |

---

## 💻 الاستخدام في الكود

### مثال 1: في تطبيق السائق
```typescript
const handleStartDelivery = async () => {
  const { data } = await supabase.rpc('start_delivery_trip', {
    p_order_id: selectedOrder.id,
    p_driver_id: currentDriver.id,
    p_driver_name: currentDriver.name
  });

  if (data?.success) {
    // ✅ الحالة تغيرت إلى 'shipping'
    navigateToMap();
  }
};
```

### مثال 2: عرض الطلبات "في الطريق"
```typescript
const { data: shippingOrders } = await supabase
  .from('orders')
  .select('*, customers(*), vendors(*)')
  .eq('status', 'shipping');
```

### مثال 3: للطلبات المتعددة
```typescript
const { data } = await supabase.rpc('start_multi_delivery_trip', {
  p_order_ids: [orderId1, orderId2, orderId3],
  p_driver_id: driverId,
  p_driver_name: driverName
});
```

---

## 🎨 واجهة المستخدم

الواجهة تدعم حالة 'shipping' بالفعل في:

### OrderTrackingPage.tsx
```typescript
'shipping': 'في الطريق' // ✅ موجود
```

### الأيقونة
```typescript
case 'shipping':
  return <Truck className="w-5 h-5 text-orange-500" />; // 🚚
```

---

## 📈 الفوائد

| قبل | بعد |
|-----|-----|
| حالة عامة غير واضحة | حالة محددة: "في الطريق" ✅ |
| تحديث يدوي | تحديث تلقائي بالكامل ✅ |
| صعب تتبع متى بدأ السائق | سجل دقيق في order_status_history |
| رسالة عامة للعميل | "السائق في الطريق إليك" 🚚 |

---

## 🔍 التحقق من النظام

### عرض الطلبات في الطريق:
```sql
SELECT
  id,
  order_number,
  driver_name,
  status,
  updated_at
FROM orders
WHERE status = 'shipping';
```

### عرض سجل التغييرات:
```sql
SELECT
  status,
  note,
  created_at
FROM order_status_history
WHERE order_id = 'your-order-id'
ORDER BY created_at DESC;
```

---

## 🐛 المشاكل الشائعة

### المشكلة: الحالة لا تتغير تلقائياً

**السبب:** Migration لم يُطبّق بعد

**الحل:**
1. افتح `apply-shipping-status-migration.html`
2. اتبع الخطوات
3. تأكد من النجاح

### المشكلة: خطأ "function does not exist"

**السبب:** الدالة غير موجودة

**الحل:**
```sql
-- تطبيق migration مرة أخرى في Supabase
```

---

## 📚 المراجع

### للتفاصيل الكاملة:
📖 راجع: `docs/shipping-status-auto-update.md`

### للتطبيق:
🚀 افتح: `apply-shipping-status-migration.html`

### ملف Migration:
📄 الملف: `supabase/migrations/20260202220000_add_shipping_status_and_auto_update.sql`

---

## ✨ الخلاصة

✅ **تم إضافة:**
- حالة جديدة: `shipping` (في الطريق)
- تحديث تلقائي عند تعيين السائق
- دوال للتحكم اليدوي
- دعم الطلبات المتعددة

✅ **النتيجة:**
- تجربة أفضل للعميل
- وضوح أكثر في حالة الطلب
- سهولة في التتبع
- تحديث تلقائي بالكامل

---

**🎉 الآن، بمجرد أن يبدأ السائق رحلته، سيرى العميل "السائق في الطريق إليك" تلقائياً!**

---

*آخر تحديث: 2026-02-02*
