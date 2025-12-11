/*
  # Fix Customer User Creation

  1. Changes
    - Create a new trigger to automatically create a custom_users record when a customer is created
    - The trigger runs after customer creation, creating the corresponding custom_users entry
    - Makes password_hash field nullable
  
  2. Security
    - Function uses security definer to bypass RLS
    - Creates proper relationships between customers and custom_users tables
*/

-- First make password_hash nullable if it's not already
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_users' 
    AND column_name = 'password_hash' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE custom_users ALTER COLUMN password_hash DROP NOT NULL;
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Error making password_hash nullable: %', SQLERRM;
END $$;

-- Create or replace the trigger function for customer creation
CREATE OR REPLACE FUNCTION trigger_add_customer_to_custom_users()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if there's already a custom_users record with this ID
  IF NOT EXISTS (SELECT 1 FROM custom_users WHERE id = NEW.id) THEN
    -- Insert into custom_users
    INSERT INTO custom_users (
      id,
      username,
      password_hash,
      name,
      email,
      phone,
      role,
      status,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      COALESCE(NEW.phone, 'user_' || encode(gen_random_bytes(4), 'hex')), -- Phone as username or generate one
      NULL, -- No password needed for OTP auth
      COALESCE(NEW.name, 'مستخدم جديد'), -- Use name or default
      NEW.email,
      NEW.phone,
      'customer',
      'active',
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log error but don't fail the transaction
    RAISE NOTICE 'Error in trigger_add_customer_to_custom_users: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS add_customer_to_custom_users ON customers;

-- Create the trigger
CREATE TRIGGER add_customer_to_custom_users
AFTER INSERT ON customers
FOR EACH ROW
EXECUTE FUNCTION trigger_add_customer_to_custom_users();

-- Add a similar trigger for updates to keep custom_users in sync
CREATE OR REPLACE FUNCTION trigger_update_custom_users_from_customer()
RETURNS TRIGGER AS $$
BEGIN
  -- Update custom_users record when customer is updated
  UPDATE custom_users
  SET
    name = NEW.name,
    email = NEW.email,
    phone = NEW.phone,
    updated_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log error but don't fail the transaction
    RAISE NOTICE 'Error in trigger_update_custom_users_from_customer: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the update trigger if it exists
DROP TRIGGER IF EXISTS update_custom_users_from_customer ON customers;

-- Create the update trigger
CREATE TRIGGER update_custom_users_from_customer
AFTER UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION trigger_update_custom_users_from_customer();