/*
  # Fix OTP Column Ambiguity Error
  
  1. Changes
    - Fix the ambiguous column reference in app_otp_verify function
    - Update the query to use table aliases to avoid ambiguity
    - Improve error handling and logging
  
  2. Security
    - Maintain existing security measures
    - Keep SECURITY DEFINER attribute for proper access control
*/

-- Drop the view that depends on the function
DROP VIEW IF EXISTS auth_functions;

-- Create an improved OTP verification function that fixes the column ambiguity
CREATE OR REPLACE FUNCTION app_otp_verify_fixed(
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
BEGIN
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
  -- Use table alias to avoid ambiguity
  SELECT EXISTS (
    SELECT 1
    FROM otp_codes oc
    WHERE oc.phone_number = p_phone_number
    AND oc.otp = p_otp_code
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
  UPDATE otp_codes
  SET used = true
  WHERE phone_number = p_phone_number
  AND otp = p_otp_code
  AND used = false
  AND expires_at > now();
  
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

-- Update the wrapper function
DROP FUNCTION IF EXISTS app_otp_verify(text, text);
CREATE OR REPLACE FUNCTION app_otp_verify(phone_number text, otp_code text)
RETURNS jsonb AS $$
  SELECT app_otp_verify_fixed(phone_number, otp_code);
$$ LANGUAGE SQL SECURITY DEFINER;

-- Recreate the view
CREATE OR REPLACE VIEW auth_functions AS
SELECT 
  'app_otp_send'::regproc AS send_otp_with_twilio,
  'app_otp_verify'::regproc AS verify_otp_with_user_check;

-- Add comment to explain usage
COMMENT ON VIEW auth_functions IS 'This view maps the new function names to the expected names. Use app_otp_send instead of send_otp_with_twilio and app_otp_verify instead of verify_otp_with_user_check.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION app_otp_verify_fixed TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app_otp_verify TO authenticated, anon;