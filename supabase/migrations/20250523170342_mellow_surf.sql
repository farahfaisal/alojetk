/*
  # Remove OTP System
  
  1. Changes
    - Drop the otp_codes table
    - Drop all OTP-related functions
    - Drop the auth_functions view
  
  2. Purpose
    - Clean up the database schema
    - Remove unused OTP functionality
    - Prepare for a different authentication approach
*/

-- Drop the auth_functions view first
DROP VIEW IF EXISTS auth_functions;

-- Drop all OTP-related functions
DO $$ 
DECLARE
  func_record record;
BEGIN
  -- Find and drop all OTP-related functions
  FOR func_record IN 
    SELECT proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND (
      p.proname LIKE 'app\_otp\_%' OR 
      p.proname LIKE 'app\_verify\_otp%' OR
      p.proname LIKE 'app\_generate\_otp%' OR
      p.proname LIKE 'app\_send\_%' OR
      p.proname = 'verify_otp' OR
      p.proname = 'generate_otp' OR
      p.proname = 'phone_exists' OR
      p.proname = 'get_otp_attempts' OR
      p.proname = 'cleanup_expired_otps'
    )
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.' || func_record.proname || '(' || func_record.args || ') CASCADE';
    RAISE NOTICE 'Dropped function %(%)', func_record.proname, func_record.args;
  END LOOP;
END $$;

-- Drop the otp_codes table if it exists
DROP TABLE IF EXISTS otp_codes;

-- Log the removal of the OTP system
INSERT INTO system_logs (
  event_type,
  message,
  details
) VALUES (
  'system_update',
  'OTP system removed',
  jsonb_build_object(
    'timestamp', now(),
    'description', 'Removed OTP codes table and related functions'
  )
);