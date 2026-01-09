/*
  # إصلاح دالة حساب المجموع الكلي للطلبات

  ## المشكلة
  - الدالة `calculate_order_total()` كانت تحسب المجموع = المجموع الفرعي فقط
  - لم تكن تضيف رسوم التوصيل
  - لم تكن تطرح خصم النقاط

  ## الإصلاح
  - تحديث الدالة لتحسب: المجموع = المجموع الفرعي + رسوم التوصيل - خصم النقاط
  - إصلاح جميع الطلبات الموجودة التي تحتوي على مجموع خاطئ

  ## التأثير
  - سيتم إصلاح حساب المجموع الكلي لجميع الطلبات الجديدة تلقائياً
  - سيتم إصلاح الطلبات القديمة أيضاً
*/

-- حذف الدالة القديمة
DROP FUNCTION IF EXISTS calculate_order_total() CASCADE;

-- إنشاء الدالة الصحيحة
CREATE OR REPLACE FUNCTION calculate_order_total()
RETURNS TRIGGER AS $$
BEGIN
  -- حساب total = subtotal + delivery_fee - points_discount
  NEW.total := COALESCE(NEW.subtotal, 0) + COALESCE(NEW.delivery_fee, 0) - COALESCE(NEW.points_discount, 0);
  
  -- التأكد من أن المجموع لا يكون سالباً
  IF NEW.total < 0 THEN
    NEW.total := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إعادة إنشاء الـ trigger
DROP TRIGGER IF EXISTS trigger_calculate_order_total ON orders;

CREATE TRIGGER trigger_calculate_order_total
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_order_total();

-- إصلاح جميع الطلبات الموجودة
UPDATE orders
SET 
  total = COALESCE(subtotal, 0) + COALESCE(delivery_fee, 0) - COALESCE(points_discount, 0),
  updated_at = now()
WHERE total != (COALESCE(subtotal, 0) + COALESCE(delivery_fee, 0) - COALESCE(points_discount, 0));
