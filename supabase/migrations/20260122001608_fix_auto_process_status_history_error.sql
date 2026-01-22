/*
  # إصلاح خطأ status_history في دالة auto_process_new_order
  
  1. التغييرات
    - إزالة المحاولة للوصول إلى حقل status_history غير الموجود
    - الاعتماد على trigger منفصل لإضافة السجل في جدول order_status_history
  
  2. الأمان
    - الحفاظ على SECURITY DEFINER
    - عدم التأثير على الوظائف الأخرى
*/

-- إصلاح دالة auto_process_new_order لإزالة استخدام status_history
CREATE OR REPLACE FUNCTION auto_process_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
  v_target_status TEXT;
BEGIN
  -- الحصول على كامل الإعدادات
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;
  
  -- التحقق من تفعيل المعالجة التلقائية
  v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);
  
  -- إذا كانت المعالجة التلقائية مفعلة والطلب جديد
  IF v_auto_processing AND NEW.status = 'pending' THEN
    -- الحصول على الحالة المستهدفة
    v_target_status := COALESCE(v_settings->'orders'->>'autoProcessingStatus', 'waiting-for-driver');
    
    -- تحديث حالة الطلب
    NEW.status := v_target_status;
    NEW.updated_at := now();
    
    -- ملاحظة: سيتم إضافة السجل في order_status_history تلقائياً عبر trigger منفصل
  END IF;
  
  RETURN NEW;
END;
$$;
