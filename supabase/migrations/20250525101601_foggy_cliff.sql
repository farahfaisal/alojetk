/*
  # Fix OTP Function Error
  
  1. New Functions
    - `generate_and_store_otp` - Function to generate and store OTP codes
    - `verify_stored_otp` - Function to verify stored OTP codes
  
  2. Changes
    - Add missing functions required by the Edge Function
    - Ensure proper error handling and logging
*/

-- Create or replace the generate_and_store_otp function
CREATE OR REPLACE FUNCTION generate_and_store_otp(phone_number TEXT)
RETURNS TEXT AS $$
DECLARE
  new_otp TEXT;
  is_test_number BOOLEAN;
BEGIN
  -- Check if this is a test number
  is_test_number := (phone_number = '0595284308');
  
  -- Generate OTP (fixed for test numbers)
  IF is_test_number THEN
    new_otp := '123456';
  ELSE
    -- Generate a random 6-digit OTP
    new_otp := lpad(floor(random() * 900000 + 100000)::TEXT, 6, '0');
  END IF;
  
  -- Store in otps table (replacing any existing entry)
  INSERT INTO otps (phone, code, expires_at)
  VALUES (
    phone_number,
    new_otp,
    now() + interval '15 minutes'
  )
  ON CONFLICT (phone) 
  DO UPDATE SET 
    code = EXCLUDED.code,
    expires_at = EXCLUDED.expires_at;
  
  -- Log the OTP generation
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'otp_generated',
    'OTP generated via generate_and_store_otp function',
    jsonb_build_object(
      'phone', phone_number,
      'otp', new_otp,
      'is_test_number', is_test_number,
      'timestamp', now()
    )
  );
  
  RETURN new_otp;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'otp_error',
      'Error in generate_and_store_otp function',
      jsonb_build_object(
        'phone', phone_number,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    -- Re-raise the exception
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the verify_stored_otp function
CREATE OR REPLACE FUNCTION verify_stored_otp(phone_number TEXT, otp_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  stored_otp TEXT;
  expiry_time TIMESTAMP WITHOUT TIME ZONE;
  is_valid BOOLEAN;
BEGIN
  -- Get stored OTP
  SELECT code, expires_at INTO stored_otp, expiry_time
  FROM otps
  WHERE phone = phone_number;
  
  -- Check if OTP exists and is valid
  is_valid := (stored_otp IS NOT NULL AND stored_otp = otp_code AND expiry_time > now());
  
  -- If valid, remove the OTP to prevent reuse
  IF is_valid THEN
    DELETE FROM otps WHERE phone = phone_number;
    
    -- Log successful verification
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'otp_verification_success',
      'OTP verified via verify_stored_otp function',
      jsonb_build_object(
        'phone', phone_number,
        'timestamp', now()
      )
    );
  ELSE
    -- Log failed verification
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'otp_verification_failed',
      'OTP verification failed via verify_stored_otp function',
      jsonb_build_object(
        'phone', phone_number,
        'timestamp', now()
      )
    );
  END IF;
  
  RETURN is_valid;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'otp_verification_error',
      'Error in verify_stored_otp function',
      jsonb_build_object(
        'phone', phone_number,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_and_store_otp TO service_role;
GRANT EXECUTE ON FUNCTION verify_stored_otp TO service_role;