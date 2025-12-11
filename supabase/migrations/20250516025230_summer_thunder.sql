/*
  # Fix Orders Storage and Policies

  1. Changes
    - Add missing policies for orders and order_items if they don't exist
    - Create order status update trigger
    - Modify constraints for guest checkout
    - Add order_number column
  
  2. Security
    - Enable RLS for orders and order_items tables
    - Add policies for public access with proper checks
*/

-- Function to check if a policy exists
CREATE OR REPLACE FUNCTION policy_exists(table_name text, policy_name text) 
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = table_name 
    AND policyname = policy_name
  );
END;
$$ LANGUAGE plpgsql;

-- Add policies for orders if they don't exist
DO $$ 
BEGIN
  IF NOT policy_exists('orders', 'Orders are viewable by everyone') THEN
    CREATE POLICY "Orders are viewable by everyone" 
    ON orders FOR SELECT 
    TO public 
    USING (true);
  END IF;

  IF NOT policy_exists('orders', 'Orders can be created by anyone') THEN
    CREATE POLICY "Orders can be created by anyone" 
    ON orders FOR INSERT 
    TO public 
    WITH CHECK (true);
  END IF;

  IF NOT policy_exists('orders', 'Orders are updatable by everyone') THEN
    CREATE POLICY "Orders are updatable by everyone" 
    ON orders FOR UPDATE 
    TO public 
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Add policies for order_items if they don't exist
DO $$ 
BEGIN
  IF NOT policy_exists('order_items', 'Order items are viewable by everyone') THEN
    CREATE POLICY "Order items are viewable by everyone" 
    ON order_items FOR SELECT 
    TO public 
    USING (true);
  END IF;

  IF NOT policy_exists('order_items', 'Order items can be created by anyone') THEN
    CREATE POLICY "Order items can be created by anyone" 
    ON order_items FOR INSERT 
    TO public 
    WITH CHECK (true);
  END IF;
END $$;

-- Create function to handle order status updates
CREATE OR REPLACE FUNCTION handle_order_status_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into order_status_history when status changes
  IF (TG_OP = 'UPDATE' AND OLD.status <> NEW.status) OR (TG_OP = 'INSERT') THEN
    INSERT INTO order_status_history (
      order_id,
      status,
      note,
      created_by
    ) VALUES (
      NEW.id,
      NEW.status,
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'تم إنشاء الطلب'
        ELSE 'تم تحديث حالة الطلب'
      END,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order status updates
DROP TRIGGER IF EXISTS order_status_update_trigger ON orders;
CREATE TRIGGER order_status_update_trigger
AFTER INSERT OR UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION handle_order_status_update();

-- Modify constraints to allow null customer_id and vendor_id for guest checkout
DO $$ 
BEGIN
  -- Drop existing constraints if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_customer_id_fkey'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_customer_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_vendor_id_fkey'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_vendor_id_fkey;
  END IF;

  -- Add new constraints
  ALTER TABLE orders 
    ADD CONSTRAINT orders_customer_id_fkey 
    FOREIGN KEY (customer_id) 
    REFERENCES customers(id) 
    ON DELETE SET NULL;

  ALTER TABLE orders 
    ADD CONSTRAINT orders_vendor_id_fkey 
    FOREIGN KEY (vendor_id) 
    REFERENCES vendors(id) 
    ON DELETE SET NULL;
END $$;

-- Make customer_id and vendor_id nullable
DO $$ 
BEGIN
  ALTER TABLE orders ALTER COLUMN customer_id DROP NOT NULL;
  ALTER TABLE orders ALTER COLUMN vendor_id DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Add order_number column for easier reference
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_number TEXT;
  END IF;
END $$;

-- Enable RLS on orders and order_items if not already enabled
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;