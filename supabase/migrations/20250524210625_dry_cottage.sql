/*
  # Fix OTP System for Palestinian Phone Numbers

  1. Changes
    - Update send_otp function to properly handle Palestinian phone numbers
    - Improve phone number validation and formatting
    - Fix international format conversion for Palestinian numbers
    - Ensure test numbers work correctly
    
  2. Security
    - Maintain existing security policies
    - Keep proper logging for debugging
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
  
  -- Otherwise, return as is
  RETURN phone_number;
END;
$$;

-- Function to check if a phone number is a test number
CREATE OR REPLACE FUNCTION is_test_phone_number(phone_number text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Add any test phone numbers here
  RETURN phone_number = '0595284308';
END;
$$;

-- Function to send SMS directly via Twilio API
CREATE OR REPLACE FUNCTION send_sms_directly(
  to_phone text,
  message_body text,
  OUT success boolean,
  OUT message text,
  OUT sid text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  twilio_account_sid text := 'ACa146325dc7992176135d42bee153b8c8';
  twilio_auth_token text := 'b67e3e4cd93e5ea4baff533c71080b0c';
  twilio_from_number text := '+18777804236';
  formatted_phone text;
  is_test_number boolean;
BEGIN
  -- Format phone number for international format
  formatted_phone := format_phone_to_international(to_phone);
  
  -- Check if this is a test number
  is_test_number := is_test_phone_number(to_phone);
  
  -- Log the SMS attempt
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'sms_attempt',
    'Attempting to send SMS via Twilio',
    jsonb_build_object(
      'to', to_phone,
      'formatted_phone', formatted_phone,
      'is_test_number', is_test_number,
      'timestamp', now()
    )
  );
  
  -- For test numbers, simulate success without sending
  IF is_test_number THEN
    success := TRUE;
    message := 'تم إرسال الرسالة بنجاح (محاكاة للرقم التجريبي)';
    sid := 'TEST_' || md5(random()::text || clock_timestamp()::text)::text;
    
    -- Log the simulated success
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'sms_simulated',
      'SMS simulated for test number',
      jsonb_build_object(
        'to', to_phone,
        'formatted_phone', formatted_phone,
        'sid', sid,
        'timestamp', now()
      )
    );
    
    RETURN;
  END IF;
  
  -- For real numbers, we would make an HTTP request to Twilio API
  -- Since we can't make HTTP requests directly from PostgreSQL functions,
  -- we'll use the Edge Function approach
  
  -- Insert into SMS queue for the Edge Function to process
  INSERT INTO sms_queue (
    to_phone,
    message,
    status,
    next_retry_at
  ) VALUES (
    formatted_phone,
    message_body,
    'pending',
    now()
  );
  
  -- Log the queued SMS
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'sms_queued',
    'SMS queued for Edge Function to send',
    jsonb_build_object(
      'to', to_phone,
      'formatted_phone', formatted_phone,
      'timestamp', now()
    )
  );
  
  success := TRUE;
  message := 'تم تجهيز الرسالة للإرسال';
  sid := 'QUEUED_' || md5(random()::text || clock_timestamp()::text)::text;
  
  RETURN;
EXCEPTION
  WHEN OTHERS THEN
    success := FALSE;
    message := 'فشل في إرسال الرسالة: ' || SQLERRM;
    sid := NULL;
    
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'sms_error',
      'Error sending SMS',
      jsonb_build_object(
        'to', to_phone,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    RETURN;
END;
$$;

-- Function to send OTP
CREATE OR REPLACE FUNCTION send_otp(phone_number text)
RETURNS JSONB AS $$
DECLARE
  generated_otp text;
  sms_result record;
  is_test_number boolean;
  formatted_phone text;
BEGIN
  -- Validate phone format - support Palestinian numbers with various prefixes
  IF NOT (
    phone_number ~ '^0(59|56|58|54|50|52|57|55|53|51)\d{7}$' OR -- Common Palestinian prefixes
    phone_number ~ '^0\d{9}$' OR -- General format
    phone_number ~ '^\+970\d{9}$' -- International format
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'رقم الهاتف غير صالح. يجب أن يبدأ بـ 0 ويتكون من 10 أرقام'
    );
  END IF;
  
  -- Format phone number to standard format (starting with 0)
  IF phone_number LIKE '+970%' THEN
    phone_number := '0' || substring(phone_number from 5);
  END IF;
  
  -- Check if this is a test number
  is_test_number := is_test_phone_number(phone_number);
  
  -- Generate a random 6-digit OTP (100000-999999)
  SELECT lpad(floor(random() * 900000 + 100000)::text, 6, '0') INTO generated_otp;
  
  -- For test numbers, use a fixed OTP
  IF is_test_number THEN
    generated_otp := '123456';
  END IF;
  
  -- Store OTP in database
  INSERT INTO otps (phone, code, expires_at)
  VALUES (
    phone_number,
    generated_otp,
    now() + interval '15 minutes'
  )
  ON CONFLICT (phone) 
  DO UPDATE SET 
    code = EXCLUDED.code,
    expires_at = EXCLUDED.expires_at;
  
  -- Store in logs for debugging
  INSERT INTO otp_logs (phone, otp) 
  VALUES (phone_number, generated_otp);
  
  -- Format for international sending
  formatted_phone := format_phone_to_international(phone_number);
  
  -- Send SMS with the OTP
  SELECT * FROM send_sms_directly(
    formatted_phone,
    'رمز التحقق الخاص بك هو: ' || generated_otp || '. صالح لمدة 15 دقيقة.'
  ) INTO sms_result;
  
  -- Log the OTP generation
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
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'حدث خطأ أثناء إرسال رمز التحقق: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify OTP
CREATE OR REPLACE FUNCTION verify_otp(phone_number text, otp_code text)
RETURNS JSONB AS $$
DECLARE
  stored_otp text;
  expiry_time timestamp without time zone;
  is_valid boolean;
  customer_exists boolean;
  standardized_phone text;
BEGIN
  -- Format phone number to standard format (starting with 0)
  IF phone_number LIKE '+970%' THEN
    standardized_phone := '0' || substring(phone_number from 5);
  ELSE
    standardized_phone := phone_number;
  END IF;
  
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
        'phone', standardized_phone,
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
      'phone', standardized_phone,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION format_phone_to_international TO service_role;
GRANT EXECUTE ON FUNCTION is_test_phone_number TO service_role;
GRANT EXECUTE ON FUNCTION send_sms_directly TO service_role;
GRANT EXECUTE ON FUNCTION send_otp TO authenticated, anon;
GRANT EXECUTE ON FUNCTION verify_otp TO authenticated, anon;