/*
  # Add Order Items Relationship and Fix Table Names

  1. Changes
    - Rename 'orde' table to 'order_items' for consistency
    - Add foreign key relationship between orders and order_items
    - Add necessary indexes for performance

  2. Security
    - Maintain existing RLS policies
*/

-- First rename the 'orde' table to 'order_items' if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orde') THEN
    ALTER TABLE public.orde RENAME TO order_items;
  END IF;
END $$;

-- Create order_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    price numeric(10,2) NOT NULL,
    addons_data jsonb,
    created_at timestamptz DEFAULT now(),
    status text,
    CONSTRAINT order_items_status_check CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'delivered-to-driver'::text, 'shipping'::text, 'delivered'::text, 'cancelled'::text]))
);

-- Add foreign key constraints
ALTER TABLE public.order_items
    DROP CONSTRAINT IF EXISTS order_items_order_id_fkey,
    ADD CONSTRAINT order_items_order_id_fkey 
    FOREIGN KEY (order_id) 
    REFERENCES public.orders(id) 
    ON DELETE CASCADE;

ALTER TABLE public.order_items
    DROP CONSTRAINT IF EXISTS order_items_product_id_fkey,
    ADD CONSTRAINT order_items_product_id_fkey 
    FOREIGN KEY (product_id) 
    REFERENCES public.products(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

-- Add RLS policies
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Policy for viewing order items
CREATE POLICY IF NOT EXISTS "Order items are viewable by related parties"
    ON public.order_items FOR SELECT
    TO authenticated
    USING (
        order_id IN (
            SELECT ord.id 
            FROM orders ord
            WHERE 
                ord.vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid()) OR
                ord.driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()) OR
                ord.customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
        )
    );

-- Policy for creating order items
CREATE POLICY IF NOT EXISTS "Users can create order items for their orders"
    ON public.order_items FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM orders ord
            WHERE ord.id = order_items.order_id 
            AND ord.customer_id = auth.uid()
        )
    );

-- Policy for viewing own order items
CREATE POLICY IF NOT EXISTS "Users can view their order items"
    ON public.order_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 
            FROM orders ord
            WHERE ord.id = order_items.order_id 
            AND ord.customer_id = auth.uid()
        )
    );