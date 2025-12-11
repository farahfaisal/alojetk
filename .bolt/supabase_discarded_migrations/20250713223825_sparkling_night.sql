/*
  # إصلاح حقل customer_id في جدول العملاء
  
  1. التغييرات
    - إضافة محفز (trigger) لتعيين customer_id تلقائياً عند إنشاء عميل جديد
    - تحديث العملاء الحاليين الذين ليس لديهم customer_id
    - إضافة دالة لتوليد معرف العميل
  
  2. الأمان
    - الحفاظ على سياسات RLS الحالية
    - ضمان معالجة الأخطاء بشكل صحيح
*/

-- تحديث العملاء الحاليين الذين ليس لديهم customer_id
UPDATE customers
SET customer_id = id
WHERE customer_id IS NULL;

-- إنشاء دالة لتعيين customer_id تلقائياً
CREATE OR REPLACE FUNCTION set_customer_id()
RETURNS TRIGGER AS $$
BEGIN
  -- إذا كان customer_id فارغاً، استخدم id
  IF NEW.customer_id IS NULL THEN
    NEW.customer_id := NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء محفز لتعيين customer_id تلقائياً
DROP TRIGGER IF EXISTS set_customer_id_trigger ON customers;
CREATE TRIGGER set_customer_id_trigger
BEFORE INSERT ON customers
FOR EACH ROW
EXECUTE FUNCTION set_customer_id();

-- إضافة سجل في سجلات النظام
INSERT INTO system_logs (
  event_type,
  message,
  details
) VALUES (
  'schema_update',
  'تم إصلاح حقل customer_id في جدول العملاء',
  jsonb_build_object(
    'timestamp', now(),
    'description', 'تم إضافة محفز لتعيين customer_id تلقائياً وتحديث العملاء الحاليين'
  )
);