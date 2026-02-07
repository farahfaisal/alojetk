# دليل بدء الرحلة يدويًا للسائق 🚚

## نظرة عامة

بعد تطبيق التعديل، لن يتحول الطلب تلقائيًا إلى حالة "في الطريق" عند تعيين السائق.
**السائق يجب أن يبدأ الرحلة يدويًا** حتى يتحول الطلب إلى "في الطريق".

---

## الدوال المتاحة

### 1. `start_delivery_trip` - بدء رحلة لطلب واحد

تستخدم لبدء رحلة توصيل لطلب واحد.

**المعاملات:**
- `p_order_id` (uuid) - معرف الطلب
- `p_driver_id` (uuid) - معرف السائق
- `p_driver_name` (text, اختياري) - اسم السائق

**مثال استخدام في JavaScript:**

```javascript
// باستخدام Supabase Client
const { data, error } = await supabase.rpc('start_delivery_trip', {
  p_order_id: 'order-uuid-here',
  p_driver_id: 'driver-uuid-here',
  p_driver_name: 'محمد أحمد'
});

if (error) {
  console.error('خطأ في بدء الرحلة:', error);
} else {
  console.log('نتيجة:', data);
  // { success: true, message: 'تم تغيير حالة الطلب إلى في الطريق', ... }
}
```

---

### 2. `start_multi_delivery_trip` - بدء رحلة لعدة طلبات

تستخدم لبدء رحلة توصيل لعدة طلبات معًا (رحلة واحدة تشمل عدة طلبات).

**المعاملات:**
- `p_order_ids` (uuid[]) - مصفوفة معرفات الطلبات
- `p_driver_id` (uuid) - معرف السائق
- `p_driver_name` (text, اختياري) - اسم السائق

**مثال استخدام في JavaScript:**

```javascript
// باستخدام Supabase Client
const orderIds = [
  'order-uuid-1',
  'order-uuid-2',
  'order-uuid-3'
];

const { data, error } = await supabase.rpc('start_multi_delivery_trip', {
  p_order_ids: orderIds,
  p_driver_id: 'driver-uuid-here',
  p_driver_name: 'محمد أحمد'
});

if (error) {
  console.error('خطأ في بدء الرحلة:', error);
} else {
  console.log('نتيجة:', data);
  // { success: true, updated_count: 3, failed_count: 0, total: 3 }
}
```

---

## مثال تطبيق عملي

### واجهة بسيطة للسائق لبدء الرحلة

```javascript
import { supabase } from './lib/supabase';
import { useState } from 'react';

function DriverOrderItem({ order, driverId, driverName }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(order.status);

  const handleStartTrip = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('start_delivery_trip', {
        p_order_id: order.id,
        p_driver_id: driverId,
        p_driver_name: driverName
      });

      if (error) throw error;

      if (data.success) {
        setStatus('shipping');
        alert('✅ تم بدء الرحلة! الطلب الآن في الطريق');
      } else {
        alert('⚠️ ' + data.message);
      }
    } catch (error) {
      console.error('خطأ:', error);
      alert('❌ حدث خطأ في بدء الرحلة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="order-card">
      <h3>طلب #{order.order_number}</h3>
      <p>الحالة: {status}</p>

      {status !== 'shipping' && status !== 'delivered' && (
        <button
          onClick={handleStartTrip}
          disabled={loading}
          className="btn-start-trip"
        >
          {loading ? '⏳ جاري البدء...' : '🚚 بدء الرحلة'}
        </button>
      )}
    </div>
  );
}
```

---

## متى يمكن بدء الرحلة؟

الدالة تسمح ببدء الرحلة عندما يكون الطلب في إحدى الحالات التالية:
- `pending` - في انتظار الموافقة
- `processing` - جاري التحضير
- `ready` - جاهز للتوصيل
- `delivering` - (حالة قديمة)

**لن تعمل الدالة إذا كان الطلب:**
- `shipping` - (بالفعل في الطريق)
- `delivered` - (تم التوصيل)
- `completed` - (مكتمل)
- `cancelled` - (ملغي)

---

## التغييرات في قاعدة البيانات

عند بدء الرحلة يدويًا، سيحدث التالي تلقائيًا:

1. ✅ تحديث حالة الطلب إلى `shipping`
2. ✅ حفظ معرف واسم السائق في جدول الطلبات
3. ✅ إنشاء سجل في `order_status_history` مع ملاحظة "السائق بدأ رحلة التوصيل"
4. ✅ تحديث `updated_at` للطلب

---

## الفرق بين الوضع السابق والجديد

### الوضع السابق (التحديث التلقائي):
```
1. تعيين سائق للطلب
   ↓
2. التحديث التلقائي يغير الحالة إلى "في الطريق"
   ↓
3. الطلب يظهر في الطريق فورًا ❌
```

### الوضع الجديد (يدوي):
```
1. تعيين سائق للطلب
   ↓
2. السائق يضغط زر "بدء الرحلة" يدويًا
   ↓
3. الطلب يتحول إلى "في الطريق" ✅
```

---

## ملاحظات مهمة

- ⚠️ تأكد من تطبيق SQL التعديل أولاً باستخدام `apply-disable-auto-shipping.html`
- 🔐 الدوال تستخدم `SECURITY DEFINER` للسماح بالتحديث التلقائي
- 📝 جميع التغييرات تُسجل في `order_status_history`
- 🔄 التغييرات تظهر فورًا للعميل عبر real-time subscription

---

## التطبيق في تطبيق السائق

إذا كان لديك تطبيق منفصل للسائقين، أضف زر "بدء الرحلة" في:

1. **صفحة تفاصيل الطلب**
2. **قائمة الطلبات المعينة للسائق**
3. **شاشة الملاحة/الخريطة**

والزر يظهر فقط عندما:
- السائق معين للطلب
- الطلب ليس في حالة "في الطريق" أو "تم التوصيل"

---

## الدعم

إذا واجهت أي مشكلة:
1. تحقق من أن SQL التعديل تم تطبيقه
2. تحقق من صلاحيات السائق في قاعدة البيانات
3. راجع logs في `order_status_history`
