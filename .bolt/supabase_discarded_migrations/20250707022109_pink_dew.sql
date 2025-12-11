-- First, check if the stored_otps table exists and handle duplicates
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'stored_otps'
  ) THEN
    -- Create a temporary table to store the latest OTP for each phone number
    CREATE TEMP TABLE latest_otps AS
    SELECT DISTINCT ON (phone) 
      id, 
      phone, 
      otp_code, 
      created_at, 
      expires_at, 
      is_used
    FROM stored_otps
    ORDER BY phone, created_at DESC;
    
    -- Delete all records from the original table
    DELETE FROM stored_otps;
    
    -- Reinsert the latest records
    INSERT INTO stored_otps (id, phone, otp_code, created_at, expires_at, is_used)
    SELECT id, phone, otp_code, created_at, expires_at, is_used
    FROM latest_otps;
    
    -- Drop the temporary table
    DROP TABLE latest_otps;
    
    -- Now add the unique constraint
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'stored_otps_phone_key'
    ) THEN
      ALTER TABLE stored_otps ADD CONSTRAINT stored_otps_phone_key UNIQUE (phone);
    END IF;
  END IF;
END $$;

-- Drop the existing send_otp function
DROP FUNCTION IF EXISTS send_otp(text);

-- Create a new version with proper ON CONFLICT handling
CREATE OR REPLACE FUNCTION send_otp(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_otp text;
  v_is_test_number boolean;
  v_standardized_phone text;
BEGIN
  -- Standardize phone number
  IF p_phone LIKE '+970%' THEN
    v_standardized_phone := '0' || substring(p_phone from 5);
  ELSIF p_phone LIKE '970%' THEN
    v_standardized_phone := '0' || substring(p_phone from 4);
  ELSE
    v_standardized_phone := p_phone;
  END IF;
  
  -- Validate phone format
  IF NOT v_standardized_phone ~ '^0\d{9}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رقم الهاتف غير صالح. يجب أن يبدأ بـ 0 ويتكون من 10 أرقام'
    );
  END IF;
  
  -- Check if this is a test number
  v_is_test_number := (v_standardized_phone = '0595284308');
  
  -- Generate OTP
  IF v_is_test_number THEN
    v_otp := '123456';
  ELSE
    v_otp := lpad(floor(random() * 900000 + 100000)::text, 6, '0');
  END IF;
  
  -- Store OTP in database with proper ON CONFLICT handling
  INSERT INTO stored_otps (
    phone,
    otp_code,
    expires_at,
    is_used
  ) VALUES (
    v_standardized_phone,
    v_otp,
    now() + interval '15 minutes',
    false
  )
  ON CONFLICT (phone) 
  DO UPDATE SET 
    otp_code = EXCLUDED.otp_code,
    expires_at = EXCLUDED.expires_at,
    is_used = false,
    created_at = now();
  
  -- Log the OTP generation
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'otp_generated',
    'OTP generated via send_otp function',
    jsonb_build_object(
      'phone', v_standardized_phone,
      'is_test_number', v_is_test_number,
      'timestamp', now()
    )
  );
  
  -- Return success response
  -- For development, always include the OTP in the response
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم إرسال رمز التحقق بنجاح',
    'otp', v_otp
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
      'Error in send_otp function',
      jsonb_build_object(
        'phone', v_standardized_phone,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'message', 'فشل في إرسال رمز التحقق: ' || SQLERRM
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION send_otp(text) TO authenticated, anon;