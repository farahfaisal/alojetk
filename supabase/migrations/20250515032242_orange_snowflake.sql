/*
  # Orders and Customers Schema

  1. New Tables
    - customers: Stores customer information and preferences
    - orders: Manages order details and status
    - order_items: Tracks individual items within orders
    - vendor_categories: Links vendors to their categories

  2. Security
    - RLS enabled on all tables
    - Policies for customer data access
    - Policies for order management
    - Policies for vendor category management

  3. Features
    - Automatic updated_at timestamp management
    - Generated order item totals
    - Comprehensive indexing
*/

-- Create customers table first
CREATE TABLE IF NOT EXISTS customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id),
    name text NOT NULL,
    phone text NOT NULL UNIQUE,
    email text,
    address text,
    notes text,
    rating numeric(3,2) DEFAULT 5.00,
    rating_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    wholesale_info jsonb
);

-- Create indexes for customers
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_wholesale_info ON customers USING gin (wholesale_info);

-- Enable RLS for customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create customer policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'customers' AND policyname = 'Users can view their own customer data'
    ) THEN
        CREATE POLICY "Users can view their own customer data"
            ON customers FOR SELECT
            TO authenticated
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'customers' AND policyname = 'Users can update their own customer data'
    ) THEN
        CREATE POLICY "Users can update their own customer data"
            ON customers FOR UPDATE
            TO authenticated
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Create orders table
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
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT orders_status_check CHECK (status IN ('pending', 'processing', 'delivering', 'completed', 'cancelled')),
    CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('cash', 'card', 'wallet'))
);

-- Create order_items table with explicit foreign key name
CREATE TABLE IF NOT EXISTS order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL,
    product_id uuid REFERENCES products(id),
    quantity integer NOT NULL DEFAULT 1,
    price numeric(10,2) NOT NULL,
    total numeric(10,2) GENERATED ALWAYS AS (quantity * price) STORED,
    notes text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT order_items_quantity_check CHECK (quantity > 0)
);

-- Create indexes for orders and items
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Enable RLS for orders and items
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create order policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'Customers can view their orders'
    ) THEN
        CREATE POLICY "Customers can view their orders"
            ON orders FOR SELECT
            TO authenticated
            USING (customer_id IN (
                SELECT id FROM customers WHERE user_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'Customers can create orders'
    ) THEN
        CREATE POLICY "Customers can create orders"
            ON orders FOR INSERT
            TO authenticated
            WITH CHECK (customer_id IN (
                SELECT id FROM customers WHERE user_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'Customers can update their orders'
    ) THEN
        CREATE POLICY "Customers can update their orders"
            ON orders FOR UPDATE
            TO authenticated
            USING (customer_id IN (
                SELECT id FROM customers WHERE user_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'Vendors can view their orders'
    ) THEN
        CREATE POLICY "Vendors can view their orders"
            ON orders FOR SELECT
            TO authenticated
            USING (vendor_id IN (
                SELECT id FROM vendors WHERE user_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'Vendors can update their orders'
    ) THEN
        CREATE POLICY "Vendors can update their orders"
            ON orders FOR UPDATE
            TO authenticated
            USING (vendor_id IN (
                SELECT id FROM vendors WHERE user_id = auth.uid()
            ));
    END IF;
END $$;

-- Create order items policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'order_items' AND policyname = 'Customers can view their order items'
    ) THEN
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
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'order_items' AND policyname = 'Customers can create order items'
    ) THEN
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
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'order_items' AND policyname = 'Vendors can view their order items'
    ) THEN
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
    END IF;
END $$;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add vendor categories relationship
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'vendor_categories'
    ) THEN
        CREATE TABLE vendor_categories (
            vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE,
            category_id uuid REFERENCES vendor_categories_table(id) ON DELETE CASCADE,
            created_at timestamptz DEFAULT now(),
            PRIMARY KEY (vendor_id, category_id)
        );

        ALTER TABLE vendor_categories ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Public can view vendor categories"
            ON vendor_categories FOR SELECT
            TO public
            USING (true);

        CREATE POLICY "Vendors can manage their categories"
            ON vendor_categories FOR ALL
            TO authenticated
            USING (vendor_id IN (
                SELECT id FROM vendors WHERE user_id = auth.uid()
            ))
            WITH CHECK (vendor_id IN (
                SELECT id FROM vendors WHERE user_id = auth.uid()
            ));
    END IF;
END $$;