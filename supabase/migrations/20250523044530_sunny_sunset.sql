/*
  # Add OTP Generation Function
  
  1. New Functions
    - `app_generate_otp` - Function to generate and store OTP codes
  
  2. Changes
    - Creates a function that's compatible with the existing Edge Function
    - Handles phone validation, OTP generation, and storage
    - Returns the generated OTP for use in the Edge Function
*/

-- Create function to generate OTP
CREATE OR REPLACE FUNCTION app_generate_otp(input_phone text)
RETURNS TABLE (
  otp text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  generated_otp text;
  expires timestamptz;
  is_test_number boolean;
  attempts integer;
  max_attempts constant integer := 15;
  time_window constant interval := interval '1 hour';
BEGIN
  -- Validate phone format - support Palestinian numbers with various prefixes
  IF NOT (
    input_phone ~ '^0(59|56|58|54|50|52|57|55|53|51)\d{7}$' OR -- Common Palestinian prefixes
    input_phone ~ '^0\d{9}$' -- General format
  ) THEN
    RAISE EXCEPTION 'رقم الهاتف غير صالح. يجب أن يبدأ بـ 0 ويتكون من 10 أرقام';
  END IF;
  
  -- Check if this is a test number
  is_test_number := (input_phone = '0595284308');
  
  -- Check for rate limiting (skip for test numbers)
  IF NOT is_test_number THEN
    SELECT COUNT(*)
    INTO attempts
    FROM otp_codes
    WHERE phone = input_phone
    AND created_at > now() - time_window;
    
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'تم تجاوز الحد الأقصى لمحاولات إرسال رمز التحقق. يرجى المحاولة لاحقاً.';
    END IF;
  END IF;
  
  -- Generate a random 6-digit OTP (100000-999999)
  SELECT lpad(floor(random() * 900000 + 100000)::text, 6, '0') INTO generated_otp;
  
  -- For test number, always use 123456
  IF is_test_number THEN
    generated_otp := '123456';
  END IF;
  
  -- Set expiration time (15 minutes from now)
  expires := now() + interval '15 minutes';
  
  -- Delete any existing OTPs for this phone number
  DELETE FROM otp_codes WHERE phone = input_phone;
  
  -- Insert new OTP
  INSERT INTO otp_codes (
    phone,
    code,
    expires_at,
    request_id
  ) VALUES (
    input_phone,
    generated_otp,
    expires,
    gen_random_uuid()::text
  );
  
  -- Log the OTP for debugging
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'otp_generated',
    'OTP generated via app_generate_otp function',
    jsonb_build_object(
      'phone', input_phone,
      'otp', generated_otp,
      'expires_at', expires,
      'is_test_number', is_test_number,
      'timestamp', now()
    )
  );
  
  -- Return the generated OTP
  RETURN QUERY SELECT generated_otp;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'otp_error',
      'Error in app_generate_otp function',
      jsonb_build_object(
        'phone', input_phone,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    -- Re-raise the exception
    RAISE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION app_generate_otp TO authenticated, anon, service_role;