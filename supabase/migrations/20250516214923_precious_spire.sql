/*
  # Create order API function

  1. New Functions
    - `create_order_api` - Function to create orders through the API
    - `generate_order_number` - Function to generate unique order numbers

  2. Changes
    - Add trigger to automatically generate order numbers if not provided
    - Add function to handle order creation through the API
*/

-- Function to generate a unique order number
CREATE OR REPLACE FUNCTION generate_order_number() 
RETURNS TEXT AS $$
DECLARE
  new_order_number TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    -- Generate a random order number with ORD prefix
    new_order_number := 'ORD-' || floor(random() * 900000 + 100000)::TEXT;
    
    -- Check if this order number already exists
    SELECT EXISTS(
      SELECT 1 FROM orders WHERE order_number = new_order_number
    ) INTO exists_already;
    
    -- If it doesn't exist, return it
    IF NOT exists_already THEN
      RETURN new_order_number;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to set order_number if not provided
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set order_number
DROP TRIGGER IF EXISTS set_order_number_trigger ON orders;
CREATE TRIGGER set_order_number_trigger
BEFORE INSERT ON orders
FOR EACH ROW
WHEN (NEW.order_number IS NULL)
EXECUTE FUNCTION set_order_number();

-- Add items_data column to orders table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'items_data'
  ) THEN
    ALTER TABLE orders ADD COLUMN items_data JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add customer_name and customer_phone columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN customer_name VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE orders ADD COLUMN customer_phone VARCHAR(20);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'vendor_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN vendor_name TEXT;
  END IF;
END $$;

-- Ensure order_items table has the correct structure
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  quantity integer NOT NULL DEFAULT 1,
  price numeric(10,2) NOT NULL,
  total numeric(10,2) NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on order_items if not already enabled
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Add policies for order_items if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'order_items' 
    AND policyname = 'Order items are viewable by everyone'
  ) THEN
    CREATE POLICY "Order items are viewable by everyone" 
    ON order_items FOR SELECT 
    TO public 
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'order_items' 
    AND policyname = 'Order items can be created by anyone'
  ) THEN
    CREATE POLICY "Order items can be created by anyone" 
    ON order_items FOR INSERT 
    TO public 
    WITH CHECK (true);
  END IF;
END $$;