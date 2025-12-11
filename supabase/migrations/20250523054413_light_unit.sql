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
    AND p.proname IN ('app_otp_verify', 'app_otp_verify_fixed', 'app_otp_verify_fixed_v2', 'app_otp_verify_fixed_v3', 'app_otp_verify_unique', 'app_otp_verify_final')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.' || func_record.proname || '(' || func_record.args || ') CASCADE';
    RAISE NOTICE 'Dropped function %(%)', func_record.proname, func_record.args;
  END LOOP;
END $$;

-- Create a completely new function with a unique name
CREATE OR REPLACE FUNCTION app_otp_verify_v3(
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
  query_text text;
  update_text text;
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
  
  -- Build the query dynamically based on which columns exist
  IF phone_column_exists AND code_column_exists THEN
    query_text := 'SELECT EXISTS (
      SELECT 1 FROM otp_codes
      WHERE phone = $1 AND code = $2 AND used = false AND expires_at > now()
    )';
    update_text := 'UPDATE otp_codes SET used = true 
      WHERE phone = $1 AND code = $2 AND used = false AND expires_at > now()';
  ELSIF phone_number_column_exists AND otp_column_exists THEN
    query_text := 'SELECT EXISTS (
      SELECT 1 FROM otp_codes
      WHERE phone_number = $1 AND otp = $2 AND used = false AND expires_at > now()
    )';
    update_text := 'UPDATE otp_codes SET used = true 
      WHERE phone_number = $1 AND otp = $2 AND used = false AND expires_at > now()';
  ELSE
    -- Fallback query that tries both column combinations
    query_text := 'SELECT EXISTS (
      SELECT 1 FROM otp_codes
      WHERE (
        ' || CASE WHEN phone_column_exists THEN 'phone = $1' ELSE 'false' END || ' OR
        ' || CASE WHEN phone_number_column_exists THEN 'phone_number = $1' ELSE 'false' END || '
      ) AND (
        ' || CASE WHEN code_column_exists THEN 'code = $2' ELSE 'false' END || ' OR
        ' || CASE WHEN otp_column_exists THEN 'otp = $2' ELSE 'false' END || '
      ) AND used = false AND expires_at > now()
    )';
    
    update_text := 'UPDATE otp_codes SET used = true 
      WHERE (
        ' || CASE WHEN phone_column_exists THEN 'phone = $1' ELSE 'false' END || ' OR
        ' || CASE WHEN phone_number_column_exists THEN 'phone_number = $1' ELSE 'false' END || '
      ) AND (
        ' || CASE WHEN code_column_exists THEN 'code = $2' ELSE 'false' END || ' OR
        ' || CASE WHEN otp_column_exists THEN 'otp = $2' ELSE 'false' END || '
      ) AND used = false AND expires_at > now()';
  END IF;
  
  -- Check if OTP exists, is not used, and has not expired
  EXECUTE query_text INTO valid USING p_phone_number, p_otp_code;
  
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
  EXECUTE update_text USING p_phone_number, p_otp_code;
  
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

-- Create a new wrapper function with a completely different name to avoid conflicts
CREATE OR REPLACE FUNCTION app_verify_otp(phone_number text, otp_code text)
RETURNS jsonb AS $$
  SELECT app_otp_verify_v3(phone_number, otp_code);
$$ LANGUAGE SQL SECURITY DEFINER;

-- Recreate the view with the new function name
CREATE OR REPLACE VIEW auth_functions AS
SELECT 
  'app_otp_send'::regproc AS send_otp_with_twilio,
  'app_verify_otp'::regproc AS verify_otp_with_user_check;

-- Add comment to explain usage
COMMENT ON VIEW auth_functions IS 'This view maps the new function names to the expected names. Use app_otp_send instead of send_otp_with_twilio and app_verify_otp instead of verify_otp_with_user_check.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION app_otp_verify_v3 TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app_verify_otp TO authenticated, anon;