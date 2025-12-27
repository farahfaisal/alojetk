/*
  # Create Custom Order Items Table

  1. New Tables
    - `custom_order_items`
      - `id` (uuid, primary key) - معرف العنصر
      - `order_id` (uuid, foreign key) - معرف الطلب
      - `vendor_id` (uuid, foreign key) - معرف المتجر
      - `custom_product_name` (text) - اسم المنتج المخصص
      - `description` (text) - وصف المنتج
      - `quantity` (integer) - الكمية
      - `price` (numeric) - السعر لكل وحدة
      - `total_price` (numeric) - السعر الإجمالي
      - `image_url` (text, optional) - رابط صورة المنتج
      - `notes` (text, optional) - ملاحظات إضافية
      - `created_at` (timestamptz) - وقت الإنشاء
      - `updated_at` (timestamptz) - وقت التحديث

  2. Security
    - Enable RLS on `custom_order_items` table
    - Add policies for authenticated users to manage their custom orders
    - Add policies for vendors to view their custom order items
*/

-- Create custom_order_items table
CREATE TABLE IF NOT EXISTS custom_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  custom_product_name text NOT NULL,
  description text DEFAULT '',
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  total_price numeric(10, 2) NOT NULL CHECK (total_price >= 0),
  image_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_custom_order_items_order_id ON custom_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_custom_order_items_vendor_id ON custom_order_items(vendor_id);

-- Enable RLS
ALTER TABLE custom_order_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own custom order items
CREATE POLICY "Users can view own custom order items"
  ON custom_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = custom_order_items.order_id
      AND orders.customer_id IN (
        SELECT id FROM customers WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: Users can insert custom order items for their orders
CREATE POLICY "Users can insert custom order items for own orders"
  ON custom_order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = custom_order_items.order_id
      AND orders.customer_id IN (
        SELECT id FROM customers WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: Users can update their custom order items (only before order is confirmed)
CREATE POLICY "Users can update own custom order items"
  ON custom_order_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = custom_order_items.order_id
      AND orders.customer_id IN (
        SELECT id FROM customers WHERE user_id = auth.uid()
      )
      AND orders.status IN ('pending', 'cart')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = custom_order_items.order_id
      AND orders.customer_id IN (
        SELECT id FROM customers WHERE user_id = auth.uid()
      )
      AND orders.status IN ('pending', 'cart')
    )
  );

-- Policy: Users can delete their custom order items (only before order is confirmed)
CREATE POLICY "Users can delete own custom order items"
  ON custom_order_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = custom_order_items.order_id
      AND orders.customer_id IN (
        SELECT id FROM customers WHERE user_id = auth.uid()
      )
      AND orders.status IN ('pending', 'cart')
    )
  );

-- Policy: Vendors can view custom order items for their store
CREATE POLICY "Vendors can view their custom order items"
  ON custom_order_items
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors
      WHERE user_id = auth.uid()
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_order_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_custom_order_items_timestamp
  BEFORE UPDATE ON custom_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_order_items_updated_at();
