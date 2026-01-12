/*
  # تحديث دالة حساب إجمالي الطلب لتشمل خصم الكوبون

  1. التغييرات
    - تحديث دالة `calculate_order_total` لتأخذ في الاعتبار `coupon_discount`
    - الحساب الجديد: total = subtotal + delivery_fee - points_discount - coupon_discount
    
  2. الهدف
    - التأكد من أن المجموع النهائي يتضمن جميع الخصومات بشكل صحيح
*/

CREATE OR REPLACE FUNCTION calculate_order_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- حساب total = subtotal + delivery_fee - points_discount - coupon_discount
  NEW.total := COALESCE(NEW.subtotal, 0) 
             + COALESCE(NEW.delivery_fee, 0) 
             - COALESCE(NEW.points_discount, 0)
             - COALESCE(NEW.coupon_discount, 0);
  
  -- التأكد من أن المجموع لا يكون سالباً
  IF NEW.total < 0 THEN
    NEW.total := 0;
  END IF;
  
  RETURN NEW;
END;
$$;