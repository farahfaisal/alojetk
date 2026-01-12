/*
  # إضافة حقل خصم الكوبون إلى جدول الطلبات

  1. التغييرات
    - إضافة عمود `coupon_discount` إلى جدول `orders` لحفظ قيمة خصم الكوبون
    - القيمة الافتراضية هي 0
    - النوع: numeric للسماح بالأرقام العشرية

  2. الهدف
    - عرض قيمة خصم الكوبون بشكل منفصل في صفحة تتبع الطلبات
    - حفظ معلومات الخصم مع الطلب نفسه لسهولة الوصول
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'coupon_discount'
  ) THEN
    ALTER TABLE orders ADD COLUMN coupon_discount numeric DEFAULT 0;
  END IF;
END $$;