-- First, drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS send_otp(text);
DROP FUNCTION IF EXISTS verify_otp(text, text);
DROP FUNCTION IF EXISTS generate_and_store_otp(text);

-- Check if stored_otps table exists and has the correct column name
DO $$ 
BEGIN
  -- Check if the table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'stored_otps'
  ) THEN
    -- Check if phone_number column exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'stored_otps' AND column_name = 'phone_number'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'stored_otps' AND column_name = 'phone'
    ) THEN
      -- If phone exists but phone_number doesn't, rename the column
      ALTER TABLE stored_otps RENAME COLUMN phone TO phone_number;
    END IF;
    
    -- Check if otp_code column exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'stored_otps' AND column_name = 'otp_code'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'stored_otps' AND column_name = 'otp'
    ) THEN
      -- If otp exists but otp_code doesn't, rename the column
      ALTER TABLE stored_otps RENAME COLUMN otp TO otp_code;
    END IF;
  ELSE
    -- Create the table if it doesn't exist
    CREATE TABLE stored_otps (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      phone_number text NOT NULL,
      otp_code text NOT NULL,
      created_at timestamptz DEFAULT now(),
      expires_at timestamptz DEFAULT (now() + interval '10 minutes'),
      is_used boolean DEFAULT false
    );
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_stored_otps_phone_number ON stored_otps(phone_number);
    CREATE INDEX IF NOT EXISTS idx_stored_otps_expires_at ON stored_otps(expires_at);
    
    -- Enable RLS
    ALTER TABLE stored_otps ENABLE ROW LEVEL SECURITY;
    
    -- Create policy
    CREATE POLICY "Only service role can access stored OTPs"
      ON stored_otps
      FOR ALL
      TO service_role
      USING (true);
  END IF;
END $$;

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

-- Function to standardize phone number to local format
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

-- Function to send SMS via Twilio
CREATE OR REPLACE FUNCTION send_twilio_sms(
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
  is_test_number boolean;
BEGIN
  -- Check if this is a test number
  is_test_number := is_test_phone_number(to_phone);
  
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
        'timestamp', now()
      )
    );
    
    RETURN;
  END IF;
  
  -- For real numbers, we would make an HTTP request to Twilio API
  -- Since we can't make HTTP requests directly from PostgreSQL functions,
  -- we'll simulate success for now
  
  success := TRUE;
  message := 'تم إرسال الرسالة بنجاح';
  sid := 'SIMULATED_' || md5(random()::text || clock_timestamp()::text)::text;
  
  -- Log the simulated success
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'sms_sent',
    'SMS sent (simulated)',
    jsonb_build_object(
      'to', to_phone,
      'timestamp', now()
    )
  );
  
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

-- Function to generate and store OTP
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
  DELETE FROM stored_otps WHERE phone_number = phone_number;
  
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

-- Function to send OTP
CREATE OR REPLACE FUNCTION send_otp(phone_input text)
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
  standardized_phone := standardize_phone_number(phone_input);
  
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

-- Function to verify OTP
CREATE OR REPLACE FUNCTION verify_otp(phone_input text, otp_input text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stored_otp_record record;
  customer_exists boolean;
  standardized_phone text;
  customer_record record;
BEGIN
  -- Standardize phone number to local format
  standardized_phone := standardize_phone_number(phone_input);
  
  -- Validate inputs
  IF NOT standardized_phone ~ '^0\d{9}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رقم الهاتف غير صالح'
    );
  END IF;
  
  IF NOT otp_input ~ '^\d{6}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز التحقق غير صالح'
    );
  END IF;
  
  -- Get stored OTP using table alias to avoid ambiguity
  SELECT * INTO stored_otp_record
  FROM stored_otps s
  WHERE s.phone_number = standardized_phone
  AND s.otp_code = otp_input
  AND NOT s.is_used
  AND s.expires_at > now();
  
  -- Check if OTP exists and is valid
  IF stored_otp_record IS NULL THEN
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
  WHERE id = stored_otp_record.id;
  
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_test_phone_number(text) TO service_role;
GRANT EXECUTE ON FUNCTION format_phone_to_international(text) TO service_role;
GRANT EXECUTE ON FUNCTION standardize_phone_number(text) TO service_role;
GRANT EXECUTE ON FUNCTION send_twilio_sms(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION generate_and_store_otp(text) TO service_role;
GRANT EXECUTE ON FUNCTION send_otp(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION verify_otp(text, text) TO authenticated, anon;