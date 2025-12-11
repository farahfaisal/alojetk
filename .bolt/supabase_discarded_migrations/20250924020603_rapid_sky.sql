/*
  # إضافة تصنيف البرجر

  1. New Categories
    - `برجر` - تصنيف البرجر مع صورة مناسبة
  
  2. Data Insertion
    - إضافة تصنيف البرجر إذا لم يكن موجوداً
    - تعيين نوع التصنيف كـ 'restaurant'
    - إضافة صورة مناسبة للبرجر
*/

-- إضافة تصنيف البرجر إذا لم يكن موجوداً
INSERT INTO categories (id, name, slug, description, image_url, type, parent_id)
SELECT 
  gen_random_uuid(),
  'برجر',
  'burger',
  'تشكيلة متنوعة من البرجر اللذيذ',
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&h=500&fit=crop&crop=center',
  'restaurant',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM categories 
  WHERE name = 'برجر' OR name = 'burger' OR name ILIKE '%برجر%' OR name ILIKE '%burger%'
);

-- إضافة تصنيفات إضافية للمطاعم إذا لم تكن موجودة
INSERT INTO categories (id, name, slug, description, image_url, type, parent_id)
SELECT 
  gen_random_uuid(),
  'بيتزا',
  'pizza',
  'أشهى أنواع البيتزا',
  'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=500&h=500&fit=crop&crop=center',
  'restaurant',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM categories 
  WHERE name = 'بيتزا' OR name = 'pizza' OR name ILIKE '%بيتزا%' OR name ILIKE '%pizza%'
);

INSERT INTO categories (id, name, slug, description, image_url, type, parent_id)
SELECT 
  gen_random_uuid(),
  'مشاوي',
  'grills',
  'أطباق المشاوي الشهية',
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&h=500&fit=crop&crop=center',
  'restaurant',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM categories 
  WHERE name = 'مشاوي' OR name = 'grills' OR name ILIKE '%مشاوي%' OR name ILIKE '%grill%'
);

INSERT INTO categories (id, name, slug, description, image_url, type, parent_id)
SELECT 
  gen_random_uuid(),
  'حلويات',
  'desserts',
  'أشهى الحلويات والكيك',
  'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500&h=500&fit=crop&crop=center',
  'restaurant',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM categories 
  WHERE name = 'حلويات' OR name = 'desserts' OR name ILIKE '%حلويات%' OR name ILIKE '%dessert%'
);

INSERT INTO categories (id, name, slug, description, image_url, type, parent_id)
SELECT 
  gen_random_uuid(),
  'مشروبات',
  'drinks',
  'مشروبات باردة وساخنة',
  'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=500&h=500&fit=crop&crop=center',
  'restaurant',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM categories 
  WHERE name = 'مشروبات' OR name = 'drinks' OR name ILIKE '%مشروبات%' OR name ILIKE '%drink%'
);

INSERT INTO categories (id, name, slug, description, image_url, type, parent_id)
SELECT 
  gen_random_uuid(),
  'سندويشات',
  'sandwiches',
  'سندويشات متنوعة ولذيذة',
  'https://images.unsplash.com/photo-1539252554453-80ab65ce3586?w=500&h=500&fit=crop&crop=center',
  'restaurant',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM categories 
  WHERE name = 'سندويشات' OR name = 'sandwiches' OR name ILIKE '%سندويش%' OR name ILIKE '%sandwich%'
);

-- تحديث التصنيفات الموجودة لتأكيد النوع
UPDATE categories 
SET type = 'restaurant' 
WHERE (name ILIKE '%برجر%' OR name ILIKE '%burger%' OR 
       name ILIKE '%بيتزا%' OR name ILIKE '%pizza%' OR
       name ILIKE '%مشاوي%' OR name ILIKE '%grill%' OR
       name ILIKE '%حلويات%' OR name ILIKE '%dessert%' OR
       name ILIKE '%مشروبات%' OR name ILIKE '%drink%' OR
       name ILIKE '%سندويش%' OR name ILIKE '%sandwich%')
  AND (type IS NULL OR type != 'restaurant');