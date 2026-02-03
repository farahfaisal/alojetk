# 🚚 تحديث تلقائي لحالة "في الطريق" عند بدء رحلة السائق

## نظرة عامة

تم تطوير نظام تلقائي يغير حالة الطلب إلى **"في الطريق" (shipping)** بمجرد أن يبدأ السائق رحلة التوصيل.

---

## ✨ المميزات

### 1. تحديث تلقائي عند تعيين السائق
```
عند تعيين سائق للطلب → الحالة تتغير تلقائياً إلى 'shipping'
```

### 2. دوال للتحكم اليدوي
- `start_delivery_trip()` - لبدء رحلة طلب واحد
- `start_multi_delivery_trip()` - لبدء رحلة عدة طلبات

### 3. تسجيل كامل
- كل تغيير يُسجل في `order_status_history`
- يحفظ معلومات السائق ووقت التغيير

---

## 📋 الحالات المدعومة

```sql
-- الحالات المسموحة في جدول orders
'pending'      - معلق / في انتظار الموافقة
'processing'   - قيد التحضير
'shipping'     - في الطريق (السائق قادم) 🚚 ✅ جديد
'delivering'   - التوصيل (عام)
'completed'    - مكتمل
'cancelled'    - ملغي
```

---

## 🔄 التدفق التلقائي

### السيناريو 1: عبر driver_waiting_list

```
1. يتم إنشاء طلب (status = 'pending')
2. المتجر يقبل ويحضر الطلب (status = 'processing')
3. يتم تعيين سائق في driver_waiting_list
   ↓
   ✅ TRIGGER يعمل تلقائياً
   ↓
4. حالة الطلب تتغير إلى 'shipping'
5. يُسجل في order_status_history
6. العميل يرى "السائق في الطريق إليك"
```

### الكود التلقائي (Trigger):

```sql
-- يعمل تلقائياً عند تحديث driver_id
CREATE TRIGGER update_order_with_driver_trigger
  AFTER UPDATE OF driver_id ON driver_waiting_list
  FOR EACH ROW
  WHEN (NEW.driver_id IS NOT NULL)
  EXECUTE FUNCTION update_delivery_status_with_driver();
```

---

## 💻 الاستخدام البرمجي

### 1. بدء رحلة طلب واحد

```typescript
// في تطبيق السائق
const startTrip = async (orderId: string, driverId: string, driverName: string) => {
  const { data, error } = await supabase
    .rpc('start_delivery_trip', {
      p_order_id: orderId,
      p_driver_id: driverId,
      p_driver_name: driverName
    });

  if (data?.success) {
    console.log('✅ تم بدء الرحلة:', data.message);
    // الحالة الآن = 'shipping'
  }
};
```

### 2. بدء رحلة متعددة الطلبات

```typescript
// للسائق الذي سيوصل عدة طلبات
const startMultiTrip = async (
  orderIds: string[],
  driverId: string,
  driverName: string
) => {
  const { data, error } = await supabase
    .rpc('start_multi_delivery_trip', {
      p_order_ids: orderIds,
      p_driver_id: driverId,
      p_driver_name: driverName
    });

  if (data?.success) {
    console.log(`✅ تم بدء ${data.updated_count} طلبات`);
  }
};
```

### 3. التحقق من حالة الطلب

```typescript
// التحقق من أن الطلب في حالة "في الطريق"
const checkOrderStatus = async (orderId: string) => {
  const { data } = await supabase
    .from('orders')
    .select('status, driver_name')
    .eq('id', orderId)
    .single();

  if (data?.status === 'shipping') {
    console.log('🚚 السائق في الطريق:', data.driver_name);
  }
};
```

---

## 🎯 أمثلة عملية

### مثال 1: في تطبيق السائق (Driver App)

```typescript
// عند الضغط على زر "بدء التوصيل"
const handleStartDelivery = async () => {
  const driverId = getCurrentDriverId();
  const driverName = getCurrentDriverName();
  const orderId = selectedOrder.id;

  // بدء الرحلة
  const result = await supabase.rpc('start_delivery_trip', {
    p_order_id: orderId,
    p_driver_id: driverId,
    p_driver_name: driverName
  });

  if (result.data?.success) {
    // ✅ الحالة تغيرت إلى 'shipping'
    // العميل سيرى "السائق في الطريق"
    showNotification('تم بدء رحلة التوصيل');
    navigateToNavigation(selectedOrder);
  }
};
```

### مثال 2: في لوحة تحكم الإدارة

```sql
-- تحديث حالة طلب معين يدوياً
SELECT start_delivery_trip(
  'order-uuid-here',
  'driver-uuid-here',
  'محمد أحمد'
);

-- النتيجة:
{
  "success": true,
  "message": "تم تغيير حالة الطلب إلى في الطريق",
  "order_id": "...",
  "new_status": "shipping"
}
```

### مثال 3: عرض الطلبات في الطريق

```typescript
// عرض جميع الطلبات التي السائق في الطريق بها
const getShippingOrders = async () => {
  const { data } = await supabase
    .from('orders')
    .select(`
      *,
      customers(name, phone),
      vendors(store_name)
    `)
    .eq('status', 'shipping')
    .order('updated_at', { ascending: false });

  return data;
};
```

---

## 📱 التكامل مع الواجهة

### تحديث OrderTrackingPage

الملف: `src/components/OrderTrackingPage.tsx`

