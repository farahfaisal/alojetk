/*
  # Create OTP System Tables
  
  1. New Tables
    - `otp_codes` - Stores OTP codes for phone verification
    - `system_logs` - Stores system logs for debugging
  
  2. Security
    - Enable RLS on both tables
    - Add policies for service role access
    - Add proper indexes for performance
*/

-- Create OTP codes table
CREATE TABLE IF NOT EXISTS otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  otp text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  request_id text
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_number ON otp_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);

-- Enable RLS
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'otp_codes' AND policyname = 'Only service role can access OTP codes'
  ) THEN
    CREATE POLICY "Only service role can access OTP codes"
      ON otp_codes
      FOR ALL
      TO service_role
      USING (true);
  END IF;
END $$;

-- Create system_logs table for debugging
CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  message text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on system_logs
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for system_logs if it doesn't exist
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