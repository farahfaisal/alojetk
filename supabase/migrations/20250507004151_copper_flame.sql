/*
  # Create customers table and policies

  1. New Tables
    - `customers`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `phone` (text, unique)
      - `email` (text)
      - `address` (text)
      - `notes` (text)
      - `rating` (numeric)
      - `rating_count` (integer)
      - `wholesale_info` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for CRUD operations
    - Add functions for phone verification
*/

-- Create customers table if not exists
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  phone text UNIQUE NOT NULL,
  email text,
  address text,
  notes text,
  rating numeric DEFAULT 0,
  rating_count integer DEFAULT 0,
  wholesale_info jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_rating CHECK (rating >= 0 AND rating <= 5)
);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view their own customer data" ON customers;
  DROP POLICY IF EXISTS "Users can update their own customer data" ON customers;
  DROP POLICY IF EXISTS "Users can delete their own customer data" ON customers;
  DROP POLICY IF EXISTS "Users can insert their own customer data" ON customers;
  
  -- Create new policies
  CREATE POLICY "Users can view their own customer data"
    ON customers
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can update their own customer data"
    ON customers
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can delete their own customer data"
    ON customers
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can insert their own customer data"
    ON customers
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
END $$;

-- Create indexes if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_customers_user_id'
  ) THEN
    CREATE INDEX idx_customers_user_id ON customers(user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_customers_phone'
  ) THEN
    CREATE INDEX idx_customers_phone ON customers(phone);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_customers_email'
  ) THEN
    CREATE INDEX idx_customers_email ON customers(email);
  END IF;
END $$;

-- Create or replace function to check if phone exists
CREATE OR REPLACE FUNCTION check_phone_exists(phone_number text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM customers WHERE phone = phone_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace function to get customer by phone
CREATE OR REPLACE FUNCTION get_customer_by_phone(phone_number text)
RETURNS customers AS $$
BEGIN
  RETURN (
    SELECT * FROM customers WHERE phone = phone_number LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();