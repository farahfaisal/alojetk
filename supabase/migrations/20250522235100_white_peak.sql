/*
  # Fix OTP System with Improved Functions
  
  1. New Functions
    - `app_send_sms` - Function to send SMS messages (simulated for development)
    - `app_otp_send_v2` - Improved OTP sending function with better error handling
  
  2. Changes
    - Updates the auth_functions view to use the new functions
    - Preserves backward compatibility
    - Adds better logging and error handling
*/

-- Create a function to send SMS messages
CREATE OR REPLACE FUNCTION app_send_sms(
  to_phone text,
  message_body text,
  OUT success boolean,
  OUT message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- For development, we'll just simulate success
  -- In production, this would integrate with an SMS provider API
  success := true;
  message := 'تم إرسال الرسالة بنجاح (محاكاة)';
  
  -- Log the SMS for development purposes
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'sms_sent',
    'SMS sent (simulated for development)',
    jsonb_build_object(
      'to', to_phone,
      'message', message_body,
      'timestamp', now()
    )
  );
  
  RETURN;
END;
$$;

-- Create an improved OTP sending function
CREATE OR REPLACE FUNCTION app_otp_send_v2(
  phone_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  attempts integer;
  max_attempts constant integer := 5;
  time_window constant interval := interval '1 hour';
  generated_otp text;
  sms_result record;
  formatted_phone text;
BEGIN
  -- Validate phone format
  IF NOT phone_number ~ '^0\d{9}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رقم الهاتف غير صالح'
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
  
  -- Generate a random 6-digit OTP
  SELECT lpad(floor(random() * 1000000)::text, 6, '0') INTO generated_otp;
  
  -- Delete any existing OTPs for this phone number
  DELETE FROM otp_codes WHERE phone = phone_number;
  
  -- Insert new OTP
  INSERT INTO otp_codes (
    phone,
    code,
    expires_at
  ) VALUES (
    phone_number,
    generated_otp,
    now() + interval '5 minutes'
  );
  
  -- Format phone number for international format
  IF phone_number LIKE '0%' THEN
    formatted_phone := '+972' || substring(phone_number from 2);
  ELSE
    formatted_phone := phone_number;
  END IF;
  
  -- Send SMS
  SELECT * FROM app_send_sms(
    formatted_phone,
    'رمز التحقق الخاص بك هو: ' || generated_otp || '. صالح لمدة 5 دقائق.'
  ) INTO sms_result;
  
  -- Log the OTP for debugging
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'otp_generated',
    'OTP generated and ' || CASE WHEN sms_result.success THEN 'sent' ELSE 'failed to send' END,
    jsonb_build_object(
      'phone', phone_number,
      'formatted_phone', formatted_phone,
      'otp', generated_otp,
      'sms_success', sms_result.success,
      'sms_message', sms_result.message
    )
  );
  
  -- Return success response with the OTP for development
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم إرسال رمز التحقق بنجاح',
    'otp', generated_otp,
    'sms_sent', sms_result.success
  );
END;
$$;

-- Create a wrapper function with the original name
-- First drop the view that depends on the function
DROP VIEW IF EXISTS auth_functions;

-- Now we can safely replace the function
DROP FUNCTION IF EXISTS app_otp_send(text);
CREATE OR REPLACE FUNCTION app_otp_send(phone_number text)
RETURNS jsonb AS $$
  SELECT app_otp_send_v2(phone_number);
$$ LANGUAGE SQL SECURITY DEFINER;

-- Recreate the view
CREATE OR REPLACE VIEW auth_functions AS
SELECT 
  'app_otp_send'::regproc AS send_otp_with_twilio,
  'app_otp_verify'::regproc AS verify_otp_with_user_check;

-- Add comment to explain usage
COMMENT ON VIEW auth_functions IS 'This view maps the new function names to the expected names. Use app_otp_send instead of send_otp_with_twilio and app_otp_verify instead of verify_otp_with_user_check.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION app_send_sms TO service_role;
GRANT EXECUTE ON FUNCTION app_otp_send_v2 TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app_otp_send TO authenticated, anon;