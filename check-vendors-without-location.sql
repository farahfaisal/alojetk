-- ==========================================
-- فحص سريع: المتاجر بدون موقع محدد
-- ==========================================

-- 1️⃣ عرض المتاجر التي تحتاج تحديث (أولوية عالية)
-- ============================================
SELECT
  id,
  store_name AS "اسم المتجر",
  address AS "العنوان",
  city AS "المدينة",
  CASE
    WHEN featured THEN '⭐ مميز'
    ELSE 'عادي'
  END AS "النوع",
  status AS "الحالة"
FROM vendors
WHERE (latitude IS NULL OR longitude IS NULL)
  AND status = 'active'
ORDER BY featured DESC, store_name;


-- 2️⃣ إحصائيات سريعة
-- ============================================
SELECT
  COUNT(*) AS "إجمالي المتاجر",
  COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) AS "متاجر بموقع دقيق ✅",
  COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL) AS "متاجر بدون موقع ❌",
  ROUND(
    (COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::numeric /
     NULLIF(COUNT(*), 0)) * 100,
    1
  ) || '%' AS "نسبة الاكتمال"
FROM vendors;


-- 3️⃣ تحديث موقع متجر واحد (مثال)
-- ============================================
-- استبدل القيم أدناه بالقيم الفعلية:

/*
UPDATE vendors
SET
  latitude = 31.5000,    -- خط العرض من Google Maps
  longitude = 34.4500    -- خط الطول من Google Maps
WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
*/


-- 4️⃣ التحقق من صحة الإحداثيات
-- ============================================
-- عرض المتاجر ذات الإحداثيات الخاطئة (خارج نطاق فلسطين)
SELECT
  id,
  store_name AS "اسم المتجر",
  latitude AS "خط العرض",
  longitude AS "خط الطول",
  CASE
    WHEN latitude < 29.5 OR latitude > 33.5 THEN '❌ خط العرض خارج نطاق فلسطين'
    WHEN longitude < 34.2 OR longitude > 35.9 THEN '❌ خط الطول خارج نطاق فلسطين'
    ELSE '✅ صحيح'
  END AS "التحقق"
FROM vendors
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND (
    latitude < 29.5 OR latitude > 33.5 OR
    longitude < 34.2 OR longitude > 35.9
  );


-- 5️⃣ عرض المتاجر مع روابط Google Maps
-- ============================================
SELECT
  store_name AS "اسم المتجر",
  COALESCE(address, '-') AS "العنوان",
  COALESCE(city, '-') AS "المدينة",
  'https://www.google.com/maps/search/' ||
    REPLACE(COALESCE(address || ' ' || city, store_name), ' ', '+')
  AS "رابط البحث في Google Maps"
FROM vendors
WHERE (latitude IS NULL OR longitude IS NULL)
  AND status = 'active'
ORDER BY featured DESC, store_name
LIMIT 20;


-- ==========================================
-- ملاحظات مهمة:
-- ==========================================
--
-- 📍 كيفية الحصول على الإحداثيات:
-- 1. افتح Google Maps
-- 2. ابحث عن عنوان المتجر
-- 3. انقر بالزر الأيمن على موقع المتجر
-- 4. اختر "What's here?" أو "ما هذا المكان؟"
-- 5. انسخ الإحداثيات (مثال: 31.5000, 34.4500)
--
-- ⚠️ تحذيرات:
-- - تأكد من الدقة: حدد موقع المتجر نفسه وليس المدينة
-- - الترتيب: Latitude أولاً ثم Longitude
-- - النطاق الصحيح:
--   * Latitude: 29.5 إلى 33.5
--   * Longitude: 34.2 إلى 35.9
--
-- 🚀 للحل السريع:
-- استخدم الأداة التفاعلية: fix-vendor-locations.html
--
