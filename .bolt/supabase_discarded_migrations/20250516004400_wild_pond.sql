/*
  # Fix Orders and Order Items Relationship

  1. Changes
     - Drops and recreates the order_items table with proper foreign key constraints
     - Adds explicit foreign key relationship between order_items and orders
     - Updates RLS policies to ensure proper access control
     - Adds missing indexes for better query performance

  2. Security
     - Maintains existing RLS policies
     - Ensures customers can only access their own orders
     - Ensures vendors can only access orders for their products
*/

-- First, let's drop any existing foreign key constraints on order_items
ALTER TABLE IF EXISTS order_items 
DROP CONSTRAINT IF EXISTS fk_order_items_order,
DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;

-- Recreate the order_items table with proper constraints
DROP TABLE IF EXISTS order_items;

CREATE TABLE order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id),
    quantity integer NOT NULL DEFAULT 1,
    price numeric(10,2) NOT NULL,
    notes text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT order_items_quantity_check CHECK (quantity > 0)
);

-- Create indexes for better performance
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Enable RLS for order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create order items policies
DO $$ 
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Customers can view their order items" ON order_items;
    DROP POLICY IF EXISTS "Customers can create order items" ON order_items;
    DROP POLICY IF EXISTS "Vendors can view their order items" ON order_items;
    
    -- Recreate policies
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
END $$;