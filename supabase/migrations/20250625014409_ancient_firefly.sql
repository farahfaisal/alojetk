/*
  # Fix unassigned variable error in verify_otp_with_referral function
  
  1. Changes
    - Initialize v_referral_result variable to avoid "record is not assigned yet" error
    - Improve error handling in the function
    - Ensure all code paths properly set the variable before use
  
  2. Security
    - Maintain existing security policies
    - Ensure proper error handling and logging
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS verify_otp_with_referral(text, text, text);

-- Create an improved version with proper variable initialization
CREATE OR REPLACE FUNCTION verify_otp_with_referral(
  p_phone text, 
  p_otp text, 
  p_referral_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_otp record;
  v_customer_exists boolean;
  v_standardized_phone text;
  v_customer_record record;
  v_referral_result record = NULL; -- Initialize to NULL to avoid "not assigned yet" error
  v_customer_id uuid;
  v_referral_processed boolean = false;
  v_referral_message text = NULL;
  v_points_awarded integer = NULL;
BEGIN
  -- Standardize phone number to local format
  IF p_phone LIKE '+970%' THEN
    v_standardized_phone := '0' || substring(p_phone from 5);
  ELSIF p_phone LIKE '970%' THEN
    v_standardized_phone := '0' || substring(p_phone from 4);
  ELSE
    v_standardized_phone := p_phone;
  END IF;
  
  -- Validate inputs
  IF NOT v_standardized_phone ~ '^0\d{9}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رقم الهاتف غير صالح'
    );
  END IF;
  
  IF NOT p_otp ~ '^\d{6}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز التحقق غير صالح'
    );
  END IF;
  
  -- Get stored OTP using table alias to avoid ambiguity
  SELECT * INTO v_stored_otp
  FROM stored_otps s
  WHERE s.phone = v_standardized_phone
  AND s.otp_code = p_otp
  AND NOT s.is_used
  AND s.expires_at > now();
  
  -- Check if OTP exists and is valid
  IF v_stored_otp IS NULL THEN
    -- Log failed verification
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'otp_verification_failed',
      'OTP verification failed',
      jsonb_build_object(
        'phone', v_standardized_phone,
        'timestamp', now()
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز التحقق غير صحيح أو منتهي الصلاحية'
    );
  END IF;
  
  -- Mark OTP as used
  UPDATE stored_otps
  SET is_used = true
  WHERE id = v_stored_otp.id;
  
  -- Check if customer exists
  SELECT EXISTS (
    SELECT 1 FROM customers c WHERE c.phone = v_standardized_phone
  ) INTO v_customer_exists;
  
  -- Get or create customer
  IF v_customer_exists THEN
    -- Get existing customer
    SELECT * INTO v_customer_record
    FROM customers c
    WHERE c.phone = v_standardized_phone;
    
    v_customer_id := v_customer_record.id;
  ELSE
    -- Create new customer
    INSERT INTO customers (
      name,
      phone,
      created_at
    ) VALUES (
      'مستخدم جديد',
      v_standardized_phone,
      now()
    ) RETURNING * INTO v_customer_record;
    
    v_customer_id := v_customer_record.id;
    
    -- Process referral code if provided for new users
    IF p_referral_code IS NOT NULL AND p_referral_code != '' THEN
      SELECT * FROM process_referral(p_referral_code, v_customer_id) INTO v_referral_result;
      v_referral_processed := true;
      
      IF v_referral_result IS NOT NULL THEN
        v_referral_message := v_referral_result.message;
        v_points_awarded := v_referral_result.points_awarded;
      END IF;
      
      -- Log the referral processing
      INSERT INTO system_logs (
        event_type,
        message,
        details
      ) VALUES (
        'referral_processing',
        CASE 
          WHEN v_referral_result IS NULL THEN 'Referral processing failed - null result'
          WHEN v_referral_result.success THEN 'Referral processed successfully' 
          ELSE 'Referral processing failed' 
        END,
        jsonb_build_object(
          'phone', v_standardized_phone,
          'customer_id', v_customer_id,
          'referral_code', p_referral_code,
          'success', CASE WHEN v_referral_result IS NULL THEN false ELSE v_referral_result.success END,
          'message', v_referral_message,
          'points_awarded', v_points_awarded,
          'timestamp', now()
        )
      );
    END IF;
  END IF;
  
  -- Log successful verification
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'otp_verification_success',
    'OTP verification successful',
    jsonb_build_object(
      'phone', v_standardized_phone,
      'existing_user', v_customer_exists,
      'customer_id', v_customer_id,
      'referral_code', p_referral_code,
      'referral_processed', v_referral_processed,
      'timestamp', now()
    )
  );
  
  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم التحقق بنجاح',
    'existing_user', v_customer_exists,
    'user', jsonb_build_object(
      'id', v_customer_record.id,
      'name', v_customer_record.name,
      'phone', v_customer_record.phone,
      'email', v_customer_record.email
    ),
    'referral_processed', v_referral_processed,
    'referral_message', v_referral_message,
    'points_awarded', v_points_awarded
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'otp_verification_error',
      'Error verifying OTP',
      jsonb_build_object(
        'phone', v_standardized_phone,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ أثناء التحقق من الرمز: ' || SQLERRM
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION verify_otp_with_referral(text, text, text) TO authenticated, anon;