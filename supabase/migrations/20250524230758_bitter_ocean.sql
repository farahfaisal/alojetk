/*
  # Fix Phone Number Formats for OTP System
  
  1. Changes
    - Add functions to standardize and format phone numbers
    - Update send_otp and verify_otp functions to handle both formats
    - Support +970 and 0 prefixes for Palestinian numbers
  
  2. Security
    - Maintain existing security policies
    - Ensure proper error handling and logging
*/

-- Function to format phone number to international format
CREATE OR REPLACE FUNCTION format_phone_to_international(phone_number text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  formatted_phone text;
BEGIN
  -- If already in international format, return as is
  IF phone_number LIKE '+%' THEN
    RETURN phone_number;
  END IF;
  
  -- If starts with 0, replace with +970
  IF phone_number LIKE '0%' THEN
    formatted_phone := '+970' || substring(phone_number from 2);
    RETURN formatted_phone;
  END IF;
  
  -- If starts with 970 without +, add +
  IF phone_number LIKE '970%' THEN
    formatted_phone := '+' || phone_number;
    RETURN formatted_phone;
  END IF;
  
  -- Otherwise, assume it's a Palestinian number without prefix
  -- and add +970
  RETURN '+970' || phone_number;
END;
$$;

-- Function to standardize phone number to local format (starting with 0)
CREATE OR REPLACE FUNCTION standardize_phone_number(phone_number text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If already in local format, return as is
  IF phone_number LIKE '0%' THEN
    RETURN phone_number;
  END IF;
  
  -- If in international format with +970, convert to local
  IF phone_number LIKE '+970%' THEN
    RETURN '0' || substring(phone_number from 5);
  END IF;
  
  -- If starts with 970 without +, convert to local
  IF phone_number LIKE '970%' THEN
    RETURN '0' || substring(phone_number from 4);
  END IF;
  
  -- Otherwise, assume it's already a local number without 0
  -- and add 0
  RETURN '0' || phone_number;
END;
$$;

-- Update the send_otp function to handle both formats
CREATE OR REPLACE FUNCTION send_otp(phone_number text)
RETURNS JSONB AS $$
DECLARE
  generated_otp text;
  sms_result record;
  is_test_number boolean;
  formatted_phone text;
  standardized_phone text;
BEGIN
  -- Standardize phone number to local format (starting with 0)
  standardized_phone := standardize_phone_number(phone_number);
  
  -- Validate phone format
  IF NOT standardized_phone ~ '^0\d{9}$' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'رقم الهاتف غير صالح. يجب أن يتكون من 10 أرقام'
    );
  END IF;
  
  -- Check if this is a test number
  is_test_number := (standardized_phone = '0595284308');
  
  -- Generate a random 6-digit OTP (100000-999999)
  SELECT lpad(floor(random() * 900000 + 100000)::text, 6, '0') INTO generated_otp;
  
  -- For test numbers, use a fixed OTP
  IF is_test_number THEN
    generated_otp := '123456';
  END IF;
  
  -- Store OTP in database using standardized phone
  INSERT INTO otps (phone, code, expires_at)
  VALUES (
    standardized_phone,
    generated_otp,
    now() + interval '15 minutes'
  )
  ON CONFLICT (phone) 
  DO UPDATE SET 
    code = EXCLUDED.code,
    expires_at = EXCLUDED.expires_at;
  
  -- Store in logs for debugging
  INSERT INTO otp_logs (phone, otp) 
  VALUES (standardized_phone, generated_otp);
  
  -- Format for international sending
  formatted_phone := format_phone_to_international(standardized_phone);
  
  -- Log the OTP generation
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'otp_generated',
    'OTP generated successfully',
    jsonb_build_object(
      'phone', phone_number,
      'standardized_phone', standardized_phone,
      'formatted_phone', formatted_phone,
      'otp', generated_otp,
      'is_test_number', is_test_number,
      'timestamp', now()
    )
  );
  
  -- Queue SMS for sending with international format
  INSERT INTO sms_queue (
    to_phone,
    message,
    status,
    next_retry_at
  ) VALUES (
    formatted_phone,
    'رمز التحقق الخاص بك هو: ' || generated_otp || '. صالح لمدة 15 دقيقة.',
    'pending',
    now()
  );
  
  -- Return success response
  -- Only include OTP in response for test numbers
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'تم إرسال رمز التحقق بنجاح',
    'otp', CASE WHEN is_test_number THEN generated_otp ELSE NULL END
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'حدث خطأ أثناء إرسال رمز التحقق: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the verify_otp function to handle both formats
CREATE OR REPLACE FUNCTION verify_otp(phone_number text, otp_code text)
RETURNS JSONB AS $$
DECLARE
  stored_otp text;
  expiry_time timestamp without time zone;
  is_valid boolean;
  customer_exists boolean;
  standardized_phone text;
BEGIN
  -- Standardize phone number to local format (starting with 0)
  standardized_phone := standardize_phone_number(phone_number);
  
  -- Validate inputs
  IF NOT standardized_phone ~ '^0\d{9}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رقم الهاتف غير صالح'
    );
  END IF;
  
  IF NOT otp_code ~ '^\d{6}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز التحقق غير صالح'
    );
  END IF;
  
  -- Get stored OTP
  SELECT code, expires_at INTO stored_otp, expiry_time
  FROM otps
  WHERE phone = standardized_phone;
  
  -- Check if OTP exists and is valid
  is_valid := (stored_otp IS NOT NULL AND stored_otp = otp_code AND expiry_time > now());
  
  IF NOT is_valid THEN
    -- Log failed verification
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'otp_verification_failed',
      'OTP verification failed',
      jsonb_build_object(
        'phone', phone_number,
        'standardized_phone', standardized_phone,
        'timestamp', now()
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز التحقق غير صحيح أو منتهي الصلاحية'
    );
  END IF;
  
  -- If valid, remove the OTP to prevent reuse
  DELETE FROM otps WHERE phone = standardized_phone;
  
  -- Check if customer exists
  SELECT EXISTS (
    SELECT 1 FROM customers WHERE phone = standardized_phone
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
      'phone', phone_number,
      'standardized_phone', standardized_phone,
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
    -- Log error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'otp_verification_error',
      'Error verifying OTP',
      jsonb_build_object(
        'phone', phone_number,
        'standardized_phone', standardized_phone,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ أثناء التحقق من الرمز: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION format_phone_to_international TO service_role;
GRANT EXECUTE ON FUNCTION standardize_phone_number TO service_role;
GRANT EXECUTE ON FUNCTION send_otp TO authenticated, anon;
GRANT EXECUTE ON FUNCTION verify_otp TO authenticated, anon;