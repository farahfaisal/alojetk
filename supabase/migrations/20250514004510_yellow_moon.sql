/*
  # Update customers table with auth integration

  1. Changes
    - Add user_id column to customers table
    - Add unique constraint on phone
    - Update RLS policies
    - Add trigger for user creation

  2. Security
    - Enable RLS
    - Add policies for customer management
*/

-- Add user_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Add unique constraint on phone if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'customers_phone_key'
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT customers_phone_key UNIQUE (phone);
  END IF;
END $$;

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

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO customers (user_id, phone, name, email)
  VALUES (
    NEW.id,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();