/*
  # Fix OTP Verification Function
  
  1. Changes
    - Drop existing verify_stored_otp function first
    - Create a new version with explicit parameter names to avoid ambiguity
    - Add better error handling and logging
    - Return more detailed user information
  
  2. Security
    - Maintain SECURITY DEFINER attribute for proper access control
    - Grant appropriate permissions
*/

-- First drop the existing function to avoid return type error
DROP FUNCTION IF EXISTS verify_stored_otp(text, text);

-- Create a new function with explicit parameter names
CREATE OR REPLACE FUNCTION verify_stored_otp_v2(
  p_phone_number text,
  p_otp_code text,
  OUT success boolean,
  OUT message text,
  OUT existing_user boolean,
  OUT user_data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  otp_record record;
  customer_record record;
BEGIN
  -- Initialize output parameters
  success := false;
  message := 'رمز التحقق غير صحيح أو منتهي الصلاحية';
  existing_user := false;
  user_data := null;
  
  -- Check if OTP exists, is not used, and has not expired
  -- Use table alias to avoid ambiguity
  SELECT *
  INTO otp_record
  FROM stored_otps s
  WHERE s.phone_number = p_phone_number
    AND s.otp_code = p_otp_code
    AND NOT s.is_used
    AND s.expires_at > now();
  
  -- If OTP not found or invalid
  IF otp_record IS NULL THEN
    -- Log failed verification
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
    
    RETURN;
  END IF;
  
  -- Mark OTP as used
  UPDATE stored_otps
  SET is_used = true
  WHERE id = otp_record.id;
  
  -- Check if customer exists
  SELECT *
  INTO customer_record
  FROM customers c
  WHERE c.phone = p_phone_number;
  
  -- Set output parameters for success
  success := true;
  message := 'تم التحقق بنجاح';
  existing_user := customer_record IS NOT NULL;
  
  -- If customer exists, return their data
  IF customer_record IS NOT NULL THEN
    user_data := jsonb_build_object(
      'id', customer_record.id,
      'name', customer_record.name,
      'email', customer_record.email,
      'phone', customer_record.phone
    );
  END IF;
  
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
      'existing_user', existing_user,
      'timestamp', now()
    )
  );
  
  RETURN;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error
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
    
    -- Set error output parameters
    success := false;
    message := 'حدث خطأ أثناء التحقق من الرمز: ' || SQLERRM;
    existing_user := false;
    user_data := null;
    
    RETURN;
END;
$$;

-- Create a wrapper function with the original name
CREATE OR REPLACE FUNCTION verify_stored_otp(
  phone_number text,
  otp_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result record;
BEGIN
  -- Call the new function with explicit parameter names
  SELECT * FROM verify_stored_otp_v2(phone_number, otp_code) INTO result;
  
  -- Return the result as jsonb
  RETURN jsonb_build_object(
    'success', result.success,
    'message', result.message,
    'existing_user', result.existing_user,
    'user', result.user_data
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION verify_stored_otp_v2(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION verify_stored_otp(text, text) TO service_role;