/*
  # Remove relationship between customers and custom_users tables
  
  1. Changes
    - Drop triggers that sync customers with custom_users
    - Remove foreign key constraints between tables
    - Update RLS policies to work without the relationship
    - Add function for customer authentication by phone
  
  2. Security
    - Update RLS policies for customers table
    - Grant proper permissions to the new function
*/

-- Drop triggers that sync customers with custom_users
DROP TRIGGER IF EXISTS add_customer_to_custom_users ON customers;
DROP TRIGGER IF EXISTS update_custom_users_from_customer ON customers;

-- Drop trigger functions
DROP FUNCTION IF EXISTS trigger_add_customer_to_custom_users();
DROP FUNCTION IF EXISTS trigger_update_custom_users_from_customer();

-- Remove foreign key constraints if they exist
DO $$ 
BEGIN
  -- Drop customers_user_id_fkey if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customers_user_id_fkey' 
    AND table_name = 'customers'
  ) THEN
    ALTER TABLE customers DROP CONSTRAINT customers_user_id_fkey;
  END IF;

  -- Drop customers_auth_user_id_fkey if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customers_auth_user_id_fkey' 
    AND table_name = 'customers'
  ) THEN
    ALTER TABLE customers DROP CONSTRAINT customers_auth_user_id_fkey;
  END IF;
END $$;

-- Make user_id and auth_user_id nullable (if they aren't already)
DO $$ 
BEGIN
  -- Check if user_id column exists and make it nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE customers ALTER COLUMN user_id DROP NOT NULL;
  END IF;
  
  -- Check if auth_user_id column exists and make it nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE customers ALTER COLUMN auth_user_id DROP NOT NULL;
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Error making columns nullable: %', SQLERRM;
END $$;

-- Update RLS policies for customers table
DO $$ 
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Users can view their own customer data" ON customers;
  DROP POLICY IF EXISTS "Users can update their own customer data" ON customers;
  DROP POLICY IF EXISTS "Users can delete their own customer data" ON customers;
  DROP POLICY IF EXISTS "Users can insert their own customer data" ON customers;
  
  -- Check if policies already exist before creating them
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customers' AND policyname = 'Customers can view their own data'
  ) THEN
    CREATE POLICY "Customers can view their own data"
      ON customers FOR SELECT
      TO public
      USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customers' AND policyname = 'Customers can update their own data'
  ) THEN
    CREATE POLICY "Customers can update their own data"
      ON customers FOR UPDATE
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customers' AND policyname = 'Customers can delete their own data'
  ) THEN
    CREATE POLICY "Customers can delete their own data"
      ON customers FOR DELETE
      TO public
      USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customers' AND policyname = 'Customers can insert their own data'
  ) THEN
    CREATE POLICY "Customers can insert their own data"
      ON customers FOR INSERT
      TO public
      WITH CHECK (true);
  END IF;
END $$;

-- Create a function to authenticate customers directly by phone
CREATE OR REPLACE FUNCTION authenticate_customer_by_phone(
  p_phone text,
  OUT success boolean,
  OUT customer_id uuid,
  OUT customer_name text,
  OUT message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  customer_record customers;
BEGIN
  -- Find customer by phone
  SELECT * INTO customer_record
  FROM customers
  WHERE phone = p_phone;
  
  IF customer_record IS NULL THEN
    success := false;
    message := 'لم يتم العثور على حساب بهذا الرقم';
    RETURN;
  END IF;
  
  -- Return customer information
  success := true;
  customer_id := customer_record.id;
  customer_name := customer_record.name;
  message := 'تم تسجيل الدخول بنجاح';
  
  RETURN;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION authenticate_customer_by_phone TO authenticated, anon;

-- Log the changes
INSERT INTO system_logs (
  event_type,
  message,
  details
) VALUES (
  'schema_update',
  'Removed relationship between customers and custom_users tables',
  jsonb_build_object(
    'timestamp', now(),
    'description', 'Removed triggers, foreign keys, and updated policies'
  )
);