/*
  # منع تغيير حالة الطلب بشكل خاطئ

  ## المشكلة
  - عند تعيين سائق، يتم تغيير حالة الطلب إلى 'picked_up' أو 'shipping' تلقائياً
  - هذا خطأ: يجب أن يبقى الطلب 'processing' حتى يبدأ السائق الرحلة فعلياً

  ## الحل
  1. إنشاء دالة للتحقق من صحة تغيير الحالة
  2. منع التغيير إلى حالات معينة بدون شروط
     - 'picked_up' يتطلب أن يكون driver_trips.status = 'picked_up'
     - 'shipping' يتطلب أن يكون driver_trips.status = 'in_progress' أو 'started'
  
  3. السماح بالتغيير فقط من:
     - admin panel مع صلاحيات
     - driver app عند بدء الرحلة فعلياً
*/

-- دالة للتحقق من صحة تغيير حالة الطلب
CREATE OR REPLACE FUNCTION validate_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_driver_trip_status text;
BEGIN
  -- السماح بالتغيير إذا كانت الحالة الجديدة ليست من الحالات المقيدة
  IF NEW.status NOT IN ('picked_up', 'shipping', 'on_the_way') THEN
    RETURN NEW;
  END IF;

  -- إذا لم يكن هناك سائق، لا نسمح بتغيير إلى هذه الحالات
  IF NEW.driver_id IS NULL THEN
    RAISE EXCEPTION 'لا يمكن تغيير حالة الطلب إلى % بدون تعيين سائق', NEW.status;
  END IF;

  -- التحقق من حالة رحلة السائق
  SELECT status INTO v_driver_trip_status
  FROM driver_trips
  WHERE order_id = NEW.id
    AND driver_id = NEW.driver_id
  ORDER BY assigned_at DESC
  LIMIT 1;

  -- إذا كانت الحالة الجديدة 'picked_up' أو 'shipping'
  IF NEW.status IN ('picked_up', 'shipping', 'on_the_way') THEN
    -- يجب أن تكون رحلة السائق قد بدأت
    IF v_driver_trip_status IS NULL OR v_driver_trip_status NOT IN ('in_progress', 'started', 'picked_up') THEN
      -- إذا كان التغيير من 'processing'، نبقيه كما هو
      IF OLD.status = 'processing' THEN
        NEW.status := OLD.status;
        RAISE NOTICE 'تم منع تغيير الحالة: السائق لم يبدأ الرحلة بعد';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- إضافة trigger للتحقق من صحة تغيير الحالة
DROP TRIGGER IF EXISTS validate_status_change_trigger ON orders;
CREATE TRIGGER validate_status_change_trigger
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION validate_order_status_change();

COMMENT ON FUNCTION validate_order_status_change IS 'التحقق من صحة تغيير حالة الطلب ومنع التغييرات الخاطئة';
