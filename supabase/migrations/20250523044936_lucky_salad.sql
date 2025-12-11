/*
  # Fix OTP Codes Table Structure
  
  1. Changes
    - Rename columns to match the Edge Function expectations
    - Add missing columns if they don't exist
    - Ensure proper column names for compatibility
  
  2. Security
    - Maintain existing RLS policies
    - Keep security definer attribute for proper access control
*/

-- First check if the table exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'otp_codes'
  ) THEN
    -- Create the table with the correct column names
    CREATE TABLE otp_codes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      phone_number text NOT NULL,
      otp text NOT NULL,
      created_at timestamptz DEFAULT now(),
      expires_at timestamptz NOT NULL,
      used boolean DEFAULT false
    );
    
    -- Create indexes
    CREATE INDEX idx_otp_codes_phone_number ON otp_codes(phone_number);
    CREATE INDEX idx_otp_codes_expires_at ON otp_codes(expires_at);
    
    -- Enable RLS
    ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
    
    -- Create policy
    CREATE POLICY "Only service role can access OTP codes"
      ON otp_codes
      FOR ALL
      TO service_role
      USING (true);
  ELSE
    -- Table exists, check and rename columns if needed
    
    -- Check if 'phone' column exists and 'phone_number' doesn't
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'otp_codes' AND column_name = 'phone'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'otp_codes' AND column_name = 'phone_number'
    ) THEN
      -- Rename 'phone' to 'phone_number'
      ALTER TABLE otp_codes RENAME COLUMN phone TO phone_number;
    END IF;
    
    -- Check if 'code' column exists and 'otp' doesn't
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'otp_codes' AND column_name = 'code'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'otp_codes' AND column_name = 'otp'
    ) THEN
      -- Rename 'code' to 'otp'
      ALTER TABLE otp_codes RENAME COLUMN code TO otp;
    END IF;
  END IF;
END $$;

-- Update app_generate_otp function to use the correct column names
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
    WHERE phone_number = input_phone
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
  DELETE FROM otp_codes WHERE phone_number = input_phone;
  
  -- Insert new OTP
  INSERT INTO otp_codes (
    phone_number,
    otp,
    expires_at
  ) VALUES (
    input_phone,
    generated_otp,
    expires
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

-- Update app_otp_verify function to use the correct column names
CREATE OR REPLACE FUNCTION app_otp_verify(
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
    WHERE phone_number = phone_number
    AND otp = otp_code
    AND used = false
    AND expires_at > now()
  ) INTO valid;
  
  IF NOT valid THEN
    -- Log failed verification attempt
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'otp_verification_failed',
      'OTP verification failed',
      jsonb_build_object(
        'phone', phone_number,
        'timestamp', now()
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز التحقق غير صحيح أو منتهي الصلاحية'
    );
  END IF;
  
  -- Mark OTP as used
  UPDATE otp_codes
  SET used = true
  WHERE phone_number = phone_number
  AND otp = otp_code
  AND used = false
  AND expires_at > now();
  
  -- Check if customer exists
  SELECT EXISTS (
    SELECT 1 FROM customers WHERE phone = phone_number
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
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'otp_verification_error',
      'Error verifying OTP',
      jsonb_build_object(
        'phone', phone_number,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    -- Return error response
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ أثناء التحقق من الرمز: ' || SQLERRM
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION app_otp_verify TO authenticated, anon, service_role;

-- Refresh the schema cache for PostgREST
SELECT pg_notify('pgrst', 'reload schema');