# 📦 جدول حالات الشحن (Shipping Statuses)

## نظرة عامة

جدول مركزي لتخزين وإدارة جميع حالات الطلبات مع دعم كامل للعربية والإنجليزية.

---

## 🎯 الحالات المتوفرة

| status_key | العربية | الإنجليزية | الأيقونة | اللون |
|------------|---------|-------------|----------|-------|
| `pending` | في انتظار الموافقة | Pending Approval | Clock | gray |
| `accepted` | تم قبول الطلب | Order Accepted | CheckCircle | green |
| `processing` | جاري التحضير | Processing | Package | blue |
| `ready` | جاهز للتوصيل | Ready for Delivery | PackageCheck | cyan |
| **`shipping`** | **في الطريق** | **On The Way** | **Truck** | **orange** |
| `delivering` | قيد التوصيل | Out for Delivery | Navigation | purple |
| `completed` | تم التوصيل | Delivered | CheckCircle2 | green |
| `cancelled` | ملغي | Cancelled | XCircle | red |
| `rejected` | مرفوض | Rejected | AlertCircle | red |

---

## 🚀 التطبيق السريع

### الخطوة 1: تطبيق SQL

افتح [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor:

```sql
-- انسخ والصق محتوى الملف التالي:
-- create-shipping-statuses-table.sql
```

### الخطوة 2: التحقق من التطبيق

```sql
-- عرض جميع الحالات
SELECT status_key, ar_title, en_title, order_sequence
FROM shipping_statuses
ORDER BY order_sequence;

-- النتيجة المتوقعة: 9 صفوف
```

---

## 💻 الاستخدام في التطبيق

### 1. استيراد المكتبة

```typescript
import {
  getAllShippingStatuses,
  getStatusInfo,
  getStatusInfoSync,
  getNextStatus,
  getColorClasses,
  DEFAULT_STATUSES
} from '@/lib/shipping-statuses';
```

### 2. الحصول على جميع الحالات

```typescript
// الطريقة الأولى: من قاعدة البيانات (async)
const statuses = await getAllShippingStatuses();
console.log(statuses);
// [{ status_key: 'pending', ar_title: '...', ... }, ...]

// الطريقة الثانية: من الثوابت (sync)
const defaultStatuses = DEFAULT_STATUSES;
console.log(defaultStatuses.shipping);
// { ar_title: 'في الطريق', ... }
```

### 3. معلومات حالة معينة

```typescript
// من قاعدة البيانات
const info = await getStatusInfo('shipping');
console.log(info?.ar_title); // "في الطريق"
console.log(info?.ar_description); // "السائق انطلق وهو قادم إليك"

// أو استخدم sync version
const infoSync = getStatusInfoSync('shipping');
console.log(infoSync.ar_title); // "في الطريق"
```

### 4. الحالة التالية

```typescript
const nextStatus = await getNextStatus('processing');
console.log(nextStatus); // "ready"

const nextAfterReady = await getNextStatus('ready');
console.log(nextAfterReady); // "shipping"
```

### 5. استخدام الألوان في UI

```typescript
const colors = getColorClasses('orange');
// {
//   bg: 'bg-orange-100',
//   text: 'text-orange-800',
//   border: 'border-orange-300'
// }

// في JSX
<div className={`${colors.bg} ${colors.text} ${colors.border} p-4 rounded-lg border`}>
  في الطريق
</div>
```

---

## 🎨 أمثلة عملية

### مثال 1: عرض حالة الطلب

```typescript
import { getStatusInfoSync, getColorClasses } from '@/lib/shipping-statuses';
import * as Icons from 'lucide-react';

function OrderStatus({ status }: { status: string }) {
  const statusInfo = getStatusInfoSync(status);
  const colors = getColorClasses(statusInfo.color);
  const Icon = Icons[statusInfo.icon_name as keyof typeof Icons] || Icons.Package;

  return (
    <div className={`${colors.bg} ${colors.border} border rounded-lg p-4`}>
      <div className="flex items-center gap-3">
        <Icon className={colors.text} size={24} />
        <div>
          <p className={`font-bold ${colors.text}`}>
            {statusInfo.ar_title}
          </p>
          <p className={`text-sm ${colors.text} opacity-80`}>
            {statusInfo.ar_description}
          </p>
        </div>
      </div>
    </div>
  );
}

// الاستخدام
<OrderStatus status="shipping" />
```

### مثال 2: قائمة تتبع الطلب

```typescript
import { getAllShippingStatuses } from '@/lib/shipping-statuses';

function OrderTracking({ currentStatus }: { currentStatus: string }) {
  const [statuses, setStatuses] = useState([]);

  useEffect(() => {
    getAllShippingStatuses().then(data => {
      // تصفية الحالات العادية فقط (استبعاد cancelled/rejected)
      const normalStatuses = data.filter(s => s.order_sequence < 90);
      setStatuses(normalStatuses);
    });
  }, []);

  return (
    <div className="space-y-4">
      {statuses.map((status) => {
        const isActive = status.status_key === currentStatus;
        const isPassed = status.order_sequence < getCurrentSequence(currentStatus);

        return (
          <div key={status.status_key} className={`
            flex items-center gap-3 p-3 rounded-lg
            ${isActive ? 'bg-orange-100 border-2 border-orange-500' : ''}
            ${isPassed ? 'bg-green-50' : 'bg-gray-50'}
          `}>
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center
              ${isActive ? 'bg-orange-500 text-white' : ''}
              ${isPassed ? 'bg-green-500 text-white' : 'bg-gray-300'}
            `}>
              {isPassed ? '✓' : status.order_sequence}
            </div>
            <div className="flex-1">
              <p className="font-semibold">{status.ar_title}</p>
              <p className="text-sm text-gray-600">{status.ar_description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### مثال 3: تحديث حالة الطلب

```typescript
import { supabase } from '@/lib/supabase';
import { getNextStatus } from '@/lib/shipping-statuses';

async function moveToNextStatus(orderId: string) {
  // 1. الحصول على الحالة الحالية
  const { data: order } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single();

  if (!order) return;

  // 2. الحصول على الحالة التالية
  const nextStatus = await getNextStatus(order.status);

  if (!nextStatus) {
    console.log('لا توجد حالة تالية');
    return;
  }

  // 3. تحديث الطلب
  const { error } = await supabase
    .from('orders')
    .update({ status: nextStatus })
    .eq('id', orderId);

  if (error) {
    console.error('خطأ في تحديث الحالة:', error);
  } else {
    console.log(`تم التحديث من ${order.status} إلى ${nextStatus}`);
  }
}
```

---

## 📊 الدوال المتاحة في SQL

### 1. `get_status_info(status_key)`

```sql
-- الحصول على معلومات حالة
SELECT * FROM get_status_info('shipping');

-- النتيجة:
{
  "status_key": "shipping",
  "ar_title": "في الطريق",
  "en_title": "On The Way",
  "ar_description": "السائق انطلق وهو قادم إليك",
  "en_description": "Driver has started and is coming to you",
  "icon_name": "Truck",
  "color": "orange",
  "order_sequence": 5
}
```

### 2. `get_next_status(current_status)`

```sql
-- الحصول على الحالة التالية
SELECT get_next_status('processing'); -- 'ready'
SELECT get_next_status('ready');      -- 'shipping'
SELECT get_next_status('shipping');   -- 'delivering'
SELECT get_next_status('completed');  -- NULL (لا توجد حالة بعد completed)
```

---

## 🔧 التخصيص والإضافة

### إضافة حالة جديدة

```sql
INSERT INTO shipping_statuses (
  status_key,
  ar_title,
  en_title,
  ar_description,
  en_description,
  order_sequence,
  icon_name,
  color
) VALUES (
  'picked_up',
  'تم الاستلام من المتجر',
  'Picked Up from Store',
  'السائق استلم الطلب من المتجر',
  'Driver picked up the order from store',
  4.5,
  'PackageCheck',
  'teal'
);
```

### تعديل حالة موجودة

```sql
UPDATE shipping_statuses
SET
  ar_description = 'وصف جديد',
  icon_name = 'NewIcon',
  color = 'blue'
WHERE status_key = 'shipping';
```

### إلغاء تفعيل حالة

```sql
UPDATE shipping_statuses
SET is_active = false
WHERE status_key = 'old_status';
```

---

## 🛡️ الأمان (RLS)

- **القراءة**: الجميع يمكنهم قراءة الحالات النشطة
- **الإضافة/التعديل**: الإدارة فقط

```sql
-- التحقق من policies
SELECT * FROM pg_policies
WHERE tablename = 'shipping_statuses';
```

---

## 📱 التكامل مع المكونات الموجودة

### تحديث OrderTrackingPage

```typescript
// في src/components/OrderTrackingPage.tsx
import { getStatusInfoSync, getColorClasses } from '@/lib/shipping-statuses';

const statusInfo = getStatusInfoSync(order.status);
const colors = getColorClasses(statusInfo.color);

// استخدم statusInfo.ar_title بدلاً من hardcoded text
<h3>{statusInfo.ar_title}</h3>
<p>{statusInfo.ar_description}</p>
```

### تحديث OrdersPage

```typescript
// عرض حالة الطلب بالألوان
import { getStatusInfoSync, getColorClasses } from '@/lib/shipping-statuses';

{orders.map(order => {
  const statusInfo = getStatusInfoSync(order.status);
  const colors = getColorClasses(statusInfo.color);

  return (
    <div className={`${colors.bg} p-2 rounded`}>
      <span className={colors.text}>{statusInfo.ar_title}</span>
    </div>
  );
})}
```

---

## ✅ الفوائد

| الميزة | قبل | بعد |
|-------|-----|-----|
| **المرونة** | hardcoded في الكود | مخزن في قاعدة البيانات ✅ |
| **التعديل** | يحتاج تغيير الكود | تعديل SQL فقط ✅ |
| **متعدد اللغات** | عربي فقط | عربي + إنجليزي ✅ |
| **الترتيب** | غير منظم | order_sequence واضح ✅ |
| **الألوان** | مكرر في كل ملف | مركزي ومنظم ✅ |

---

## 🐛 استكشاف الأخطاء

### المشكلة: الجدول غير موجود

```sql
-- التحقق من وجود الجدول
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'shipping_statuses'
);

-- إذا false، طبق create-shipping-statuses-table.sql
```

### المشكلة: خطأ في RLS

```sql
-- تعطيل RLS مؤقتاً للاختبار
ALTER TABLE shipping_statuses DISABLE ROW LEVEL SECURITY;

-- ثم اختبر
SELECT * FROM shipping_statuses;

-- إعادة تفعيل RLS
ALTER TABLE shipping_statuses ENABLE ROW LEVEL SECURITY;
```

### المشكلة: البيانات فارغة

```sql
-- إعادة إدراج البيانات
-- انسخ الـ INSERT من create-shipping-statuses-table.sql
```

---

## 📝 الملخص

✅ **تم الإنشاء:**
- جدول `shipping_statuses` مع 9 حالات
- دوال SQL: `get_status_info`, `get_next_status`
- مكتبة TypeScript: `src/lib/shipping-statuses.ts`
- RLS policies للأمان
- Trigger للتحديث التلقائي

✅ **كيفية الاستخدام:**
1. طبق SQL من `create-shipping-statuses-table.sql`
2. استورد الدوال من `@/lib/shipping-statuses`
3. استخدم في المكونات

---

**🎉 الآن لديك نظام متكامل لإدارة حالات الشحن!**
