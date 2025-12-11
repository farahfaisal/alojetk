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

-- Create policy for system_logs only if it doesn't exist
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

-- Create OTP storage table
CREATE TABLE IF NOT EXISTS otps (
  phone text PRIMARY KEY,
  code text NOT NULL,
  expires_at timestamp without time zone NOT NULL
);

-- Drop all existing OTP-related functions
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
      p.proname LIKE '%otp%' OR 
      p.proname LIKE '%sms%' OR
      p.proname = 'verify_stored_otp' OR
      p.proname = 'generate_and_store_otp' OR
      p.proname = 'send_sms_directly' OR
      p.proname = 'queue_sms' OR
      p.proname = 'format_phone_to_international' OR
      p.proname = 'standardize_phone_number' OR
      p.proname = 'is_test_phone_number'
    )
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.' || func_record.proname || '(' || func_record.args || ') CASCADE';
  END LOOP;
END $$;

-- Drop SMS queue table if it exists
DROP TABLE IF EXISTS sms_queue;

-- Drop OTP logs table if it exists
DROP TABLE IF EXISTS otp_logs;

-- Log the migration
INSERT INTO system_logs (
  event_type,
  message,
  details
) VALUES (
  'migration',
  'Created OTP tables for Twilio integration',
  jsonb_build_object(
    'timestamp', now(),
    'description', 'Created otps and system_logs tables, dropped old OTP functions'
  )
);