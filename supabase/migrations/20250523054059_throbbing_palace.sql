/*
  # Fix OTP Verification Function

  1. Changes
    - Drop all existing app_otp_verify functions
    - Create a new function with a unique name
    - Fix column ambiguity issues
    - Recreate the auth_functions view
  
  2. Security
    - Maintain existing security policies
    - Grant proper permissions to the new function
*/

-- First drop the view that depends on the function
DROP VIEW IF EXISTS auth_functions;

-- Drop all existing app_otp_verify functions to avoid conflicts
DO $$ 
DECLARE
  func_record record;
BEGIN
  FOR func_record IN 
    SELECT proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname = 'app_otp_verify'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.app_otp_verify(' || func_record.args || ') CASCADE';
    RAISE NOTICE 'Dropped function app_otp_verify(%)', func_record.args;
  END LOOP;
END $$;

-- Create a completely new function with a unique name
CREATE OR REPLACE FUNCTION app_otp_verify_unique(
  p_phone_number text,
  p_otp_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  valid boolean;
  customer_exists boolean;
  column_name text;
  phone_column text := 'phone_number'; -- Default column name
  code_column text := 'otp'; -- Default column name
BEGIN
  -- Check which column names exist in the otp_codes table
  SELECT column_name INTO column_name 
  FROM information_schema.columns 
  WHERE table_name = 'otp_codes' AND column_name = 'phone' 
  LIMIT 1;
  
  IF column_name IS NOT NULL THEN
    phone_column := 'phone';
  END IF;
  
  SELECT column_name INTO column_name 
  FROM information_schema.columns 
  WHERE table_name = 'otp_codes' AND column_name = 'code' 
  LIMIT 1;
  
  IF column_name IS NOT NULL THEN
    code_column := 'code';
  END IF;

  -- Validate phone format
  IF NOT p_phone_number ~ '^0\d{9}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رقم الهاتف غير صالح'
    );
  END IF;
  
  -- Validate OTP format
  IF NOT p_otp_code ~ '^\d{6}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز التحقق غير صالح'
    );
  END IF;
  
  -- Check if OTP exists, is not used, and has not expired
  -- Use dynamic SQL to handle different column names
  IF phone_column = 'phone' AND code_column = 'code' THEN
    EXECUTE format('
      SELECT EXISTS (
        SELECT 1
        FROM otp_codes
        WHERE phone = %L
        AND code = %L
        AND used = false
        AND expires_at > now()
      )', p_phone_number, p_otp_code) INTO valid;
  ELSIF phone_column = 'phone_number' AND code_column = 'otp' THEN
    EXECUTE format('
      SELECT EXISTS (
        SELECT 1
        FROM otp_codes
        WHERE phone_number = %L
        AND otp = %L
        AND used = false
        AND expires_at > now()
      )', p_phone_number, p_otp_code) INTO valid;
  ELSE
    -- Fallback to try both column combinations
    EXECUTE format('
      SELECT EXISTS (
        SELECT 1
        FROM otp_codes
        WHERE (phone = %L OR phone_number = %L)
        AND (code = %L OR otp = %L)
        AND used = false
        AND expires_at > now()
      )', p_phone_number, p_phone_number, p_otp_code, p_otp_code) INTO valid;
  END IF;
  
  IF NOT valid THEN
    -- Log failed verification attempt
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'otp_verification_failed',
      'OTP verification failed',
      jsonb_build_object(
        'phone', p_phone_number,
        'timestamp', now()
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز التحقق غير صحيح أو منتهي الصلاحية'
    );
  END IF;
  
  -- Mark OTP as used
  IF phone_column = 'phone' AND code_column = 'code' THEN
    EXECUTE format('
      UPDATE otp_codes
      SET used = true
      WHERE phone = %L
      AND code = %L
      AND used = false
      AND expires_at > now()
    ', p_phone_number, p_otp_code);
  ELSIF phone_column = 'phone_number' AND code_column = 'otp' THEN
    EXECUTE format('
      UPDATE otp_codes
      SET used = true
      WHERE phone_number = %L
      AND otp = %L
      AND used = false
      AND expires_at > now()
    ', p_phone_number, p_otp_code);
  ELSE
    -- Fallback to try both column combinations
    EXECUTE format('
      UPDATE otp_codes
      SET used = true
      WHERE (phone = %L OR phone_number = %L)
      AND (code = %L OR otp = %L)
      AND used = false
      AND expires_at > now()
    ', p_phone_number, p_phone_number, p_otp_code, p_otp_code);
  END IF;
  
  -- Check if customer exists
  SELECT EXISTS (
    SELECT 1 FROM customers WHERE phone = p_phone_number
  ) INTO customer_exists;
  
  -- Log successful verification
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'otp_verification_success',
    'OTP verification successful',
    jsonb_build_object(
      'phone', p_phone_number,
      'existing_user', customer_exists,
      'timestamp', now()
    )
  );
  
  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم التحقق بنجاح',
    'existing_user', customer_exists
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'otp_verification_error',
      'Error verifying OTP',
      jsonb_build_object(
        'phone', p_phone_number,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    -- Return error response
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ أثناء التحقق من الرمز: ' || SQLERRM
    );
END;
$$;

-- Create a new wrapper function with a different name to avoid conflicts
CREATE OR REPLACE FUNCTION app_otp_verify(phone_number text, otp_code text)
RETURNS jsonb AS $$
  SELECT app_otp_verify_unique(phone_number, otp_code);
$$ LANGUAGE SQL SECURITY DEFINER;

-- Recreate the view
CREATE OR REPLACE VIEW auth_functions AS
SELECT 
  'app_otp_send'::regproc AS send_otp_with_twilio,
  'app_otp_verify'::regproc AS verify_otp_with_user_check;

-- Add comment to explain usage
COMMENT ON VIEW auth_functions IS 'This view maps the new function names to the expected names. Use app_otp_send instead of send_otp_with_twilio and app_otp_verify instead of verify_otp_with_user_check.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION app_otp_verify_unique TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app_otp_verify TO authenticated, anon;