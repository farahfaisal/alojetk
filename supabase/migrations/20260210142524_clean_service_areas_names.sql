/*
  # تنظيف أسماء مناطق الخدمة

  1. التعديلات
    - إزالة المسافات الزائدة من أسماء المناطق في جدول service_areas
    - تحديث جميع الأسماء باستخدام trim() لإزالة المسافات في البداية والنهاية
  
  2. الهدف
    - حل مشكلة عدم العثور على المنطقة بسبب المسافات الزائدة
    - تحسين دقة البحث عن المناطق
*/

-- تنظيف أسماء المناطق من المسافات الزائدة
UPDATE service_areas 
SET name = TRIM(name) 
WHERE name != TRIM(name);

-- التحقق من النتائج
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM service_areas
  WHERE name ~ '^\s+|\s+$';
  
  RAISE NOTICE 'تم تنظيف أسماء المناطق بنجاح. عدد المناطق المحدثة: %', updated_count;
END $$;
