-- First drop existing functions to avoid parameter name change errors
DROP FUNCTION IF EXISTS send_otp(text);
DROP FUNCTION IF EXISTS verify_otp(text, text);
DROP FUNCTION IF EXISTS generate_and_store_otp(text);

-- Function to send OTP with fixed column references
CREATE OR REPLACE FUNCTION send_otp(phone_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  generated_otp text;
  sms_result record;
  is_test_number boolean;
  standardized_phone text;
  formatted_phone text;
BEGIN
  -- Standardize phone number to local format
  standardized_phone := standardize_phone_number(phone_number);
  
  -- Validate phone format - support Palestinian numbers with various prefixes
  IF NOT (
    standardized_phone ~ '^0(59|56|58|54|50|52|57|55|53|51)\d{7}$' OR -- Common Palestinian prefixes
    standardized_phone ~ '^0\d{9}$' -- General format
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'رقم الهاتف غير صالح. يجب أن يبدأ بـ 0 ويتكون من 10 أرقام'
    );
  END IF;
  
  -- Check if this is a test number
  is_test_number := is_test_phone_number(standardized_phone);
  
  -- Generate and store OTP
  generated_otp := generate_and_store_otp(standardized_phone);
  
  -- Format for international sending
  formatted_phone := format_phone_to_international(standardized_phone);
  
  -- Send SMS with the OTP
  SELECT * FROM send_twilio_sms(
    formatted_phone,
    'رمز التحقق الخاص بك هو: ' || generated_otp || '. صالح لمدة 15 دقيقة.'
  ) INTO sms_result;
  
  -- Log the OTP sending
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'otp_sent',
    'OTP sent via Twilio',
    jsonb_build_object(
      'phone', standardized_phone,
      'formatted_phone', formatted_phone,
      'sms_success', sms_result.success,
      'sms_message', sms_result.message,
      'sms_sid', sms_result.sid,
      'is_test_number', is_test_number,
      'timestamp', now()
    )
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
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'otp_error',
      'Error sending OTP',
      jsonb_build_object(
        'phone', standardized_phone,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'حدث خطأ أثناء إرسال رمز التحقق: ' || SQLERRM
    );
END;
$$;

-- Function to verify OTP with fixed column references
CREATE OR REPLACE FUNCTION verify_otp(phone_number text, otp_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stored_otp record;
  customer_exists boolean;
  standardized_phone text;
  customer_record record;
BEGIN
  -- Standardize phone number to local format
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
  
  -- Get stored OTP using table alias to avoid ambiguity
  SELECT * INTO stored_otp
  FROM stored_otps s
  WHERE s.phone_number = standardized_phone
  AND s.otp_code = otp_code
  AND NOT s.is_used
  AND s.expires_at > now();
  
  -- Check if OTP exists and is valid
  IF stored_otp IS NULL THEN
    -- Log failed verification
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'otp_verification_failed',
      'OTP verification failed',
      jsonb_build_object(
        'phone', standardized_phone,
        'timestamp', now()
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز التحقق غير صحيح أو منتهي الصلاحية'
    );
  END IF;
  
  -- Mark OTP as used
  UPDATE stored_otps
  SET is_used = true
  WHERE id = stored_otp.id;
  
  -- Check if customer exists
  SELECT EXISTS (
    SELECT 1 FROM customers c WHERE c.phone = standardized_phone
  ) INTO customer_exists;
  
  -- Get customer data if exists
  IF customer_exists THEN
    SELECT * INTO customer_record
    FROM customers c
    WHERE c.phone = standardized_phone;
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
      'phone', standardized_phone,
      'existing_user', customer_exists,
      'timestamp', now()
    )
  );
  
  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم التحقق بنجاح',
    'existing_user', customer_exists,
    'user', CASE WHEN customer_exists THEN 
      jsonb_build_object(
        'id', customer_record.id,
        'name', customer_record.name,
        'phone', customer_record.phone,
        'email', customer_record.email
      )
    ELSE NULL END
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
        'phone', standardized_phone,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ أثناء التحقق من الرمز: ' || SQLERRM
    );
END;
$$;

-- Function to generate and store OTP with fixed column references
CREATE OR REPLACE FUNCTION generate_and_store_otp(phone_number text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_otp text;
  is_test_number boolean;
BEGIN
  -- Check if this is a test number
  is_test_number := is_test_phone_number(phone_number);
  
  -- Generate OTP (fixed for test numbers)
  IF is_test_number THEN
    new_otp := '123456';
  ELSE
    -- Generate a random 6-digit OTP
    new_otp := lpad(floor(random() * 900000 + 100000)::text, 6, '0');
  END IF;
  
  -- Delete any existing OTPs for this phone number
  DELETE FROM stored_otps s WHERE s.phone_number = phone_number;
  
  -- Insert new OTP
  INSERT INTO stored_otps (
    phone_number,
    otp_code,
    expires_at
  ) VALUES (
    phone_number,
    new_otp,
    now() + interval '15 minutes'
  );
  
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
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION send_otp(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION verify_otp(text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION generate_and_store_otp(text) TO service_role;