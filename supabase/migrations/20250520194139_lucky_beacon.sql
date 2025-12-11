-- First drop all existing functions by their specific signatures
DO $$ 
DECLARE
  func_record record;
BEGIN
  -- Find and drop all functions named send_otp_with_twilio
  FOR func_record IN 
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'send_otp_with_twilio'
    AND n.nspname = 'public'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.send_otp_with_twilio(' || func_record.args || ') CASCADE';
    RAISE NOTICE 'Dropped function send_otp_with_twilio(%)', func_record.args;
  END LOOP;
  
  -- Find and drop all functions named verify_otp_with_user_check
  FOR func_record IN 
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'verify_otp_with_user_check'
    AND n.nspname = 'public'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.verify_otp_with_user_check(' || func_record.args || ') CASCADE';
    RAISE NOTICE 'Dropped function verify_otp_with_user_check(%)', func_record.args;
  END LOOP;
  
  -- Find and drop all functions named generate_otp_with_twilio
  FOR func_record IN 
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'generate_otp_with_twilio'
    AND n.nspname = 'public'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.generate_otp_with_twilio(' || func_record.args || ') CASCADE';
    RAISE NOTICE 'Dropped function generate_otp_with_twilio(%)', func_record.args;
  END LOOP;
END $$;

-- Create system_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  message text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on system_logs
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for system_logs
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'system_logs' AND policyname = 'Only service role can access system logs'
  ) THEN
    CREATE POLICY "Only service role can access system logs"
      ON system_logs
      FOR ALL
      TO service_role
      USING (true);
  END IF;
END $$;

-- Function to send SMS via Twilio API (mock version for development)
CREATE OR REPLACE FUNCTION app_send_sms_v1(
  to_phone text,
  message_body text,
  OUT success boolean,
  OUT error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- For development, we'll just simulate success
  success := true;
  error_message := NULL;
  
  -- Log the SMS for development purposes
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'sms_sent',
    'SMS sent (simulated for development)',
    jsonb_build_object(
      'to', to_phone,
      'message', message_body
    )
  );
  
  RETURN;
END;
$$;

-- Function to send OTP (development version)
CREATE OR REPLACE FUNCTION app_send_otp_v1(
  phone_number text
)
RETURNS jsonb
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
    RETURN jsonb_build_object(
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
    RETURN jsonb_build_object(
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
  
  -- Return success response with the OTP for development
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم إرسال رمز التحقق بنجاح',
    'otp', generated_otp
  );
END;
$$;

-- Function to verify OTP with user check
CREATE OR REPLACE FUNCTION app_verify_otp_v1(
  phone_number text,
  otp_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  valid boolean;
  customer_exists boolean;
BEGIN
  -- Validate phone format
  IF NOT phone_number ~ '^0\d{9}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رقم الهاتف غير صالح'
    );
  END IF;
  
  -- Validate OTP format
  IF NOT otp_code ~ '^\d{6}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز التحقق غير صالح'
    );
  END IF;
  
  -- Check if OTP exists, is not used, and has not expired
  SELECT EXISTS (
    SELECT 1
    FROM otp_codes
    WHERE phone = phone_number
    AND code = otp_code
    AND used = false
    AND expires_at > now()
  ) INTO valid;
  
  IF NOT valid THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز التحقق غير صحيح أو منتهي الصلاحية'
    );
  END IF;
  
  -- Mark OTP as used
  UPDATE otp_codes
  SET used = true
  WHERE phone = phone_number
  AND code = otp_code
  AND used = false
  AND expires_at > now();
  
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
END;
$$;

-- Create wrapper functions with the original names
CREATE OR REPLACE FUNCTION app_otp_send(phone_number text)
RETURNS jsonb AS $$
  SELECT app_send_otp_v1(phone_number);
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION app_otp_verify(phone_number text, otp_code text)
RETURNS jsonb AS $$
  SELECT app_verify_otp_v1(phone_number, otp_code);
$$ LANGUAGE SQL SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION app_send_sms_v1 TO service_role;
GRANT EXECUTE ON FUNCTION app_send_otp_v1 TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app_verify_otp_v1 TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app_otp_send TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app_otp_verify TO authenticated, anon;

-- Create a view to map the new functions to the expected names
CREATE OR REPLACE VIEW auth_functions AS
SELECT 
  'app_otp_send'::regproc AS send_otp_with_twilio,
  'app_otp_verify'::regproc AS verify_otp_with_user_check;

-- Add comment to explain usage
COMMENT ON VIEW auth_functions IS 'This view maps the new function names to the expected names. Use app_otp_send instead of send_otp_with_twilio and app_otp_verify instead of verify_otp_with_user_check.';