```typescript
// الكود موجود بالفعل ويدعم 'shipping'
const getStatusText = (status: string) => {
  const statusMap: { [key: string]: string } = {
    'pending': 'في انتظار الموافقة',
    'accepted': 'تم قبول الطلب',
    'processing': 'جاري التحضير',
    'ready': 'جاهز للتوصيل',
    'shipping': 'في الطريق', // ✅ مدعوم
    'delivered': 'تم التوصيل',
    'completed': 'مكتمل',
    'cancelled': 'ملغي'
  };
  return statusMap[status] || status;
};
```

---

## 🔍 التحقق من النظام

### 1. اختبار Trigger

```sql
-- إنشاء طلب اختباري
INSERT INTO orders (customer_id, vendor_id, total, status)
VALUES ('customer-id', 'vendor-id', 100.00, 'processing');

-- تعيين سائق (يجب أن يغير الحالة تلقائياً)
UPDATE driver_waiting_list
SET driver_id = 'driver-uuid', driver_name = 'محمد'
WHERE order_id = 'order-uuid';

-- التحقق من الحالة
SELECT status, driver_name
FROM orders
WHERE id = 'order-uuid';
-- النتيجة المتوقعة: status = 'shipping'
```

### 2. عرض سجل التغييرات

```sql
-- عرض تاريخ تغيير الحالة للطلب
SELECT
  status,
  note,
  created_at,
  created_by
FROM order_status_history
WHERE order_id = 'order-uuid'
ORDER BY created_at DESC;
```

### 3. إحصائيات

```sql
-- عدد الطلبات في كل حالة
SELECT
  status,
  COUNT(*) as count
FROM orders
GROUP BY status
ORDER BY count DESC;

-- عدد الطلبات "في الطريق" لكل سائق
SELECT
  driver_name,
  COUNT(*) as shipping_orders
FROM orders
WHERE status = 'shipping'
GROUP BY driver_name;
```

---

## 🛠️ تطبيق Migration

### الطريقة 1: Supabase Dashboard

1. افتح [Supabase Dashboard](https://supabase.com/dashboard)
2. اختر مشروعك
3. اذهب إلى **SQL Editor**
4. انسخ محتوى الملف:
   ```
   supabase/migrations/20260202220000_add_shipping_status_and_auto_update.sql
   ```
5. الصق في SQL Editor
6. اضغط **Run**

### الطريقة 2: Supabase CLI

```bash
# إذا كان لديك Supabase CLI
supabase db push

# أو
supabase migration up
```

---

## 🎨 تحديثات الواجهة الموصى بها

### 1. إضافة أيقونة "في الطريق"

```typescript
// في OrderTrackingPage.tsx
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'shipping':
      return <Truck className="w-5 h-5 text-orange-500" />;
    // ... باقي الحالات
  }
};
```

### 2. عرض معلومات السائق

```typescript
{orderDetails.status === 'shipping' && (
  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
    <div className="flex items-center gap-3">
      <Truck className="text-orange-600" size={24} />
      <div>
        <p className="font-semibold text-orange-900">
          السائق في الطريق إليك
        </p>
        <p className="text-orange-700 text-sm">
          {orderDetails.driver_name}
        </p>
      </div>
    </div>
  </div>
)}
```

### 3. رسالة للعميل

```typescript
const getStatusMessage = (status: string) => {
  if (status === 'shipping') {
    return {
      title: 'السائق في الطريق',
      message: 'سيصلك طلبك قريباً. يمكنك التواصل مع السائق عند الحاجة.',
      color: 'orange'
    };
  }
  // ... باقي الرسائل
};
```

---

## 📊 الفوائد

| الميزة | قبل | بعد |
|--------|-----|-----|
| **الدقة** | حالة عامة "delivering" | حالة محددة "shipping" ✅ |
| **الوضوح** | غير واضح متى بدأ السائق | واضح: السائق في الطريق الآن 🚚 |
| **التتبع** | صعب تتبع وقت بدء الرحلة | سجل دقيق في order_status_history |
| **التلقائية** | يدوي | تلقائي بالكامل ✅ |
| **تجربة المستخدم** | رسالة عامة | رسالة دقيقة ومطمئنة |

---

## 🔐 الأمان

جميع الدوال تستخدم `SECURITY DEFINER` مما يعني:
- ✅ تعمل بصلاحيات النظام
- ✅ لا تتطلب صلاحيات خاصة من المستخدم
- ✅ آمنة ومحمية من SQL injection

---

## 🐛 استكشاف الأخطاء

### المشكلة: الحالة لا تتغير تلقائياً

**الحل:**
```sql
-- تحقق من وجود trigger
SELECT trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'driver_waiting_list';

-- إذا لم يكن موجوداً، طبق migration مرة أخرى
```

### المشكلة: خطأ عند استدعاء الدالة

**الحل:**
```sql
-- تحقق من وجود الدالة
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'start_delivery_trip';

-- اختبر الدالة مباشرة
SELECT start_delivery_trip(
  'order-uuid'::uuid,
  'driver-uuid'::uuid,
  'اسم السائق'
);
```

---

## 📝 الملخص

✅ **تم إضافة:**
- حالة جديدة: `shipping` (في الطريق)
- تحديث تلقائي عند تعيين سائق
- دالة `start_delivery_trip` للتحكم اليدوي
- دالة `start_multi_delivery_trip` للطلبات المتعددة
- تسجيل كامل في order_status_history

✅ **النتيجة:**
- تجربة مستخدم أفضل
- وضوح أكثر في حالة الطلب
- تتبع دقيق لرحلة التوصيل
- سهولة في الصيانة والتطوير

---

**🚀 الآن، بمجرد أن يبدأ السائق رحلته، سيرى العميل "السائق في الطريق" تلقائياً!**
