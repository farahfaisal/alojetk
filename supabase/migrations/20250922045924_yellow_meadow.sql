/*
  # إنشاء جدول إضافات منتجات الطلبات

  1. جداول جديدة
    - `order_item_addons`
      - `id` (uuid, primary key)
      - `order_id` (uuid, foreign key to orders)
      - `product_id` (uuid, foreign key to products)
      - `addon_id` (uuid, foreign key to product_addons)
      - `addon_name` (text)
      - `addon_price` (numeric)
      - `quantity` (integer)
      - `total_price` (numeric)
      - `created_at` (timestamp)

  2. الأمان
    - تفعيل RLS على جدول `order_item_addons`
    - إضافة سياسات للعملاء والمتاجر والمديرين

  3. الفهارس
    - فهرس على order_id
    - فهرس على product_id
    - فهرس على addon_id
*/

-- إنشاء جدول إضافات منتجات الطلبات
CREATE TABLE IF NOT EXISTS order_item_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  product_id uuid,
  addon_id uuid,
  addon_name text NOT NULL,
  addon_price numeric(10,2) NOT NULL DEFAULT 0.00,
  quantity integer NOT NULL DEFAULT 1,
  total_price numeric(10,2) NOT NULL DEFAULT 0.00,
  created_at timestamptz DEFAULT now()
);

-- إضافة الفهارس
CREATE INDEX IF NOT EXISTS idx_order_item_addons_order_id ON order_item_addons(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_addons_product_id ON order_item_addons(product_id);
CREATE INDEX IF NOT EXISTS idx_order_item_addons_addon_id ON order_item_addons(addon_id);
CREATE INDEX IF NOT EXISTS idx_order_item_addons_created_at ON order_item_addons(created_at);

-- إضافة القيود الخارجية
ALTER TABLE order_item_addons 
ADD CONSTRAINT order_item_addons_order_id_fkey 
FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE order_item_addons 
ADD CONSTRAINT order_item_addons_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

ALTER TABLE order_item_addons 
ADD CONSTRAINT order_item_addons_addon_id_fkey 
FOREIGN KEY (addon_id) REFERENCES product_addons(id) ON DELETE SET NULL;

-- تفعيل Row Level Security
ALTER TABLE order_item_addons ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان
CREATE POLICY "العملاء يمكنهم عرض إضافات طلباتهم"
  ON order_item_addons
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders 
      WHERE customer_id = (
        SELECT id FROM customers 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "المتاجر يمكنها عرض إضافات طلباتها"
  ON order_item_addons
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders 
      WHERE vendor_id IN (
        SELECT id FROM vendors 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "المديرون يمكنهم إدارة جميع الإضافات"
  ON order_item_addons
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "يمكن للجميع إدراج إضافات الطلبات"
  ON order_item_addons
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "يمكن للجميع عرض إضافات الطلبات"
  ON order_item_addons
  FOR SELECT
  TO public
  USING (true);

-- إضافة تعليق على الجدول
COMMENT ON TABLE order_item_addons IS 'جدول إضافات منتجات الطلبات - يحتوي على تفاصيل الإضافات المطلوبة مع كل منتج في الطلب';
COMMENT ON COLUMN order_item_addons.addon_name IS 'اسم الإضافة (محفوظ للرجوع إليه حتى لو تم حذف الإضافة الأصلية)';
COMMENT ON COLUMN order_item_addons.addon_price IS 'سعر الإضافة وقت الطلب';
COMMENT ON COLUMN order_item_addons.quantity IS 'كمية الإضافة';
COMMENT ON COLUMN order_item_addons.total_price IS 'السعر الإجمالي للإضافة (addon_price × quantity)';