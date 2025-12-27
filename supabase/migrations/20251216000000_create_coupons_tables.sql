/*
  # إنشاء جداول الكوبونات

  1. جداول جديدة
    - `coupons` - جدول الكوبونات الرئيسي
      - `id` (uuid, primary key)
      - `code` (text, unique) - رمز الكوبون
      - `type` (text) - نوع الخصم (percentage أو fixed)
      - `value` (numeric) - قيمة الخصم
      - `max_discount` (numeric, nullable) - الحد الأقصى للخصم
      - `min_order_amount` (numeric, nullable) - الحد الأدنى لقيمة الطلب
      - `start_date` (timestamptz) - تاريخ البدء
      - `end_date` (timestamptz) - تاريخ الانتهاء
      - `usage_limit` (integer, nullable) - عدد مرات الاستخدام المسموح
      - `used_count` (integer) - عدد مرات الاستخدام الفعلي
      - `status` (text) - الحالة (active, inactive, expired)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `order_coupons` - جدول ربط الطلبات بالكوبونات
      - `id` (uuid, primary key)
      - `order_id` (uuid) - معرف الطلب
      - `coupon_id` (uuid) - معرف الكوبون
      - `discount_amount` (numeric) - مبلغ الخصم المطبق
      - `created_at` (timestamptz)

  2. الأمان
    - تفعيل RLS على جميع الجداول
    - السماح للجميع بقراءة الكوبونات النشطة
    - السماح للمستخدمين المصادق عليهم بإضافة order_coupons
*/

-- إنشاء جدول الكوبونات
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value numeric NOT NULL CHECK (value > 0),
  max_discount numeric,
  min_order_amount numeric DEFAULT 0,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz NOT NULL,
  usage_limit integer,
  used_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- إنشاء جدول ربط الطلبات بالكوبونات
CREATE TABLE IF NOT EXISTS order_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  coupon_id uuid NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  discount_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(order_id, coupon_id)
);

-- إنشاء indexes للأداء
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status);
CREATE INDEX IF NOT EXISTS idx_coupons_dates ON coupons(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_order_coupons_order_id ON order_coupons(order_id);
CREATE INDEX IF NOT EXISTS idx_order_coupons_coupon_id ON order_coupons(coupon_id);

-- تفعيل RLS
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_coupons ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان للكوبونات
-- السماح لأي شخص بقراءة الكوبونات النشطة
CREATE POLICY "Anyone can view active coupons"
  ON coupons
  FOR SELECT
  USING (status = 'active' AND now() BETWEEN start_date AND end_date);

-- السماح للمسؤولين بإدارة الكوبونات (يمكن تعديلها لاحقاً)
CREATE POLICY "Admins can manage coupons"
  ON coupons
  FOR ALL
  USING (auth.jwt()->>'role' = 'admin');

-- سياسات الأمان لربط الطلبات بالكوبونات
-- السماح للمستخدمين بإضافة كوبونات لطلباتهم
CREATE POLICY "Users can add coupons to orders"
  ON order_coupons
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_coupons.order_id
      AND orders.customer_id = auth.uid()
    )
  );

-- السماح للمستخدمين بقراءة كوبونات طلباتهم
CREATE POLICY "Users can view their order coupons"
  ON order_coupons
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_coupons.order_id
      AND orders.customer_id = auth.uid()
    )
  );

-- السماح للمسؤولين بإدارة كوبونات الطلبات
CREATE POLICY "Admins can manage order coupons"
  ON order_coupons
  FOR ALL
  USING (auth.jwt()->>'role' = 'admin');

-- إضافة trigger لتحديث updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_coupons_updated_at'
  ) THEN
    CREATE TRIGGER update_coupons_updated_at
      BEFORE UPDATE ON coupons
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- إضافة بعض الكوبونات التجريبية
INSERT INTO coupons (code, type, value, min_order_amount, start_date, end_date, usage_limit, status)
VALUES
  ('WELCOME10', 'percentage', 10, 50, now(), now() + interval '30 days', 100, 'active'),
  ('FIRST20', 'percentage', 20, 100, now(), now() + interval '30 days', 50, 'active'),
  ('SAVE50', 'fixed', 50, 200, now(), now() + interval '30 days', NULL, 'active')
ON CONFLICT (code) DO NOTHING;
