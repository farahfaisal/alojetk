/*
  # إضافة جدول تكلفة التوصيل المتعدد

  1. جدول جديد
    - `multi_vendor_delivery_settings`
      - `id` (uuid, primary key)
      - `additional_vendor_fee` (numeric) - التكلفة الإضافية لكل متجر إضافي
      - `is_active` (boolean) - هل الإعداد نشط
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. الأمان
    - تمكين RLS على الجدول
    - السماح للجميع بالقراءة
    - السماح للإدارة فقط بالتعديل

  3. البيانات الأولية
    - إضافة قيمة افتراضية 5 شيكل للتوصيل الإضافي
*/

-- إنشاء جدول إعدادات التوصيل المتعدد
CREATE TABLE IF NOT EXISTS multi_vendor_delivery_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  additional_vendor_fee numeric NOT NULL DEFAULT 5,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- تمكين RLS
ALTER TABLE multi_vendor_delivery_settings ENABLE ROW LEVEL SECURITY;

-- السماح للجميع بالقراءة
CREATE POLICY "Anyone can read multi vendor delivery settings"
  ON multi_vendor_delivery_settings
  FOR SELECT
  USING (true);

-- إضافة القيمة الافتراضية
INSERT INTO multi_vendor_delivery_settings (additional_vendor_fee, is_active)
VALUES (5, true)
ON CONFLICT DO NOTHING;

-- دالة لحساب تكلفة التوصيل المتعدد
CREATE OR REPLACE FUNCTION calculate_multi_vendor_delivery_fee(
  base_delivery_fee numeric,
  vendor_count integer
) RETURNS numeric AS $$
DECLARE
  additional_fee numeric;
  is_setting_active boolean;
  total_fee numeric;
BEGIN
  -- إذا كان هناك متجر واحد فقط، إرجاع التكلفة الأساسية
  IF vendor_count <= 1 THEN
    RETURN base_delivery_fee;
  END IF;

  -- الحصول على التكلفة الإضافية من الإعدادات
  SELECT additional_vendor_fee, is_active
  INTO additional_fee, is_setting_active
  FROM multi_vendor_delivery_settings
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  -- إذا لم توجد إعدادات نشطة، استخدم القيمة الافتراضية
  IF additional_fee IS NULL OR NOT is_setting_active THEN
    additional_fee := 5;
  END IF;

  -- حساب التكلفة الكلية: التكلفة الأساسية + (عدد المتاجر الإضافية × التكلفة الإضافية)
  total_fee := base_delivery_fee + ((vendor_count - 1) * additional_fee);

  RETURN total_fee;
END;
$$ LANGUAGE plpgsql;
