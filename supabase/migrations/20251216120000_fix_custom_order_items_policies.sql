/*
  # تصحيح سياسات جدول custom_order_items

  1. التغييرات
    - حذف السياسات القديمة التي تستخدم orders.user_id (خطأ)
    - إنشاء سياسات جديدة تستخدم orders.customer_id (صحيح)
    
  2. الأمان
    - السياسات تتحقق من customer_id بدلاً من user_id
    - المستخدمون يمكنهم الوصول لطلباتهم فقط
*/

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Users can view own custom order items" ON custom_order_items;
DROP POLICY IF EXISTS "Users can insert custom order items for own orders" ON custom_order_items;
DROP POLICY IF EXISTS "Users can update own custom order items" ON custom_order_items;
DROP POLICY IF EXISTS "Users can delete own custom order items" ON custom_order_items;
DROP POLICY IF EXISTS "Vendors can view their custom order items" ON custom_order_items;

-- إنشاء السياسات الصحيحة

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
