-- Create table for storing OTP codes
CREATE TABLE IF NOT EXISTS stored_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  otp_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '10 minutes'),
  is_used boolean DEFAULT false
);

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.send_stored_otp(text);
DROP FUNCTION IF EXISTS public.verify_stored_otp(text, text);

-- Function to generate and store OTP
CREATE OR REPLACE FUNCTION public.send_stored_otp(phone_number text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_otp text;
  result json;
BEGIN
  -- Generate 6-digit OTP
  new_otp := floor(random() * 900000 + 100000)::text;
  
  -- Store the OTP
  INSERT INTO stored_otps (phone_number, otp_code)
  VALUES (phone_number, new_otp);
  
  -- In production, you would integrate with SMS service here
  -- For development, we'll just return success
  result := json_build_object(
    'success', true,
    'message', 'OTP stored successfully'
  );
  
  RETURN result;
END;
$$;

-- Function to verify stored OTP
CREATE OR REPLACE FUNCTION public.verify_stored_otp(
  phone_number text,
  otp_code text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stored_otp stored_otps%ROWTYPE;
  result json;
BEGIN
  -- Get the latest unused OTP for this phone number
  SELECT *
  INTO stored_otp
  FROM stored_otps
  WHERE phone_number = verify_stored_otp.phone_number
    AND otp_code = verify_stored_otp.otp_code
    AND NOT is_used
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF stored_otp IS NULL THEN
    result := json_build_object(
      'success', false,
      'message', 'Invalid or expired OTP'
    );
  ELSE
    -- Mark OTP as used
    UPDATE stored_otps
    SET is_used = true
    WHERE id = stored_otp.id;
    
    result := json_build_object(
      'success', true,
      'message', 'OTP verified successfully'
    );
  END IF;
  
  RETURN result;
END;
$$;