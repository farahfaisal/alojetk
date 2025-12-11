/*
  # Fix orders table structure
  
  1. Changes
    - Remove user_id reference and use customer_id instead
    - Add proper foreign key constraints
    - Add proper indexes and RLS policies
    
  2. Security
    - Enable RLS
    - Add policies for customers and vendors
    
  3. Constraints
    - Add status check
    - Add payment method check
*/

-- Create orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id),
  vendor_id uuid REFERENCES vendors(id),
  status text DEFAULT 'pending',
  total numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  delivery_fee numeric(10,2) DEFAULT 0,
  payment_method text DEFAULT 'cash',
  notes text,
  address text,
  latitude numeric(10,8),
  longitude numeric(11,8),
  is_scheduled boolean DEFAULT false,
  scheduled_time text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT orders_status_check CHECK (status IN ('pending', 'processing', 'delivering', 'completed', 'cancelled')),
  CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('cash', 'card', 'wallet'))
);

-- Create indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Enable RLS for orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create order policies
DO $$ 
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Customers can view their orders" ON orders;
    DROP POLICY IF EXISTS "Customers can create orders" ON orders;
    DROP POLICY IF EXISTS "Customers can update their orders" ON orders;
    DROP POLICY IF EXISTS "Vendors can view their orders" ON orders;
    DROP POLICY IF EXISTS "Vendors can update their orders" ON orders;
    
    -- Create new policies
    CREATE POLICY "Customers can view their orders"
        ON orders FOR SELECT
        TO authenticated
        USING (customer_id IN (
            SELECT id FROM customers WHERE user_id = auth.uid()
        ));

    CREATE POLICY "Customers can create orders"
        ON orders FOR INSERT
        TO authenticated
        WITH CHECK (customer_id IN (
            SELECT id FROM customers WHERE user_id = auth.uid()
        ));

    CREATE POLICY "Customers can update their orders"
        ON orders FOR UPDATE
        TO authenticated
        USING (customer_id IN (
            SELECT id FROM customers WHERE user_id = auth.uid()
        ))
        WITH CHECK (customer_id IN (
            SELECT id FROM customers WHERE user_id = auth.uid()
        ));

    CREATE POLICY "Vendors can view their orders"
        ON orders FOR SELECT
        TO authenticated
        USING (vendor_id IN (
            SELECT id FROM vendors WHERE user_id = auth.uid()
        ));

    CREATE POLICY "Vendors can update their orders"
        ON orders FOR UPDATE
        TO authenticated
        USING (vendor_id IN (
            SELECT id FROM vendors WHERE user_id = auth.uid()
        ))
        WITH CHECK (vendor_id IN (
            SELECT id FROM vendors WHERE user_id = auth.uid()
        ));
END $$;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for orders
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();