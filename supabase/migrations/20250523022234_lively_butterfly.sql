/*
  # Add request_id column to otp_codes table

  1. Changes
    - Add request_id column to otp_codes table if it doesn't exist
    - Update app_otp_send function to properly handle the request_id column
  
  2. Security
    - Maintain existing RLS policies
    - Keep security definer attribute for proper access control
*/

-- Add request_id column to otp_codes table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'otp_codes' AND column_name = 'request_id'
  ) THEN
    ALTER TABLE otp_codes ADD COLUMN request_id TEXT;
  END IF;
END $$;

-- Drop the view that depends on the function
DROP VIEW IF EXISTS auth_functions;

-- Drop the existing function
DROP FUNCTION IF EXISTS app_otp_send(text);

-- Create an improved version of the OTP sending function
CREATE OR REPLACE FUNCTION app_otp_send_v10(
  phone_number text
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
BEGIN
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
  
  -- Check for rate limiting
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
  
  -- Generate a random 6-digit OTP (100000-999999)
  SELECT lpad(floor(random() * 900000 + 100000)::text, 6, '0') INTO generated_otp;
  
  -- For testing with specific number 0595284308, use a fixed OTP
  IF phone_number = '0595284308' THEN
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
      'timestamp', now()
    )
  );
  
  -- Return success response with the OTP for development
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم إرسال رمز التحقق بنجاح',
    'otp', generated_otp
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
CREATE OR REPLACE FUNCTION app_otp_send(phone_number text)
RETURNS jsonb AS $$
  SELECT app_otp_send_v10(phone_number);
$$ LANGUAGE SQL SECURITY DEFINER;

-- Recreate the view
CREATE OR REPLACE VIEW auth_functions AS
SELECT 
  'app_otp_send'::regproc AS send_otp_with_twilio,
  'app_otp_verify'::regproc AS verify_otp_with_user_check;

-- Add comment to explain usage
COMMENT ON VIEW auth_functions IS 'This view maps the new function names to the expected names. Use app_otp_send instead of send_otp_with_twilio and app_otp_verify instead of verify_otp_with_user_check.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION app_otp_send_v10 TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app_otp_send TO authenticated, anon;