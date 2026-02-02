-- ==========================================
-- SQL Scripts لإدارة مواقع المتاجر
-- ==========================================

-- 1. عرض جميع المتاجر بدون موقع محدد
-- ============================================
SELECT
  id,
  store_name,
  address,
  city,
  latitude,
  longitude,
  status,
  type
FROM vendors
WHERE latitude IS NULL OR longitude IS NULL
ORDER BY store_name;


-- 2. عرض إحصائيات المتاجر حسب حالة الموقع
-- ============================================
SELECT
  COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) as متاجر_بموقع_دقيق,
  COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL) as متاجر_بدون_موقع,
  COUNT(*) as إجمالي_المتاجر,
  ROUND(
    COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::numeric /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as نسبة_المتاجر_بموقع_دقيق
FROM vendors;


-- 3. عرض المتاجر المفعّلة بدون موقع (أولوية عالية)
-- ============================================
SELECT
  id,
  store_name,
  address,
  city,
  type,
  featured
FROM vendors
WHERE (latitude IS NULL OR longitude IS NULL)
  AND status = 'active'
ORDER BY featured DESC, store_name;


-- 4. تحديث موقع متجر واحد (مثال)
-- ============================================
-- استبدل القيم التالية بالقيم الصحيحة:
-- UPDATE vendors
-- SET
--   latitude = 31.5000,    -- خط العرض
--   longitude = 34.4500    -- خط الطول
-- WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';


-- 5. تحديث مواقع متاجر بناءً على المدينة (مثال)
-- ============================================
-- هذا مثال لتحديث جميع المتاجر في غزة بموقع افتراضي مركزي
-- تحذير: استخدم هذا فقط كبداية، ثم حدّث كل متجر بموقعه الدقيق!

-- غزة - موقع مركزي تقريبي
-- UPDATE vendors
-- SET latitude = 31.5000, longitude = 34.4500
-- WHERE city ILIKE '%غزة%' AND (latitude IS NULL OR longitude IS NULL);

-- خان يونس - موقع مركزي تقريبي
-- UPDATE vendors
-- SET latitude = 31.3463, longitude = 34.3028
-- WHERE city ILIKE '%خان يونس%' AND (latitude IS NULL OR longitude IS NULL);

-- رفح - موقع مركزي تقريبي
-- UPDATE vendors
-- SET latitude = 31.2900, longitude = 34.2422
-- WHERE city ILIKE '%رفح%' AND (latitude IS NULL OR longitude IS NULL);

-- دير البلح - موقع مركزي تقريبي
-- UPDATE vendors
-- SET latitude = 31.4192, longitude = 34.3500
-- WHERE city ILIKE '%دير البلح%' AND (latitude IS NULL OR longitude IS NULL);

-- جباليا - موقع مركزي تقريبي
-- UPDATE vendors
-- SET latitude = 31.5281, longitude = 34.4831
-- WHERE city ILIKE '%جباليا%' AND (latitude IS NULL OR longitude IS NULL);


-- 6. عرض المتاجر مع حساب المسافة من نقطة معينة
-- ============================================
-- مثال: حساب المسافة من مركز غزة (31.5000, 34.4500)
SELECT
  store_name,
  address,
  city,
  latitude,
  longitude,
  ROUND(
    CAST(
      6371 * acos(
        cos(radians(31.5000)) *
        cos(radians(latitude)) *
        cos(radians(longitude) - radians(34.4500)) +
        sin(radians(31.5000)) *
        sin(radians(latitude))
      ) AS numeric
    ),
    2
  ) as المسافة_من_مركز_غزة_كم
FROM vendors
WHERE latitude IS NOT NULL AND longitude IS NOT NULL
ORDER BY المسافة_من_مركز_غزة_كم;


-- 7. التحقق من صحة الإحداثيات (نطاق فلسطين)
-- ============================================
-- فلسطين تقع بين:
-- Latitude: 29.5 - 33.5
-- Longitude: 34.2 - 35.9
SELECT
  id,
  store_name,
  latitude,
  longitude,
  CASE
    WHEN latitude < 29.5 OR latitude > 33.5 THEN 'خط العرض خارج نطاق فلسطين'
    WHEN longitude < 34.2 OR longitude > 35.9 THEN 'خط الطول خارج نطاق فلسطين'
    ELSE 'الإحداثيات صحيحة'
  END as حالة_الإحداثيات
FROM vendors
WHERE latitude IS NOT NULL AND longitude IS NOT NULL
  AND (
    latitude < 29.5 OR latitude > 33.5 OR
    longitude < 34.2 OR longitude > 35.9
  );


-- 8. نسخ موقع متجر إلى متجر آخر (استخدم بحذر!)
-- ============================================
-- هذا للحالات حيث يوجد فرعين لنفس المتجر في نفس الموقع
-- UPDATE vendors dest
-- SET
--   latitude = src.latitude,
--   longitude = src.longitude
-- FROM vendors src
-- WHERE src.id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'  -- المتجر المصدر
--   AND dest.id = 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy'; -- المتجر الهدف


-- 9. حذف المواقع الخاطئة (إعادة تعيين)
-- ============================================
-- إذا كانت الإحداثيات خاطئة ولا تمثل الموقع الحقيقي
-- UPDATE vendors
-- SET latitude = NULL, longitude = NULL
-- WHERE id IN ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');


-- 10. إنشاء دالة للتحقق التلقائي
-- ============================================
CREATE OR REPLACE FUNCTION check_vendor_location_status()
RETURNS TABLE (
  total_vendors bigint,
  vendors_with_location bigint,
  vendors_without_location bigint,
  percentage_complete numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_vendors,
    COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::bigint as vendors_with_location,
    COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL)::bigint as vendors_without_location,
    ROUND(
      COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::numeric /
      NULLIF(COUNT(*), 0) * 100,
      2
    ) as percentage_complete
  FROM vendors;
END;
$$ LANGUAGE plpgsql;

-- استخدام الدالة:
-- SELECT * FROM check_vendor_location_status();


-- 11. البحث عن متاجر قريبة من موقع معين
-- ============================================
-- دالة للبحث عن المتاجر ضمن نطاق معين (بالكيلومتر)
CREATE OR REPLACE FUNCTION find_nearby_vendors(
  search_lat numeric,
  search_lng numeric,
  radius_km numeric DEFAULT 5
)
RETURNS TABLE (
  vendor_id uuid,
  store_name text,
  address text,
  distance_km numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.store_name,
    v.address,
    ROUND(
      CAST(
        6371 * acos(
          cos(radians(search_lat)) *
          cos(radians(v.latitude)) *
          cos(radians(v.longitude) - radians(search_lng)) +
          sin(radians(search_lat)) *
          sin(radians(v.latitude))
        ) AS numeric
      ),
      2
    ) as distance_km
  FROM vendors v
  WHERE v.latitude IS NOT NULL
    AND v.longitude IS NOT NULL
    AND (
      6371 * acos(
        cos(radians(search_lat)) *
        cos(radians(v.latitude)) *
        cos(radians(v.longitude) - radians(search_lng)) +
        sin(radians(search_lat)) *
        sin(radians(v.latitude))
      )
    ) <= radius_km
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;

-- استخدام الدالة:
-- البحث عن المتاجر ضمن 5 كم من مركز غزة
-- SELECT * FROM find_nearby_vendors(31.5000, 34.4500, 5);


-- 12. إنشاء تقرير شامل
-- ============================================
SELECT
  v.store_name as "اسم المتجر",
  v.address as "العنوان",
  v.city as "المدينة",
  v.type as "النوع",
  v.status as "الحالة",
  CASE
    WHEN v.latitude IS NULL OR v.longitude IS NULL THEN '❌ غير محدد'
    ELSE '✅ محدد'
  END as "حالة الموقع",
  COALESCE(v.latitude::text, '-') as "خط العرض",
  COALESCE(v.longitude::text, '-') as "خط الطول",
  CASE
    WHEN v.featured THEN '⭐ مميز'
    ELSE '-'
  END as "مميز"
FROM vendors v
ORDER BY
  CASE WHEN v.featured THEN 0 ELSE 1 END,
  CASE WHEN v.latitude IS NULL OR v.longitude IS NULL THEN 0 ELSE 1 END,
  v.store_name;


-- ==========================================
-- ملاحظات مهمة:
-- ==========================================
-- 1. قبل تنفيذ أي UPDATE، تأكد من عمل backup للقاعدة
-- 2. استخدم WHERE clause دائماً لتحديد المتاجر المراد تحديثها
-- 3. تحقق من النتائج باستخدام SELECT قبل UPDATE
-- 4. الإحداثيات المركزية للمدن هي تقريبية - يجب تحديث كل متجر بموقعه الدقيق
-- 5. استخدم Google Maps للحصول على إحداثيات دقيقة
