/*
  # Fix Twilio SMS Configuration
  
  1. Changes
    - Update the Twilio phone number to the correct one: +1 7628883204
    - Ensure proper SMS delivery for OTP codes
  
  2. Security
    - Maintain existing security policies
    - Keep proper error handling and logging
*/

-- Update the send_twilio_sms function with the correct phone number
CREATE OR REPLACE FUNCTION send_twilio_sms(
  to_phone text,
  message_body text,
  OUT success boolean,
  OUT message text,
  OUT sid text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  twilio_account_sid text := 'ACa146325dc7992176135d42bee153b8c8';
  twilio_auth_token text := 'b67e3e4cd93e5ea4baff533c71080b0c';
  twilio_from_number text := '+17628883204'; -- Updated to the correct phone number
  formatted_phone text;
  is_test_number boolean;
  request_id text;
BEGIN
  -- Format phone number for international format
  formatted_phone := format_phone_to_international(to_phone);
  
  -- Check if this is a test number
  is_test_number := is_test_phone_number(to_phone);
  
  -- Generate a unique request ID for tracking
  request_id := gen_random_uuid()::text;
  
  -- Log the SMS attempt
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'sms_attempt',
    'Attempting to send SMS via Twilio',
    jsonb_build_object(
      'to', to_phone,
      'formatted_phone', formatted_phone,
      'from', twilio_from_number,
      'is_test_number', is_test_number,
      'request_id', request_id,
      'timestamp', now()
    )
  );
  
  -- For test numbers, simulate success without sending
  IF is_test_number THEN
    success := TRUE;
    message := 'تم إرسال الرسالة بنجاح (محاكاة للرقم التجريبي)';
    sid := 'TEST_' || md5(random()::text || clock_timestamp()::text)::text;
    
    -- Log the simulated success
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'sms_simulated',
      'SMS simulated for test number',
      jsonb_build_object(
        'to', to_phone,
        'formatted_phone', formatted_phone,
        'sid', sid,
        'request_id', request_id,
        'timestamp', now()
      )
    );
    
    RETURN;
  END IF;
  
  -- For real numbers, we would make an HTTP request to Twilio API
  -- Since we can't make HTTP requests directly from PostgreSQL functions,
  -- we'll use the Edge Function approach
  
  -- Insert into SMS queue for the Edge Function to process
  INSERT INTO sms_queue (
    to_phone,
    message,
    status,
    next_retry_at
  ) VALUES (
    formatted_phone,
    message_body,
    'pending',
    now()
  );
  
  -- Log the queued SMS
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'sms_queued',
    'SMS queued for Edge Function to send',
    jsonb_build_object(
      'to', to_phone,
      'formatted_phone', formatted_phone,
      'from', twilio_from_number,
      'timestamp', now()
    )
  );
  
  success := TRUE;
  message := 'تم تجهيز الرسالة للإرسال';
  sid := 'QUEUED_' || md5(random()::text || clock_timestamp()::text)::text;
  
  RETURN;
EXCEPTION
  WHEN OTHERS THEN
    success := FALSE;
    message := 'فشل في إرسال الرسالة: ' || SQLERRM;
    sid := NULL;
    
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'sms_error',
      'Error sending SMS',
      jsonb_build_object(
        'to', to_phone,
        'error', SQLERRM,
        'request_id', request_id,
        'timestamp', now()
      )
    );
    
    RETURN;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION send_twilio_sms TO service_role;