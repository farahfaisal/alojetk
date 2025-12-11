/*
  # Fix stored_otps table structure
  
  1. Changes
    - Ensure stored_otps table has consistent column names
    - Add proper indexes for faster lookups
    - Add RLS policy for service role access
  
  2. Security
    - Enable RLS on the table
    - Add policy for service role access
*/

-- Create stored_otps table if it doesn't exist
CREATE TABLE IF NOT EXISTS stored_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  otp_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_used boolean DEFAULT false
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_stored_otps_phone ON stored_otps(phone);
CREATE INDEX IF NOT EXISTS idx_stored_otps_expires_at ON stored_otps(expires_at);

-- Enable RLS
ALTER TABLE stored_otps ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'stored_otps' AND policyname = 'Only service role can access stored OTPs'
  ) THEN
    CREATE POLICY "Only service role can access stored OTPs"
      ON stored_otps
      FOR ALL
      TO service_role
      USING (true);
  END IF;
END $$;

-- Create function to clean up expired OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_otps_trigger()
RETURNS trigger AS $$
BEGIN
  DELETE FROM stored_otps
  WHERE expires_at < now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to clean up expired OTPs
DROP TRIGGER IF EXISTS cleanup_expired_otps_trigger ON stored_otps;
CREATE TRIGGER cleanup_expired_otps_trigger
  AFTER INSERT ON stored_otps
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_expired_otps_trigger();

-- Log the migration
INSERT INTO system_logs (
  event_type,
  message,
  details
) VALUES (
  'migration',
  'Fixed stored_otps table structure',
  jsonb_build_object(
    'timestamp', now(),
    'description', 'Ensured stored_otps table has consistent column names and proper indexes'
  )
);