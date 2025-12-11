/*
  # Create Auth Functions View

  1. New Views
    - `auth_functions` - Maps new function names to expected names
  
  2. Changes
    - Creates a view to map the new function names to the expected names
    - Adds a comment to explain usage
*/

-- Create a view to map the new functions to the expected names
CREATE OR REPLACE VIEW auth_functions AS
SELECT 
  'app_otp_send'::regproc AS send_otp_with_twilio,
  'app_otp_verify'::regproc AS verify_otp_with_user_check;

-- Add comment to explain usage
COMMENT ON VIEW auth_functions IS 'This view maps the new function names to the expected names. Use app_otp_send instead of send_otp_with_twilio and app_otp_verify instead of verify_otp_with_user_check.';