-- Drop the view that depends on the function
DROP VIEW IF EXISTS auth_functions;

-- Drop all existing OTP functions to avoid conflicts
DO $$ 
DECLARE
  func_record record;
BEGIN
  -- Find and drop all OTP-related functions
  FOR func_record IN 
    SELECT proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND (
      p.proname LIKE 'app\_otp\_send%' OR 
      p.proname LIKE 'app\_verify\_otp%' OR
      p.proname = 'send_otp' OR
      p.proname = 'verify_otp' OR
      p.proname = 'generate_and_store_otp' OR
      p.proname = 'verify_stored_otp' OR
      p.proname = 'app_otp_send' OR
      p.proname = 'app_otp_verify'
    )
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.' || func_record.proname || '(' || func_record.args || ') CASCADE';
    RAISE NOTICE 'Dropped function %(%)', func_record.proname, func_record.args;
  END LOOP;
END $$;

-- Drop the otp_logs table if it exists
DROP TABLE IF EXISTS otp_logs;

-- Drop the otps table if it exists
DROP TABLE IF EXISTS otps;

-- Create a new OTP logs table for simpler tracking
CREATE TABLE IF NOT EXISTS otp_logs (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  otp TEXT NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Create a simpler OTP storage table
CREATE TABLE IF NOT EXISTS otps (
  phone TEXT PRIMARY KEY,
  code TEXT,
  expires_at TIMESTAMP WITHOUT TIME ZONE
);

-- Function to generate and store OTP
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
  
  -- Store in logs for debugging
  INSERT INTO otp_logs (phone, otp) VALUES (phone_number, new_otp);
  
  -- Store in otps table (replacing any existing entry)
  INSERT INTO otps (phone, code, expires_at)
  VALUES (phone_number, new_otp, now() + interval '15 minutes')
  ON CONFLICT (phone) 
  DO UPDATE SET 
    code = EXCLUDED.code,
    expires_at = EXCLUDED.expires_at;
  
  RETURN new_otp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify OTP
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
  END IF;
  
  RETURN is_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send OTP (simplified for development)
CREATE OR REPLACE FUNCTION send_otp(phone_number TEXT)
RETURNS JSONB AS $$
DECLARE
  generated_otp TEXT;
  is_test_number BOOLEAN;
BEGIN
  -- Validate phone format
  IF NOT (
    phone_number ~ '^0(59|56|58|54|50|52|57|55|53|51)\d{7}$' OR
    phone_number ~ '^0\d{9}$'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رقم الهاتف غير صالح'
    );
  END IF;
  
  -- Check if this is a test number
  is_test_number := (phone_number = '0595284308');
  
  -- Generate and store OTP
  generated_otp := generate_and_store_otp(phone_number);
  
  -- In a real implementation, this would send an SMS
  -- For development, we just return the OTP
  
  -- Return success with OTP for development
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم إرسال رمز التحقق بنجاح',
    'otp', generated_otp
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ أثناء إرسال رمز التحقق: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify OTP
CREATE OR REPLACE FUNCTION verify_otp(phone_number TEXT, otp_code TEXT)
RETURNS JSONB AS $$
DECLARE
  is_valid BOOLEAN;
  customer_exists BOOLEAN;
BEGIN
  -- Validate inputs
  IF NOT phone_number ~ '^0\d{9}$' THEN
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
  
  -- Verify OTP
  is_valid := verify_stored_otp(phone_number, otp_code);
  
  IF NOT is_valid THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز التحقق غير صحيح أو منتهي الصلاحية'
    );
  END IF;
  
  -- Check if customer exists
  SELECT EXISTS (
    SELECT 1 FROM customers WHERE phone = phone_number
  ) INTO customer_exists;
  
  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم التحقق بنجاح',
    'existing_user', customer_exists
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ أثناء التحقق من الرمز: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_and_store_otp TO service_role;
GRANT EXECUTE ON FUNCTION verify_stored_otp TO service_role;
GRANT EXECUTE ON FUNCTION send_otp TO authenticated, anon;
GRANT EXECUTE ON FUNCTION verify_otp TO authenticated, anon;