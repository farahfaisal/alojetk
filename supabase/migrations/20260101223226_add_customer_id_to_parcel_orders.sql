/*
  # إضافة customer_id إلى جدول parcel_orders
  
  1. التغييرات
    - إضافة عمود `customer_id` كمرجع لجدول customers
    - إضافة دالة لإنشاء رقم طلب تلقائي
    - تحديث سياسات RLS للسماح للعملاء برؤية طلباتهم فقط
    
  2. الأمان
    - تحديث سياسات RLS لضمان أن العملاء يرون طلباتهم فقط
    - السماح للعملاء بإنشاء طلبات جديدة
    - السماح للعملاء بإلغاء طلباتهم المعلقة
*/

-- Add customer_id column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parcel_orders' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE parcel_orders ADD COLUMN customer_id uuid REFERENCES customers(id);
  END IF;
END $$;

-- Create function to generate parcel order number
CREATE OR REPLACE FUNCTION generate_parcel_order_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  new_order_number text;
  counter int;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM parcel_orders;
  new_order_number := 'P' || LPAD(counter::text, 6, '0');
  
  WHILE EXISTS (SELECT 1 FROM parcel_orders WHERE order_number = new_order_number) LOOP
    counter := counter + 1;
    new_order_number := 'P' || LPAD(counter::text, 6, '0');
  END LOOP;
  
  RETURN new_order_number;
END;
$$;

-- Create trigger to auto-generate order number
CREATE OR REPLACE FUNCTION set_parcel_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_parcel_order_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_parcel_order_number ON parcel_orders;
CREATE TRIGGER trigger_set_parcel_order_number
  BEFORE INSERT ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_parcel_order_number();

-- Update default status if not set
ALTER TABLE parcel_orders ALTER COLUMN status SET DEFAULT 'pending';

-- Drop existing policies
DROP POLICY IF EXISTS "Customers can view own parcel orders" ON parcel_orders;
DROP POLICY IF EXISTS "Customers can insert own parcel orders" ON parcel_orders;
DROP POLICY IF EXISTS "Customers can update own parcel orders" ON parcel_orders;

-- Create new RLS policies
CREATE POLICY "Customers can view own parcel orders"
  ON parcel_orders FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid() OR
    sender_phone = (SELECT phone FROM customers WHERE id = auth.uid())
  );

CREATE POLICY "Customers can insert own parcel orders"
  ON parcel_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid() OR
    sender_phone = (SELECT phone FROM customers WHERE id = auth.uid())
  );

CREATE POLICY "Customers can update own pending parcel orders"
  ON parcel_orders FOR UPDATE
  TO authenticated
  USING (
    (customer_id = auth.uid() OR sender_phone = (SELECT phone FROM customers WHERE id = auth.uid()))
    AND status = 'pending'
  )
  WITH CHECK (
    (customer_id = auth.uid() OR sender_phone = (SELECT phone FROM customers WHERE id = auth.uid()))
    AND status IN ('pending', 'cancelled')
  );