/*
  # Create OTP codes table
  
  1. New Tables
    - `otp_codes`: Stores OTP codes for phone verification
      - `id` (uuid, primary key)
      - `phone` (text, not null)
      - `code` (text, not null)
      - `created_at` (timestamptz, default now())
      - `expires_at` (timestamptz, not null)
      - `used` (boolean, default false)
  
  2. Security
    - Enable RLS
    - Add policies for secure access
    - Add function to verify OTP codes
*/

-- Create OTP codes table
CREATE TABLE IF NOT EXISTS otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);

-- Enable RLS
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Only service role can access OTP codes"
  ON otp_codes
  USING (auth.role() = 'service_role');

-- Create function to verify OTP
CREATE OR REPLACE FUNCTION verify_otp(phone_number text, otp_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  valid boolean;
BEGIN
  -- Check if OTP exists, is not used, and has not expired
  SELECT EXISTS (
    SELECT 1
    FROM otp_codes
    WHERE phone = phone_number
    AND code = otp_code
    AND used = false
    AND expires_at > now()
  ) INTO valid;
  
  -- If valid, mark as used
  IF valid THEN
    UPDATE otp_codes
    SET used = true
    WHERE phone = phone_number
    AND code = otp_code
    AND used = false
    AND expires_at > now();
  END IF;
  
  RETURN valid;
END;
$$;

-- Create function to clean up expired OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM otp_codes
  WHERE expires_at < now();
END;
$$;

-- Create scheduled job to clean up expired OTPs
-- Note: This requires pg_cron extension to be enabled
-- If pg_cron is not available, you can call this function manually
-- or implement cleanup in your application logic
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    SELECT cron.schedule('0 * * * *', 'SELECT cleanup_expired_otps()');
  END IF;
EXCEPTION
  WHEN undefined_function THEN
    -- pg_cron not available, skip scheduling
    RAISE NOTICE 'pg_cron extension not available, skipping scheduled cleanup';
END;
$$;