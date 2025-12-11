-- First check if the table exists and rename columns for consistency
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'otp_codes'
  ) THEN
    -- Rename columns to use consistent naming
    -- First check if 'phone' column exists and 'phone_number' doesn't
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'otp_codes' AND column_name = 'phone'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'otp_codes' AND column_name = 'phone_number'
    ) THEN
      ALTER TABLE otp_codes RENAME COLUMN phone TO phone_number;
    END IF;
    
    -- Check if 'code' column exists and 'otp' doesn't
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'otp_codes' AND column_name = 'code'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'otp_codes' AND column_name = 'otp'
    ) THEN
      ALTER TABLE otp_codes RENAME COLUMN code TO otp;
    END IF;
  END IF;
END $$;

-- Drop the view that depends on the functions
DROP VIEW IF EXISTS auth_functions;

-- Drop all existing OTP verification functions to avoid conflicts
DO $$ 
DECLARE
  func_record record;
BEGIN
  -- Find and drop all functions with specific names
  FOR func_record IN 
    SELECT proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND (
      p.proname LIKE 'app\_otp\_verify%' OR 
      p.proname LIKE 'app\_verify\_otp%'
    )
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.' || func_record.proname || '(' || func_record.args || ') CASCADE';
    RAISE NOTICE 'Dropped function %(%)', func_record.proname, func_record.args;
  END LOOP;
END $$;

-- Create a new OTP verification function with parameter names that don't conflict with column names
CREATE OR REPLACE FUNCTION app_verify_otp_impl(
  in_phone text,
  in_otp text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  valid boolean;
  customer_exists boolean;
BEGIN
  -- Validate phone format
  IF NOT in_phone ~ '^0\d{9}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رقم الهاتف غير صالح'
    );
  END IF;
  
  -- Validate OTP format
  IF NOT in_otp ~ '^\d{6}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز التحقق غير صالح'
    );
  END IF;
  
  -- Check if OTP exists, is not used, and has not expired
  -- Use table alias to avoid ambiguity
  SELECT EXISTS (
    SELECT 1
    FROM otp_codes oc
    WHERE oc.phone_number = in_phone
    AND oc.otp = in_otp
    AND oc.used = false
    AND oc.expires_at > now()
  ) INTO valid;
  
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
        'phone', in_phone,
        'timestamp', now()
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز التحقق غير صحيح أو منتهي الصلاحية'
    );
  END IF;
  
  -- Mark OTP as used
  UPDATE otp_codes oc
  SET used = true
  WHERE oc.phone_number = in_phone
  AND oc.otp = in_otp
  AND oc.used = false
  AND oc.expires_at > now();
  
  -- Check if customer exists
  SELECT EXISTS (
    SELECT 1 FROM customers WHERE phone = in_phone
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
      'phone', in_phone,
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
        'phone', in_phone,
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

-- Create wrapper function with the expected name
CREATE OR REPLACE FUNCTION app_otp_verify(phone_number text, otp_code text)
RETURNS jsonb AS $$
  SELECT app_verify_otp_impl(phone_number, otp_code);
$$ LANGUAGE SQL SECURITY DEFINER;

-- Recreate the view
CREATE OR REPLACE VIEW auth_functions AS
SELECT 
  'app_otp_send'::regproc AS send_otp_with_twilio,
  'app_otp_verify'::regproc AS verify_otp_with_user_check;

-- Add comment to explain usage
COMMENT ON VIEW auth_functions IS 'This view maps the new function names to the expected names. Use app_otp_send instead of send_otp_with_twilio and app_otp_verify instead of verify_otp_with_user_check.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION app_verify_otp_impl TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app_otp_verify TO authenticated, anon;