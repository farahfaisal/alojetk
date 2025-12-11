/*
  # Fix Driver Authentication Trigger
  
  1. Changes
    - Make password_hash column nullable in custom_users table
    - Drop and recreate trigger_add_driver_to_auth function with proper NULL handling
    - Recreate the trigger with improved error handling
  
  2. Security
    - Maintain existing security policies
    - Ensure proper user creation flow
*/

-- 1. Make password_hash column nullable
DO $$ 
BEGIN
  ALTER TABLE custom_users
  ALTER COLUMN password_hash DROP NOT NULL;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Error making password_hash nullable: %', SQLERRM;
END $$;

-- 2. Drop the function and its dependent triggers
DROP FUNCTION IF EXISTS trigger_add_driver_to_auth CASCADE;

-- 3. Recreate the function with proper NULL handling
CREATE OR REPLACE FUNCTION trigger_add_driver_to_auth()
RETURNS TRIGGER AS $$
DECLARE
  final_username TEXT;
  final_name TEXT;
BEGIN
  -- Generate fallback values if needed
  final_username := COALESCE(NEW.phone, NEW.email, 'user_' || encode(gen_random_bytes(4), 'hex'));
  final_name := COALESCE(NEW.name, 'مستخدم جديد');
  
  -- Insert into custom_users with NULL password_hash
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
    final_username,
    NULL, -- Allow NULL password_hash
    final_name,
    NEW.email,
    NEW.phone,
    'driver',
    'active',
    NOW(),
    NOW()
  );
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log error but don't fail the transaction
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'driver_auth_error',
      'Error in trigger_add_driver_to_auth',
      jsonb_build_object(
        'error', SQLERRM,
        'driver_id', NEW.id,
        'phone', NEW.phone,
        'email', NEW.email
      )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Recreate the trigger
CREATE TRIGGER add_driver_to_auth
AFTER INSERT ON drivers
FOR EACH ROW
EXECUTE FUNCTION trigger_add_driver_to_auth();