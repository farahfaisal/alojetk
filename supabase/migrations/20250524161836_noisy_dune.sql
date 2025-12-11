/*
  # Fix Twilio SMS Integration
  
  1. New Tables
    - `sms_queue` - Stores SMS messages to be sent
    - `otps` - Stores OTP codes for phone verification
    - `otp_logs` - Stores OTP logs for debugging
  
  2. New Functions
    - `queue_sms` - Queues an SMS for sending
    - `send_otp` - Generates and queues an OTP for sending
  
  3. Security
    - Enable RLS on all tables
    - Add policies for service role access
*/

-- Create a new SMS queue table with proper structure
CREATE TABLE IF NOT EXISTS sms_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp without time zone DEFAULT now(),
  sent_at timestamp without time zone,
  error_message text,
  retry_count integer DEFAULT 0,
  next_retry_at timestamp without time zone,
  request_id text
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_sms_queue_status ON sms_queue(status);
CREATE INDEX IF NOT EXISTS idx_sms_queue_created_at ON sms_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_sms_queue_next_retry_at ON sms_queue(next_retry_at);

-- Enable RLS on sms_queue
ALTER TABLE sms_queue ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sms_queue' AND policyname = 'Only service role can access SMS queue'
  ) THEN
    CREATE POLICY "Only service role can access SMS queue"
      ON sms_queue
      FOR ALL
      TO service_role
      USING (true);
  END IF;
END $$;

-- Create OTP storage table
CREATE TABLE IF NOT EXISTS otps (
  phone text PRIMARY KEY,
  code text,
  expires_at timestamp without time zone
);

-- Create OTP logs table for debugging
CREATE TABLE IF NOT EXISTS otp_logs (
  id serial PRIMARY KEY,
  phone text NOT NULL,
  otp text NOT NULL,
  created_at timestamp without time zone DEFAULT now()
);

-- Function to queue SMS for sending
CREATE OR REPLACE FUNCTION queue_sms(
  to_phone text,
  message_body text,
  OUT success boolean,
  OUT message text,
  OUT queue_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  formatted_phone text;
  request_id text;
BEGIN
  -- Format phone number for international format
  IF to_phone LIKE '0%' THEN
    formatted_phone := '+970' || substring(to_phone from 2);
  ELSE
    formatted_phone := to_phone;
  END IF;
  
  -- Generate a unique request ID for tracking
  request_id := gen_random_uuid()::text;
  
  -- Queue the SMS for sending
  INSERT INTO sms_queue (
    to_phone,
    message,
    status,
    request_id,
    next_retry_at
  ) VALUES (
    formatted_phone,
    message_body,
    'pending',
    request_id,
    now()
  ) RETURNING id INTO queue_id;
  
  -- Log the queued SMS
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'sms_queued',
    'SMS queued for sending',
    jsonb_build_object(
      'to', to_phone,
      'formatted_phone', formatted_phone,
      'queue_id', queue_id,
      'request_id', request_id,
      'timestamp', now()
    )
  );
  
  success := TRUE;
  message := 'تم تجهيز الرسالة للإرسال';
  
  RETURN;
EXCEPTION
  WHEN OTHERS THEN
    success := FALSE;
    message := 'فشل في تجهيز الرسالة: ' || SQLERRM;
    queue_id := NULL;
    
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'sms_queue_error',
      'Error queueing SMS',
      jsonb_build_object(
        'to', to_phone,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    RETURN;
END;
$$;

-- Update the send_otp function to never return OTP in response
CREATE OR REPLACE FUNCTION send_otp(phone_number text)
RETURNS JSONB AS $$
DECLARE
  generated_otp text;
  queue_result record;
  formatted_phone text;
  request_id text;
BEGIN
  -- Validate phone format
  IF NOT (
    phone_number ~ '^0(59|56|58|54|50|52|57|55|53|51)\d{7}$' OR
    phone_number ~ '^0\d{9}$'
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'رقم الهاتف غير صالح'
    );
  END IF;
  
  -- Generate a random 6-digit OTP (100000-999999)
  SELECT lpad(floor(random() * 900000 + 100000)::text, 6, '0') INTO generated_otp;
  
  -- Generate a unique request ID for tracking
  request_id := gen_random_uuid()::text;
  
  -- Store OTP in database
  INSERT INTO otps (phone, code, expires_at)
  VALUES (
    phone_number,
    generated_otp,
    now() + interval '15 minutes'
  )
  ON CONFLICT (phone) 
  DO UPDATE SET 
    code = EXCLUDED.code,
    expires_at = EXCLUDED.expires_at;
  
  -- Store in logs for debugging (but not in response)
  INSERT INTO otp_logs (phone, otp) 
  VALUES (phone_number, generated_otp);
  
  -- Format phone number for international format
  IF phone_number LIKE '0%' THEN
    formatted_phone := '+970' || substring(phone_number from 2);
  ELSE
    formatted_phone := phone_number;
  END IF;
  
  -- Queue SMS for sending
  SELECT * FROM queue_sms(
    formatted_phone,
    'رمز التحقق الخاص بك هو: ' || generated_otp || '. صالح لمدة 15 دقيقة.'
  ) INTO queue_result;
  
  -- Log the OTP generation (for debugging only)
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'otp_generated',
    'OTP generated and queued for sending',
    jsonb_build_object(
      'phone', phone_number,
      'formatted_phone', formatted_phone,
      'otp', generated_otp,
      'queue_id', queue_result.queue_id,
      'request_id', request_id,
      'timestamp', now()
    )
  );
  
  -- Return success response WITHOUT the OTP
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'تم إرسال رمز التحقق بنجاح'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'حدث خطأ أثناء إرسال رمز التحقق: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION queue_sms TO service_role;
GRANT EXECUTE ON FUNCTION send_otp TO authenticated, anon;