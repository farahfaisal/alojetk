/*
  # Fix Orders and Order Items Tables

  1. Changes
    - Ensure orders table exists with proper structure
    - Create order_items table with correct foreign key relationships
    - Add proper indexes and constraints
    - Enable RLS with appropriate policies

  2. Security
    - Enable RLS on both tables
    - Add policies for customers and vendors
*/

-- First ensure orders table exists with proper structure
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  vendor_id uuid REFERENCES vendors(id),
  status text DEFAULT 'pending',
  total numeric(10,2) NOT NULL,
  delivery_fee numeric(10,2) DEFAULT 0,
  address text,
  phone text,
  notes text,
  payment_method text,
  scheduled_time timestamptz,
  is_scheduled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT orders_status_check CHECK (status IN ('pending', 'processing', 'delivering', 'completed', 'cancelled')),
  CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('cash', 'card', 'wallet'))
);

-- Create indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Enable RLS on orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policies for orders
CREATE POLICY "Users can view their own orders"
ON orders FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Vendors can view orders for their store"
ON orders FOR SELECT
TO authenticated
USING (vendor_id IN (
  SELECT id FROM vendors WHERE user_id = auth.uid()
));

-- Now create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  price numeric(10,2) NOT NULL,
  addons_data jsonb,
  created_at timestamptz DEFAULT now(),
  status text,
  CONSTRAINT order_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT fk_order_id FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_id FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT order_items_status_check CHECK (status IN ('pending', 'processing', 'delivered-to-driver', 'shipping', 'delivered', 'cancelled'))
);

-- Create indexes for order_items
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_status ON order_items(status);

-- Enable RLS on order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create policies for order_items
CREATE POLICY "Users can view their own order items"
ON order_items FOR SELECT
TO authenticated
USING (
  order_id IN (
    SELECT id FROM orders WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Vendors can view their store's order items"
ON order_items FOR SELECT
TO authenticated
USING (
  order_id IN (
    SELECT id FROM orders WHERE vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  )
);