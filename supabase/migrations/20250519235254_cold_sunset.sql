/*
  # Fix OTP System

  1. New Tables
    - `otp_codes` - Stores OTP codes for phone verification
      - `id` (uuid, primary key)
      - `phone` (text)
      - `code` (text)
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz)
      - `used` (boolean)

  2. Security
    - Enable RLS on otp_codes table
    - Add policy for service role access
    - Add indexes for faster lookups
*/

-- Create OTP codes table if it doesn't exist
CREATE TABLE IF NOT EXISTS otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);

-- Enable RLS
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'otp_codes' AND policyname = 'Only service role can access OTP codes'
  ) THEN
    CREATE POLICY "Only service role can access OTP codes"
      ON otp_codes
      FOR ALL
      TO public
      USING (role() = 'service_role');
  END IF;
END $$;

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

-- Create function to generate OTP
CREATE OR REPLACE FUNCTION generate_otp(phone_number text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_otp text;
BEGIN
  -- Generate a random 6-digit OTP
  SELECT lpad(floor(random() * 1000000)::text, 6, '0') INTO new_otp;
  
  -- Delete any existing OTPs for this phone number
  DELETE FROM otp_codes WHERE phone = phone_number;
  
  -- Insert new OTP
  INSERT INTO otp_codes (
    phone,
    code,
    expires_at
  ) VALUES (
    phone_number,
    new_otp,
    now() + interval '5 minutes'
  );
  
  RETURN new_otp;
END;
$$;