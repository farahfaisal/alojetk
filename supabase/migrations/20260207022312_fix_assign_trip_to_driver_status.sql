/*
  # إصلاح دالة تعيين السائق - عدم تغيير الحالة تلقائياً

  ## المشكلة
  - دالة assign_trip_to_driver تغير حالة الطلب تلقائياً إلى 'delivering' عند تعيين السائق
  - هذا خطأ: يجب أن يبقى الطلب "قيد التحضير" حتى يبدأ السائق الرحلة

  ## الحل
  1. تعديل assign_trip_to_driver
     - حفظ معلومات السائق بدون تغيير الحالة
     - الحالة تتغير فقط عندما يبدأ السائق الرحلة

  2. تعديل assign_driver_to_order
     - نفس الإصلاح
*/

-- إصلاح دالة assign_trip_to_driver
CREATE OR REPLACE FUNCTION public.assign_trip_to_driver(
  p_order_id uuid,
  p_driver_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  v_driver_name text;
  v_order_exists boolean;
  v_current_status text;
BEGIN
  -- التحقق من وجود الطلب
  SELECT EXISTS(SELECT 1 FROM orders WHERE id = p_order_id) INTO v_order_exists;

  IF NOT v_order_exists THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- الحصول على الحالة الحالية للطلب
  SELECT status INTO v_current_status FROM orders WHERE id = p_order_id;

  -- التحقق من وجود السائق والحصول على اسمه
  SELECT name INTO v_driver_name
  FROM drivers
  WHERE id = p_driver_id;

  IF v_driver_name IS NULL THEN
    RAISE EXCEPTION 'Driver not found';
  END IF;

  -- حذف أي سجلات موجودة لهذا الطلب أولاً
  DELETE FROM driver_trips WHERE order_id = p_order_id;

  -- إضافة سجل جديد في driver_trips
  INSERT INTO driver_trips (
    order_id,
    driver_id,
    status,
    assigned_at
  ) VALUES (
    p_order_id,
    p_driver_id,
    'assigned',
    NOW()
  );

  -- تحديث الطلب (بدون تغيير الحالة)
  UPDATE orders 
  SET 
    driver_id = p_driver_id,
    driver_name = v_driver_name,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- إضافة سجل في تاريخ الحالات
  INSERT INTO order_status_history (
    order_id,
    status,
    note,
    created_by
  ) VALUES (
    p_order_id,
    v_current_status,
    'تم تعيين السائق - الطلب قيد التحضير',
    p_driver_id
  );

  -- حذف الطلب من قائمة الانتظار إذا كان موجوداً
  DELETE FROM driver_waiting_list WHERE order_id = p_order_id;

  -- بناء النتيجة
  result := json_build_object(
    'success', true,
    'driver_id', p_driver_id,
    'driver_name', v_driver_name,
    'order_id', p_order_id,
    'status', v_current_status
  );

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error assigning trip: %', SQLERRM;
END;
$$;

-- إصلاح دالة assign_driver_to_order
CREATE OR REPLACE FUNCTION public.assign_driver_to_order(
  p_order_id uuid, 
  p_driver_id uuid, 
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_driver_name TEXT;
  v_result JSONB;
  v_current_status TEXT;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Get current order status
  SELECT status INTO v_current_status FROM orders WHERE id = p_order_id;
  
  -- Get driver name
  SELECT name INTO v_driver_name
  FROM drivers
  WHERE id = p_driver_id;
  
  -- Begin transaction
  BEGIN
    -- Update order (بدون تغيير الحالة)
    UPDATE orders
    SET 
      driver_id = p_driver_id,
      driver_name = v_driver_name,
      updated_at = now()
    WHERE id = p_order_id;
    
    -- Add status history record
    INSERT INTO order_status_history (
      order_id,
      status,
      note,
      created_at,
      created_by
    ) VALUES (
      p_order_id,
      v_current_status,
      COALESCE(p_note, 'تم تعيين السائق ' || v_driver_name || ' - الطلب قيد التحضير'),
      now(),
      COALESCE(v_user_id, p_driver_id)
    );
    
    -- Get updated order
    SELECT jsonb_build_object(
      'id', o.id,
      'status', o.status,
      'driver_id', o.driver_id,
      'driver_name', d.name,
      'updated_at', o.updated_at,
      'success', true
    ) INTO v_result
    FROM orders o
    LEFT JOIN drivers d ON o.driver_id = d.id
    WHERE o.id = p_order_id;
    
    -- Return success
    RETURN v_result;
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback is automatic in case of error
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
      );
  END;
END;
$$;

-- تحديث التعليقات
COMMENT ON FUNCTION assign_trip_to_driver IS 'تعيين سائق للطلب (بدون تغيير حالة الطلب)';
COMMENT ON FUNCTION assign_driver_to_order IS 'تعيين سائق للطلب من لوحة التحكم (بدون تغيير الحالة)';
