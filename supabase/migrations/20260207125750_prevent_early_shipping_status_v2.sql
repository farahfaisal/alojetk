/*
  # منع تغيير حالة الطلب قبل بدء السائق

  1. التغييرات
    - إضافة trigger للتحقق من حالة الرحلة قبل السماح بتغيير حالة الطلب
    - منع أي تحديث لحالة الطلب إلى "shipping", "on_the_way", "picked_up" 
      إذا لم يكن السائق قد بدأ الرحلة فعلياً
    - السماح فقط بالحالات التالية:
      * pending -> processing (عند تأكيد الطلب)
      * processing -> processing (لا تغيير)
      * أي حالة -> cancelled (الإلغاء مسموح دائماً)
      * shipping/on_the_way/picked_up فقط إذا كان driver_trips.status = 'in_progress' أو 'started'

  2. الأمان
    - حماية صارمة ضد أي محاولة لتغيير الحالة قبل بدء السائق
    - رسائل خطأ واضحة للمستخدم
*/

-- حذف الـ trigger القديم إن وجد
DROP TRIGGER IF EXISTS prevent_premature_shipping_status ON orders;
DROP FUNCTION IF EXISTS check_driver_trip_before_shipping_status();

-- إنشاء دالة جديدة للتحقق الصارم
CREATE OR REPLACE FUNCTION check_driver_trip_before_shipping_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trip_status text;
  v_has_driver boolean;
BEGIN
  -- التحقق من وجود سائق
  v_has_driver := NEW.driver_id IS NOT NULL;
  
  -- إذا تم تغيير الحالة إلى shipping, on_the_way, أو picked_up
  IF NEW.status IN ('shipping', 'on_the_way', 'picked_up') AND 
     (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    
    -- يجب أن يكون هناك سائق
    IF NOT v_has_driver THEN
      RAISE EXCEPTION 'لا يمكن تغيير حالة الطلب إلى "%" بدون سائق', NEW.status;
    END IF;
    
    -- التحقق من حالة رحلة السائق
    SELECT status INTO v_trip_status
    FROM driver_trips
    WHERE order_id = NEW.id 
      AND driver_id = NEW.driver_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- إذا لم توجد رحلة، منع التحديث
    IF v_trip_status IS NULL THEN
      RAISE EXCEPTION 'لا يمكن تغيير حالة الطلب إلى "%" قبل أن يبدأ السائق الرحلة. الرجاء انتظار السائق', NEW.status;
    END IF;
    
    -- السماح فقط إذا كانت الرحلة في حالة in_progress أو started أو picked_up
    IF v_trip_status NOT IN ('in_progress', 'started', 'picked_up') THEN
      RAISE EXCEPTION 'لا يمكن تغيير حالة الطلب إلى "%" قبل أن يبدأ السائق الرحلة. حالة الرحلة الحالية: "%"', NEW.status, v_trip_status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إضافة الـ trigger
CREATE TRIGGER prevent_premature_shipping_status
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION check_driver_trip_before_shipping_status();

-- حذف الدالة القديمة
DROP FUNCTION IF EXISTS assign_trip_to_driver(uuid, uuid);

-- إعادة إنشاء دالة assign_trip_to_driver بمعاملات صحيحة
CREATE OR REPLACE FUNCTION assign_trip_to_driver(
  p_order_id uuid,
  p_driver_id uuid,
  p_driver_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_order_status text;
  v_actual_driver_name text;
BEGIN
  -- الحصول على حالة الطلب
  SELECT status INTO v_order_status
  FROM orders
  WHERE id = p_order_id;
  
  -- إذا لم يتم تمرير اسم السائق، نحصل عليه من جدول السائقين
  IF p_driver_name IS NULL OR p_driver_name = '' THEN
    SELECT COALESCE(full_name, phone) INTO v_actual_driver_name
    FROM drivers
    WHERE id = p_driver_id;
  ELSE
    v_actual_driver_name := p_driver_name;
  END IF;
  
  -- تحديث بيانات السائق فقط - بدون تغيير الحالة
  UPDATE orders
  SET 
    driver_id = p_driver_id,
    driver_name = v_actual_driver_name,
    updated_at = now()
  WHERE id = p_order_id;
  
  -- إنشاء أو تحديث رحلة السائق بحالة "assigned"
  INSERT INTO driver_trips (order_id, driver_id, status)
  VALUES (p_order_id, p_driver_id, 'assigned')
  ON CONFLICT (order_id, driver_id) 
  DO UPDATE SET 
    status = 'assigned',
    updated_at = now();
  
  -- إضافة سجل في order_status_history
  INSERT INTO order_status_history (order_id, status, note, created_by)
  VALUES (
    p_order_id, 
    v_order_status,
    'تم تعيين السائق: ' || COALESCE(v_actual_driver_name, 'غير معروف'),
    p_driver_id
  );
  
  v_result := json_build_object(
    'success', true,
    'message', 'تم تعيين السائق بنجاح - الطلب سيبقى في حالته الحالية حتى يبدأ السائق الرحلة',
    'order_status', v_order_status
  );
  
  RETURN v_result;
END;
$$;

-- إنشاء دالة لبدء الرحلة (يجب استخدامها من تطبيق السائق)
CREATE OR REPLACE FUNCTION start_driver_trip(
  p_order_id uuid,
  p_driver_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_trip_status text;
BEGIN
  -- التحقق من وجود الرحلة
  SELECT status INTO v_trip_status
  FROM driver_trips
  WHERE order_id = p_order_id AND driver_id = p_driver_id;
  
  IF v_trip_status IS NULL THEN
    RAISE EXCEPTION 'لم يتم العثور على الرحلة';
  END IF;
  
  IF v_trip_status NOT IN ('assigned', 'accepted') THEN
    RAISE EXCEPTION 'لا يمكن بدء الرحلة - الحالة الحالية: %', v_trip_status;
  END IF;
  
  -- تحديث حالة الرحلة
  UPDATE driver_trips
  SET 
    status = 'in_progress',
    started_at = now(),
    updated_at = now()
  WHERE order_id = p_order_id AND driver_id = p_driver_id;
  
  -- الآن يمكن تحديث حالة الطلب
  UPDATE orders
  SET 
    status = 'shipping',
    updated_at = now()
  WHERE id = p_order_id;
  
  -- إضافة سجل
  INSERT INTO order_status_history (order_id, status, note, created_by)
  VALUES (
    p_order_id,
    'shipping',
    'بدأ السائق الرحلة',
    p_driver_id
  );
  
  v_result := json_build_object(
    'success', true,
    'message', 'تم بدء الرحلة بنجاح',
    'trip_status', 'in_progress',
    'order_status', 'shipping'
  );
  
  RETURN v_result;
END;
$$;

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION assign_trip_to_driver TO authenticated;
GRANT EXECUTE ON FUNCTION start_driver_trip TO authenticated;
