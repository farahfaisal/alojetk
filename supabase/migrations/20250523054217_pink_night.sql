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
CREATE OR REPLACE FUNCTION app_otp_verify_final(
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
  phone_column_exists boolean;
  code_column_exists boolean;
  phone_number_column_exists boolean;
  otp_column_exists boolean;
BEGIN
  -- Check which columns exist in the otp_codes table
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'otp_codes' AND column_name = 'phone'
  ) INTO phone_column_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'otp_codes' AND column_name = 'code'
  ) INTO code_column_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'otp_codes' AND column_name = 'phone_number'
  ) INTO phone_number_column_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'otp_codes' AND column_name = 'otp'
  ) INTO otp_column_exists;

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
  -- Use the appropriate column names based on what exists in the table
  IF phone_column_exists AND code_column_exists THEN
    -- Use phone and code columns
    SELECT EXISTS (
      SELECT 1
      FROM otp_codes
      WHERE phone = p_phone_number
      AND code = p_otp_code
      AND used = false
      AND expires_at > now()
    ) INTO valid;
  ELSIF phone_number_column_exists AND otp_column_exists THEN
    -- Use phone_number and otp columns
    SELECT EXISTS (
      SELECT 1
      FROM otp_codes
      WHERE phone_number = p_phone_number
      AND otp = p_otp_code
      AND used = false
      AND expires_at > now()
    ) INTO valid;
  ELSE
    -- Fallback to a more generic query that tries both column names
    SELECT EXISTS (
      SELECT 1
      FROM otp_codes
      WHERE (
        (phone_column_exists AND phone = p_phone_number) OR
        (phone_number_column_exists AND phone_number = p_phone_number)
      )
      AND (
        (code_column_exists AND code = p_otp_code) OR
        (otp_column_exists AND otp = p_otp_code)
      )
      AND used = false
      AND expires_at > now()
    ) INTO valid;
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
  IF phone_column_exists AND code_column_exists THEN
    UPDATE otp_codes
    SET used = true
    WHERE phone = p_phone_number
    AND code = p_otp_code
    AND used = false
    AND expires_at > now();
  ELSIF phone_number_column_exists AND otp_column_exists THEN
    UPDATE otp_codes
    SET used = true
    WHERE phone_number = p_phone_number
    AND otp = p_otp_code
    AND used = false
    AND expires_at > now();
  ELSE
    -- Fallback update that tries both column combinations
    IF phone_column_exists THEN
      UPDATE otp_codes
      SET used = true
      WHERE phone = p_phone_number
      AND (
        (code_column_exists AND code = p_otp_code) OR
        (otp_column_exists AND otp = p_otp_code)
      )
      AND used = false
      AND expires_at > now();
    ELSIF phone_number_column_exists THEN
      UPDATE otp_codes
      SET used = true
      WHERE phone_number = p_phone_number
      AND (
        (code_column_exists AND code = p_otp_code) OR
        (otp_column_exists AND otp = p_otp_code)
      )
      AND used = false
      AND expires_at > now();
    END IF;
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

-- Create a new wrapper function
CREATE OR REPLACE FUNCTION app_otp_verify(phone_number text, otp_code text)
RETURNS jsonb AS $$
  SELECT app_otp_verify_final(phone_number, otp_code);
$$ LANGUAGE SQL SECURITY DEFINER;

-- Recreate the view
CREATE OR REPLACE VIEW auth_functions AS
SELECT 
  'app_otp_send'::regproc AS send_otp_with_twilio,
  'app_otp_verify'::regproc AS verify_otp_with_user_check;

-- Add comment to explain usage
COMMENT ON VIEW auth_functions IS 'This view maps the new function names to the expected names. Use app_otp_send instead of send_otp_with_twilio and app_otp_verify instead of verify_otp_with_user_check.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION app_otp_verify_final TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app_otp_verify TO authenticated, anon;