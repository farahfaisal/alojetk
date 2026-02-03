/*
  # إنشاء جدول حالات الشحن (Shipping Statuses)

  ## نظرة عامة
  جدول مركزي لتخزين معلومات حالات الطلبات والشحن مع دعم العربية والإنجليزية

  ## الجداول الجديدة

  ### `shipping_statuses`
  - `status_key` (text, primary key) - مفتاح الحالة الفريد
  - `ar_title` (text) - العنوان بالعربية
  - `en_title` (text) - العنوان بالإنجليزية
  - `ar_description` (text) - الوصف بالعربية
  - `en_description` (text) - الوصف بالإنجليزية
  - `order_sequence` (integer) - ترتيب الحالة في رحلة الطلب
  - `icon_name` (text) - اسم الأيقونة من lucide-react
  - `color` (text) - لون الحالة
  - `is_active` (boolean) - هل الحالة نشطة
  - `created_at` (timestamptz) - تاريخ الإنشاء
  - `updated_at` (timestamptz) - تاريخ آخر تحديث

  ## البيانات الأساسية
  - pending: في انتظار الموافقة
  - accepted: تم قبول الطلب
  - processing: جاري التحضير
  - ready: جاهز للتوصيل
  - shipping: في الطريق (السائق قادم) ✅
  - delivering: قيد التوصيل
  - completed: تم التوصيل
  - cancelled: ملغي
  - rejected: مرفوض

  ## الأمان
  - RLS مفعل على الجدول
  - الجميع يمكنهم القراءة (البيانات عامة)
  - الإدارة فقط يمكنها التعديل
*/

-- إنشاء الجدول
CREATE TABLE IF NOT EXISTS shipping_statuses (
  status_key text PRIMARY KEY,
  ar_title text NOT NULL,
  en_title text NOT NULL,
  ar_description text,
  en_description text,
  order_sequence integer NOT NULL DEFAULT 0,
  icon_name text,
  color text DEFAULT 'gray',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE shipping_statuses ENABLE ROW LEVEL SECURITY;

-- Policy: الجميع يمكنهم القراءة
CREATE POLICY "Anyone can view shipping statuses"
  ON shipping_statuses
  FOR SELECT
  TO public
  USING (is_active = true);

-- Policy: الإدارة فقط يمكنها الإضافة
CREATE POLICY "Admins can insert shipping statuses"
  ON shipping_statuses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Policy: الإدارة فقط يمكنها التحديث
CREATE POLICY "Admins can update shipping statuses"
  ON shipping_statuses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- إدراج البيانات الأساسية
INSERT INTO shipping_statuses (status_key, ar_title, en_title, ar_description, en_description, order_sequence, icon_name, color)
VALUES
  ('pending', 'في انتظار الموافقة', 'Pending Approval', 'الطلب معلق وفي انتظار موافقة المتجر', 'Order is pending store approval', 1, 'Clock', 'gray'),
  ('accepted', 'تم قبول الطلب', 'Order Accepted', 'المتجر قبل طلبك وسيبدأ التحضير قريباً', 'Store accepted your order and will start preparing soon', 2, 'CheckCircle', 'green'),
  ('processing', 'جاري التحضير', 'Processing', 'المتجر يحضر طلبك الآن', 'Store is preparing your order now', 3, 'Package', 'blue'),
  ('ready', 'جاهز للتوصيل', 'Ready for Delivery', 'طلبك جاهز وفي انتظار السائق', 'Your order is ready and waiting for driver', 4, 'PackageCheck', 'cyan'),
  ('shipping', 'في الطريق', 'On The Way', 'السائق انطلق وهو قادم إليك', 'Driver has started and is coming to you', 5, 'Truck', 'orange'),
  ('delivering', 'قيد التوصيل', 'Out for Delivery', 'طلبك في طريقه إليك', 'Your order is on its way to you', 6, 'Navigation', 'purple'),
  ('completed', 'تم التوصيل', 'Delivered', 'تم توصيل طلبك بنجاح', 'Your order has been delivered successfully', 7, 'CheckCircle2', 'green'),
  ('cancelled', 'ملغي', 'Cancelled', 'تم إلغاء الطلب', 'Order has been cancelled', 99, 'XCircle', 'red'),
  ('rejected', 'مرفوض', 'Rejected', 'المتجر رفض الطلب', 'Store rejected the order', 98, 'AlertCircle', 'red')
ON CONFLICT (status_key) DO UPDATE SET
  ar_title = EXCLUDED.ar_title,
  en_title = EXCLUDED.en_title,
  ar_description = EXCLUDED.ar_description,
  en_description = EXCLUDED.en_description,
  order_sequence = EXCLUDED.order_sequence,
  icon_name = EXCLUDED.icon_name,
  color = EXCLUDED.color,
  updated_at = now();

-- إنشاء index للأداء
CREATE INDEX IF NOT EXISTS idx_shipping_statuses_sequence
  ON shipping_statuses(order_sequence)
  WHERE is_active = true;

-- دالة للحصول على معلومات الحالة بالعربية
CREATE OR REPLACE FUNCTION get_status_info(p_status_key text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'status_key', status_key,
    'ar_title', ar_title,
    'en_title', en_title,
    'ar_description', ar_description,
    'en_description', en_description,
    'icon_name', icon_name,
    'color', color,
    'order_sequence', order_sequence
  )
  INTO v_result
  FROM shipping_statuses
  WHERE status_key = p_status_key
    AND is_active = true;

  RETURN v_result;
END;
$$;

-- دالة للحصول على الحالة التالية
CREATE OR REPLACE FUNCTION get_next_status(p_current_status text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_sequence integer;
  v_next_status text;
BEGIN
  -- الحصول على ترتيب الحالة الحالية
  SELECT order_sequence INTO v_current_sequence
  FROM shipping_statuses
  WHERE status_key = p_current_status
    AND is_active = true;

  -- إذا لم تكن الحالة موجودة
  IF v_current_sequence IS NULL THEN
    RETURN NULL;
  END IF;

  -- الحصول على الحالة التالية
  SELECT status_key INTO v_next_status
  FROM shipping_statuses
  WHERE order_sequence > v_current_sequence
    AND is_active = true
    AND order_sequence < 90  -- استبعاد حالات cancelled و rejected
  ORDER BY order_sequence ASC
  LIMIT 1;

  RETURN v_next_status;
END;
$$;

-- trigger لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_shipping_statuses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shipping_statuses_updated_at_trigger ON shipping_statuses;
CREATE TRIGGER shipping_statuses_updated_at_trigger
  BEFORE UPDATE ON shipping_statuses
  FOR EACH ROW
  EXECUTE FUNCTION update_shipping_statuses_updated_at();

-- تعليقات توضيحية
COMMENT ON TABLE shipping_statuses IS 'جدول حالات الشحن والطلبات مع دعم متعدد اللغات';
COMMENT ON FUNCTION get_status_info IS 'الحصول على معلومات حالة معينة';
COMMENT ON FUNCTION get_next_status IS 'الحصول على الحالة التالية في رحلة الطلب';
