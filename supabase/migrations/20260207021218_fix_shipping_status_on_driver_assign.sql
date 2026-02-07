/*
  # إصلاح تغيير حالة الطلب التلقائي عند تعيين السائق

  ## المشكلة
  - عند تعيين سائق للطلب، يتغير الطلب تلقائياً إلى "في الطريق" (shipping)
  - هذا خطأ: يجب أن يبقى الطلب "قيد التحضير" (processing) حتى يبدأ السائق الرحلة فعلياً

  ## الحل
  1. تعديل الدالة update_delivery_status_with_driver
     - عند تعيين السائق: فقط حفظ معلومات السائق
     - لا تغير الحالة تلقائياً
     - الحالة تتغير فقط عند بدء السائق الرحلة (start_delivery_trip)

  2. النتيجة
     - تعيين سائق → يبقى الطلب "قيد التحضير" ✅
     - بدء الرحلة → يتغير إلى "في الطريق" 🚚
*/

-- تحديث الدالة: حفظ معلومات السائق فقط، بدون تغيير الحالة
CREATE OR REPLACE FUNCTION update_delivery_status_with_driver()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- عند تعيين سائق جديد للطلب
  IF NEW.driver_id IS NOT NULL AND (OLD.driver_id IS NULL OR OLD.driver_id <> NEW.driver_id) THEN

    -- تحديث معلومات السائق فقط (بدون تغيير الحالة)
    UPDATE orders
    SET
      driver_id = NEW.driver_id,
      driver_name = NEW.driver_name,
      updated_at = now()
    WHERE id = NEW.order_id;

    -- إنشاء سجل في تاريخ الحالات
    INSERT INTO order_status_history (
      order_id,
      status,
      note,
      created_by
    ) VALUES (
      NEW.order_id,
      (SELECT status FROM orders WHERE id = NEW.order_id),
      'تم تعيين السائق: ' || COALESCE(NEW.driver_name, 'غير معروف'),
      NEW.driver_id
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- تحديث تعليق الدالة
COMMENT ON FUNCTION update_delivery_status_with_driver IS 'حفظ معلومات السائق عند التعيين (بدون تغيير حالة الطلب)';
