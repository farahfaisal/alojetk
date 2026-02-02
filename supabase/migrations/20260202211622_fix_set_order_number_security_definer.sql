/*
  # إصلاح دالة set_order_number لتعمل بصلاحيات المسؤول

  1. التغييرات
    - إضافة SECURITY DEFINER للدالة set_order_number
    - هذا يسمح للدالة بقراءة جميع الطلبات للتحقق من عدم تكرار رقم الطلب

  2. الأمان
    - الدالة تحتاج SECURITY DEFINER لقراءة جميع الطلبات وإنشاء رقم فريد
    - لا تشكل خطرًا أمنيًا لأنها تنشئ رقم الطلب فقط
*/

-- تعديل الدالة لإضافة SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$function$;

-- أيضًا إضافة SECURITY DEFINER للدالة generate_order_number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  new_order_number TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    -- Generate a random order number with ORD prefix
    new_order_number := 'ORD-' || floor(random() * 900000 + 100000)::TEXT;
    
    -- Check if this order number already exists
    SELECT EXISTS(
      SELECT 1 FROM orders WHERE order_number = new_order_number
    ) INTO exists_already;
    
    -- If it doesn't exist, return it
    IF NOT exists_already THEN
      RETURN new_order_number;
    END IF;
  END LOOP;
END;
$function$;
