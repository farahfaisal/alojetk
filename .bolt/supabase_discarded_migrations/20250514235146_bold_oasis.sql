/*
  # Create orders and order items tables

  1. New Tables
    - `orders`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `vendor_id` (uuid, references vendors)
      - `status` (text)
      - `total` (numeric)
      - `subtotal` (numeric)
      - `delivery_fee` (numeric)
      - `payment_method` (text)
      - `notes` (text)
      - `address` (text)
      - `latitude` (numeric)
      - `longitude` (numeric)
      - `created_at` (timestamptz)

    - `order_items`
      - `id` (uuid, primary key)
      - `order_id` (uuid, references orders)
      - `product_id` (uuid, references products)
      - `quantity` (integer)
      - `price` (numeric)
      - `total` (numeric)
      - `notes` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for users and vendors to view their orders
    - Add policies for order items access
*/

-- Create orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id),
    vendor_id uuid REFERENCES vendors(id),
    status text DEFAULT 'pending',
    total numeric(10,2) NOT NULL DEFAULT 0,
    subtotal numeric(10,2) NOT NULL DEFAULT 0,
    delivery_fee numeric(10,2) DEFAULT 0,
    payment_method text DEFAULT 'cash',
    notes text,
    address text,
    latitude numeric,
    longitude numeric,
    created_at timestamptz DEFAULT now()
);

-- Create order_items table if it doesn't exist
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON orders(vendor_id);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create policies for orders
CREATE POLICY "Users can view their own orders"
    ON orders FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Vendors can view their orders"
    ON orders FOR SELECT
    TO authenticated
    USING (vendor_id IN (
        SELECT id FROM vendors WHERE user_id = auth.uid()
    ));

-- Create policies for order items
CREATE POLICY "Users can view their order items"
    ON order_items FOR SELECT
    TO authenticated
    USING (
        order_id IN (
            SELECT id FROM orders WHERE user_id = auth.uid()
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