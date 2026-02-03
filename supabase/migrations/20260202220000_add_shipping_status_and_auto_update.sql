/*
  # إضافة حالة "في الطريق" وتحديث تلقائي عند بدء رحلة السائق

  ## التغييرات

  1. تحديث constraint للطلبات لدعم حالة 'shipping'
     - إضافة 'shipping' كحالة مسموحة في جدول orders

  2. تحديث الدالة الموجودة
     - تعديل `update_delivery_status_with_driver` لاستخدام 'shipping' بدلاً من 'delivering'

  3. إنشاء دوال جديدة
     - `start_delivery_trip` - لبدء رحلة توصيل لطلب واحد
     - `start_multi_delivery_trip` - لبدء رحلة توصيل لعدة طلبات

  4. الأمان
     - استخدام SECURITY DEFINER للسماح بالتحديث التلقائي
     - الحفاظ على سجل التغييرات في order_status_history

  ## النتيجة

  - عند تعيين سائق للطلب → الحالة تتغير تلقائياً إلى 'shipping' 🚚
  - يتم إنشاء سجل في order_status_history
  - يحفظ اسم ومعرف السائق في الطلب
*/

-- الخطوة 1: تحديث constraint لدعم 'shipping'
DO $$
BEGIN
  -- حذف constraint القديم إن وجد
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_status_check'
    AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_status_check;
  END IF;

  -- إضافة constraint جديد يدعم 'shipping'
  ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'processing', 'shipping', 'delivering', 'completed', 'cancelled'));
END $$;

-- الخطوة 2: تحديث الدالة لاستخدام 'shipping' بدلاً من 'delivering'
CREATE OR REPLACE FUNCTION update_delivery_status_with_driver()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- عند تعيين سائق جديد للطلب
  IF NEW.driver_id IS NOT NULL AND (OLD.driver_id IS NULL OR OLD.driver_id <> NEW.driver_id) THEN

    -- تحديث معلومات الطلب
    UPDATE orders
    SET
      driver_id = NEW.driver_id,
      driver_name = NEW.driver_name,
      status = 'shipping',
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
      'shipping',
      'السائق ' || COALESCE(NEW.driver_name, 'غير معروف') || ' في الطريق إليك',
      NEW.driver_id
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- الخطوة 3: التأكد من وجود trigger
DROP TRIGGER IF EXISTS update_order_with_driver_trigger ON driver_waiting_list;
CREATE TRIGGER update_order_with_driver_trigger
  AFTER UPDATE OF driver_id ON driver_waiting_list
  FOR EACH ROW
  WHEN (NEW.driver_id IS NOT NULL)
  EXECUTE FUNCTION update_delivery_status_with_driver();

-- الخطوة 4: دالة لبدء الرحلة يدوياً
CREATE OR REPLACE FUNCTION start_delivery_trip(
  p_order_id uuid,
  p_driver_id uuid,
  p_driver_name text DEFAULT NULL
)
RETURNS json
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_current_status text;
BEGIN
  -- التحقق من حالة الطلب الحالية
  SELECT status INTO v_current_status
  FROM orders
  WHERE id = p_order_id;

  -- إذا كان الطلب في حالة مناسبة للبدء
  IF v_current_status IN ('pending', 'processing', 'ready', 'delivering') THEN

    -- تحديث حالة الطلب
    UPDATE orders
    SET
      status = 'shipping',
      driver_id = p_driver_id,
      driver_name = COALESCE(p_driver_name, driver_name),
      updated_at = now()
    WHERE id = p_order_id;

    -- إضافة سجل في التاريخ
    INSERT INTO order_status_history (
      order_id,
      status,
      note,
      created_by
    ) VALUES (
      p_order_id,
      'shipping',
      'السائق بدأ رحلة التوصيل',
      p_driver_id
    );

    v_result := json_build_object(
      'success', true,
      'message', 'تم تغيير حالة الطلب إلى في الطريق',
      'order_id', p_order_id,
      'new_status', 'shipping'
    );
  ELSE
    v_result := json_build_object(
      'success', false,
      'message', 'لا يمكن بدء الرحلة من الحالة الحالية: ' || v_current_status,
      'current_status', v_current_status
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- الخطوة 5: دالة لتحديث حالة عدة طلبات معاً
CREATE OR REPLACE FUNCTION start_multi_delivery_trip(
  p_order_ids uuid[],
  p_driver_id uuid,
  p_driver_name text DEFAULT NULL
)
RETURNS json
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_updated_count integer := 0;
  v_failed_count integer := 0;
BEGIN
  -- تحديث كل طلب في القائمة
  FOREACH v_order_id IN ARRAY p_order_ids
  LOOP
    BEGIN
      UPDATE orders
      SET
        status = 'shipping',
        driver_id = p_driver_id,
        driver_name = COALESCE(p_driver_name, driver_name),
        updated_at = now()
      WHERE id = v_order_id
        AND status IN ('pending', 'processing', 'ready', 'delivering');

      IF FOUND THEN
        -- إضافة سجل في التاريخ
        INSERT INTO order_status_history (
          order_id,
          status,
          note,
          created_by
        ) VALUES (
          v_order_id,
          'shipping',
          'السائق بدأ رحلة توصيل متعددة',
          p_driver_id
        );

        v_updated_count := v_updated_count + 1;
      ELSE
        v_failed_count := v_failed_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed_count := v_failed_count + 1;
    END;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'failed_count', v_failed_count,
    'total', array_length(p_order_ids, 1)
  );
END;
$$ LANGUAGE plpgsql;

-- الخطوة 6: إنشاء index للأداء
CREATE INDEX IF NOT EXISTS idx_orders_driver_status
ON orders(driver_id, status)
WHERE status = 'shipping';

-- الخطوة 7: تعليقات توضيحية
COMMENT ON FUNCTION start_delivery_trip IS 'تحديث حالة الطلب إلى في الطريق عند بدء السائق رحلة التوصيل';
COMMENT ON FUNCTION start_multi_delivery_trip IS 'تحديث حالة عدة طلبات معاً عند بدء رحلة توصيل متعددة';
COMMENT ON FUNCTION update_delivery_status_with_driver IS 'تحديث حالة الطلب تلقائياً عند تعيين السائق';
