/*
  # إضافة حقل تسمية العنوان (label) إلى جدول customer_addresses

  1. التغييرات
    - إضافة عمود `label` اختياري لجدول `customer_addresses`
    - يتيح للمستخدمين تسمية عناوينهم مثل: "البيت"، "المدرسة"، "العمل"، إلخ
  
  2. الملاحظات
    - الحقل اختياري ويمكن أن يكون null
    - يساعد على تنظيم وتمييز العناوين المحفوظة
*/

-- إضافة عمود label إلى جدول customer_addresses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_addresses' AND column_name = 'label'
  ) THEN
    ALTER TABLE customer_addresses ADD COLUMN label text;
  END IF;
END $$;