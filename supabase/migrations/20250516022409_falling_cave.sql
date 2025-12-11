/*
  # Orders and Order Items Schema

  1. Tables
    - orders: Stores order information
    - order_items: Stores individual items in each order
  
  2. Security
    - Enable RLS on both tables
    - Add policies for customers and vendors
    - Drop existing policies and triggers first to avoid conflicts
  
  3. Indexes
    - Add indexes for frequently queried columns
*/

-- Drop existing policies and triggers
DO $$ 
BEGIN
    -- Drop policies
    DROP POLICY IF EXISTS "Customers can view their own orders" ON orders;
    DROP POLICY IF EXISTS "Customers can create orders" ON orders;
    DROP POLICY IF EXISTS "Vendors can view their orders" ON orders;
    DROP POLICY IF EXISTS "Customers can view their order items" ON order_items;
    DROP POLICY IF EXISTS "Customers can create order items" ON order_items;
    DROP POLICY IF EXISTS "Vendors can view their order items" ON order_items;
    
    -- Drop trigger
    DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id),
  vendor_id uuid REFERENCES vendors(id),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  address text,
  city text,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'electronic', 'wallet')),
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipping', 'delivered', 'cancelled')),
  total numeric(10,2) NOT NULL DEFAULT 0,
  delivery_fee numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  name text,
  vendor_name text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for orders
CREATE POLICY "Customers can view their own orders"
ON orders FOR SELECT
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Customers can create orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Vendors can view their orders"
ON orders FOR SELECT
TO authenticated
USING (
  vendor_id IN (
    SELECT id FROM vendors WHERE user_id = auth.uid()
  )
);

-- Create RLS policies for order items
CREATE POLICY "Customers can view their order items"
ON order_items FOR SELECT
TO authenticated
USING (
  order_id IN (
    SELECT id FROM orders WHERE customer_id IN (
      SELECT id FROM customers WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Customers can create order items"
ON order_items FOR INSERT
TO authenticated
WITH CHECK (
  order_id IN (
    SELECT id FROM orders WHERE customer_id IN (
      SELECT id FROM customers WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Vendors can view their order items"
ON order_items FOR SELECT
TO authenticated
USING (
  order_id IN (
    SELECT id FROM orders WHERE vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  )
);

-- Create updated_at trigger for orders
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();