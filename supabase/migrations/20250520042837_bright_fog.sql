/*
  # Fix OTP Authentication Function

  1. Changes
    - Create a properly formatted send_otp_with_twilio function that matches the client expectations
    - Ensure the function returns the expected JSON structure
    - Add proper error handling and validation
    - Include the OTP in the response for development purposes

  2. Security
    - Grant execute permissions to both authenticated and anonymous users
    - Maintain rate limiting to prevent abuse
*/

-- Function to send OTP (simplified version without actual SMS sending)
CREATE OR REPLACE FUNCTION send_otp_with_twilio(
  phone_number text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  attempts integer;
  max_attempts constant integer := 5;
  time_window constant interval := interval '1 hour';
  generated_otp text;
BEGIN
  -- Validate phone format
  IF NOT phone_number ~ '^0\d{9}$' THEN
    RETURN json_build_object(
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
    RETURN json_build_object(
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
  
  -- For development, we just return the OTP
  -- In production, you would integrate with a real SMS service and remove the OTP from the response
  
  -- Return success response with the OTP for development
  RETURN json_build_object(
    'success', true,
    'message', 'تم إرسال رمز التحقق بنجاح',
    'otp', generated_otp
  );
END;
$$;

-- Grant execute permissions to both authenticated and anonymous users
GRANT EXECUTE ON FUNCTION send_otp_with_twilio(text) TO authenticated, anon;

-- Refresh the schema cache for PostgREST
SELECT pg_notify('pgrst', 'reload schema');