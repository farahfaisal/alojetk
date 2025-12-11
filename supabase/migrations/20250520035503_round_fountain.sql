/*
  # Add missing send_otp_with_twilio function
  
  1. New Functions
    - `send_otp_with_twilio` - Function to generate and send OTP codes
    
  2. Changes
    - Creates a function that's compatible with the existing auth flow
    - Handles phone validation, rate limiting, and OTP generation
    - Logs OTPs for development purposes
*/

-- Function to send OTP via Twilio (mock version for development)
CREATE OR REPLACE FUNCTION send_otp_with_twilio(
  phone_number text,
  otp text DEFAULT NULL,
  OUT success boolean,
  OUT message text,
  OUT otp_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  attempts integer;
  max_attempts constant integer := 5;
  time_window constant interval := interval '1 hour';
  generated_otp text;
BEGIN
  success := false;
  
  -- Validate phone format
  IF NOT phone_number ~ '^0\d{9}$' THEN
    message := 'رقم الهاتف غير صالح';
    RETURN;
  END IF;
  
  -- Check for rate limiting
  SELECT COUNT(*)
  INTO attempts
  FROM otp_codes
  WHERE phone = phone_number
  AND created_at > now() - time_window;
  
  IF attempts >= max_attempts THEN
    message := 'تم تجاوز الحد الأقصى لمحاولات إرسال رمز التحقق. يرجى المحاولة لاحقاً.';
    RETURN;
  END IF;
  
  -- Generate a random 6-digit OTP if not provided
  IF otp IS NULL THEN
    SELECT lpad(floor(random() * 1000000)::text, 6, '0') INTO generated_otp;
  ELSE
    generated_otp := otp;
  END IF;
  
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
  
  -- In a real implementation, this would call Twilio API
  -- For development, we just log the OTP and return success
  
  -- Log the OTP for debugging (in production, you would remove this)
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'otp_generated',
    'OTP generated for development',
    jsonb_build_object(
      'phone', phone_number,
      'otp', generated_otp
    )
  );
  
  success := true;
  message := 'تم إرسال رمز التحقق بنجاح';
  otp_code := generated_otp;
  
  RETURN;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION send_otp_with_twilio TO authenticated, anon;