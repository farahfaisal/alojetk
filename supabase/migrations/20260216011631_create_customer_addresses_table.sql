/*
  # إنشاء جدول عناوين العملاء (Customer Addresses)

  1. الجدول الجديد
    - `customer_addresses`
      - `id` (uuid, primary key) - معرف فريد للعنوان
      - `customer_id` (uuid, foreign key) - معرف العميل
      - `name` (text) - اسم العنوان (مثل: المنزل، العمل)
      - `address` (text) - العنوان الكامل
      - `city` (text) - المدينة
      - `phone` (text) - رقم الهاتف
      - `is_default` (boolean) - هل هو العنوان الافتراضي
      - `detailed_address` (text, nullable) - تفاصيل إضافية للعنوان
      - `latitude` (double precision, nullable) - خط العرض
      - `longitude` (double precision, nullable) - خط الطول
      - `created_at` (timestamptz) - وقت الإنشاء
      - `updated_at` (timestamptz) - وقت آخر تحديث

  2. الأمان
    - تفعيل RLS على الجدول
    - سياسة للسماح للعملاء بقراءة عناوينهم فقط
    - سياسة للسماح للعملاء بإضافة عناوين جديدة
    - سياسة للسماح للعملاء بتحديث عناوينهم فقط
    - سياسة للسماح للعملاء بحذف عناوينهم فقط

  3. الفهارس
    - فهرس على customer_id لتسريع الاستعلامات
*/

-- إنشاء جدول العناوين
CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  phone text NOT NULL,
  is_default boolean DEFAULT false,
  detailed_address text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- إنشاء فهرس على customer_id
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);

-- تفعيل RLS
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

-- سياسة القراءة: العملاء يمكنهم قراءة عناوينهم فقط
CREATE POLICY "Customers can view own addresses"
  ON customer_addresses
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

-- سياسة الإضافة: العملاء يمكنهم إضافة عناوين جديدة
CREATE POLICY "Customers can insert own addresses"
  ON customer_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- سياسة التحديث: العملاء يمكنهم تحديث عناوينهم فقط
CREATE POLICY "Customers can update own addresses"
  ON customer_addresses
  FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- سياسة الحذف: العملاء يمكنهم حذف عناوينهم فقط
CREATE POLICY "Customers can delete own addresses"
  ON customer_addresses
  FOR DELETE
  TO authenticated
  USING (customer_id = auth.uid());

-- دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_customer_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء trigger لتحديث updated_at
DROP TRIGGER IF EXISTS update_customer_addresses_updated_at_trigger ON customer_addresses;
CREATE TRIGGER update_customer_addresses_updated_at_trigger
  BEFORE UPDATE ON customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_addresses_updated_at();

-- دالة للتأكد من وجود عنوان افتراضي واحد فقط لكل عميل
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  -- إذا تم تعيين العنوان الجديد كافتراضي
  IF NEW.is_default = true THEN
    -- إلغاء تعيين جميع العناوين الأخرى للعميل كافتراضية
    UPDATE customer_addresses
    SET is_default = false
    WHERE customer_id = NEW.customer_id
      AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء trigger لضمان عنوان افتراضي واحد فقط
DROP TRIGGER IF EXISTS ensure_single_default_address_trigger ON customer_addresses;
CREATE TRIGGER ensure_single_default_address_trigger
  BEFORE INSERT OR UPDATE ON customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_address();