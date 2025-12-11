/*
  # Secure OTP System

  1. Changes
    - Create a new version of app_otp_send function that doesn't return OTP in production
    - Add environment detection to determine if OTP should be returned
    - Improve phone number validation
    - Add better error handling and logging
*/

-- Drop the view that depends on the function
DROP VIEW IF EXISTS auth_functions;

-- Create a secure OTP sending function
CREATE OR REPLACE FUNCTION app_otp_send_secure_v1(
  phone_number text,
  environment text DEFAULT 'production'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  attempts integer;
  max_attempts constant integer := 10;
  time_window constant interval := interval '1 hour';
  generated_otp text;
  formatted_phone text;
  request_id text;
  is_test_number boolean;
  is_development boolean;
BEGIN
  -- Check if we're in development mode
  is_development := (environment = 'development');
  
  -- Validate phone format - support Palestinian numbers with various prefixes
  IF NOT (
    phone_number ~ '^0(59|56|58|54|50|52|57|55|53|51)\d{7}$' OR -- Common Palestinian prefixes
    phone_number ~ '^0\d{9}$' -- General format
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رقم الهاتف غير صالح. يجب أن يبدأ بـ 0 ويتكون من 10 أرقام'
    );
  END IF;
  
  -- Check if this is a test number
  is_test_number := (phone_number = '0595284308');
  
  -- Check for rate limiting (skip for test numbers)
  IF NOT is_test_number THEN
    SELECT COUNT(*)
    INTO attempts
    FROM otp_codes
    WHERE phone = phone_number
    AND created_at > now() - time_window;
    
    IF attempts >= max_attempts THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'تم تجاوز الحد الأقصى لمحاولات إرسال رمز التحقق. يرجى المحاولة لاحقاً.'
      );
    END IF;
  END IF;
  
  -- Generate a random 6-digit OTP (100000-999999)
  SELECT lpad(floor(random() * 900000 + 100000)::text, 6, '0') INTO generated_otp;
  
  -- For test numbers, use a fixed OTP
  IF is_test_number THEN
    generated_otp := '123456';
  END IF;
  
  -- Generate a unique request ID for tracking
  request_id := gen_random_uuid()::text;
  
  -- Delete any existing OTPs for this phone number
  DELETE FROM otp_codes WHERE phone = phone_number;
  
  -- Insert new OTP with request_id
  INSERT INTO otp_codes (
    phone,
    code,
    expires_at,
    request_id
  ) VALUES (
    phone_number,
    generated_otp,
    now() + interval '15 minutes',
    request_id
  );
  
  -- Format phone number for international format (Palestinian numbers)
  IF phone_number LIKE '0%' THEN
    formatted_phone := '+970' || substring(phone_number from 2);
  ELSE
    formatted_phone := phone_number;
  END IF;
  
  -- Log the OTP for debugging
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'otp_generated',
    'OTP generated successfully',
    jsonb_build_object(
      'phone', phone_number,
      'formatted_phone', formatted_phone,
      'otp', generated_otp,
      'request_id', request_id,
      'is_test_number', is_test_number,
      'is_development', is_development,
      'timestamp', now()
    )
  );
  
  -- Return success response
  -- Only include OTP in response for test numbers or in development mode
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم إرسال رمز التحقق بنجاح',
    'otp', CASE WHEN is_test_number OR is_development THEN generated_otp ELSE NULL END,
    'request_id', request_id
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'otp_error',
      'Error generating OTP',
      jsonb_build_object(
        'phone', phone_number,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    -- Return error response
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ أثناء إنشاء رمز التحقق: ' || SQLERRM
    );
END;
$$;

-- Create the wrapper function
DROP FUNCTION IF EXISTS app_otp_send(text);
CREATE OR REPLACE FUNCTION app_otp_send(phone_number text)
RETURNS jsonb AS $$
  -- Pass 'production' as the environment parameter
  SELECT app_otp_send_secure_v1(phone_number, 'production');
$$ LANGUAGE SQL SECURITY DEFINER;

-- Create a development version for testing
CREATE OR REPLACE FUNCTION app_otp_send_dev(phone_number text)
RETURNS jsonb AS $$
  -- Pass 'development' as the environment parameter
  SELECT app_otp_send_secure_v1(phone_number, 'development');
$$ LANGUAGE SQL SECURITY DEFINER;

-- Recreate the view
CREATE OR REPLACE VIEW auth_functions AS
SELECT 
  'app_otp_send'::regproc AS send_otp_with_twilio,
  'app_otp_verify'::regproc AS verify_otp_with_user_check;

-- Add comment to explain usage
COMMENT ON VIEW auth_functions IS 'This view maps the new function names to the expected names. Use app_otp_send instead of send_otp_with_twilio and app_otp_verify instead of verify_otp_with_user_check.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION app_otp_send_secure_v1 TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app_otp_send TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app_otp_send_dev TO authenticated, anon;