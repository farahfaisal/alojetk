-- First drop existing functions to avoid return type errors
DROP FUNCTION IF EXISTS process_referral(text, uuid);
DROP FUNCTION IF EXISTS verify_otp_with_referral(text, text, text);

-- Create a function to process referrals and award points
CREATE OR REPLACE FUNCTION process_referral(
  p_referral_code text,
  p_referred_user_id uuid,
  OUT success boolean,
  OUT message text,
  OUT points_awarded integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referral_code_record record;
  v_referrer_id uuid;
  v_referrer_account_id uuid;
  v_referred_account_id uuid;
  v_referral_id uuid;
  v_points_reward integer;
  v_points_referrer integer;
BEGIN
  success := false;
  points_awarded := 0;
  
  -- Log the function call for debugging
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'process_referral_call',
    'Process referral function called',
    jsonb_build_object(
      'referral_code', p_referral_code,
      'referred_user_id', p_referred_user_id,
      'timestamp', now()
    )
  );
  
  -- Find the referral code
  SELECT * INTO v_referral_code_record
  FROM referral_codes
  WHERE code = p_referral_code
  AND status = 'active';
  
  IF v_referral_code_record IS NULL THEN
    message := 'رمز الإحالة غير صالح أو غير نشط';
    
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'process_referral_error',
      'Invalid referral code',
      jsonb_build_object(
        'referral_code', p_referral_code,
        'referred_user_id', p_referred_user_id,
        'timestamp', now()
      )
    );
    
    RETURN;
  END IF;
  
  -- Get referrer ID
  v_referrer_id := COALESCE(v_referral_code_record.user_id, v_referral_code_record.customer_id);
  
  IF v_referrer_id IS NULL THEN
    message := 'لم يتم العثور على المستخدم المرجع';
    
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'process_referral_error',
      'Referrer not found',
      jsonb_build_object(
        'referral_code', p_referral_code,
        'referred_user_id', p_referred_user_id,
        'referral_code_record', row_to_json(v_referral_code_record),
        'timestamp', now()
      )
    );
    
    RETURN;
  END IF;
  
  -- Check if the user is trying to refer themselves
  IF v_referrer_id = p_referred_user_id THEN
    message := 'لا يمكنك استخدام رمز الإحالة الخاص بك';
    
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'process_referral_error',
      'Self-referral attempt',
      jsonb_build_object(
        'referral_code', p_referral_code,
        'referred_user_id', p_referred_user_id,
        'referrer_id', v_referrer_id,
        'timestamp', now()
      )
    );
    
    RETURN;
  END IF;
  
  -- Check if the user has already been referred
  IF EXISTS (
    SELECT 1 FROM referrals
    WHERE referred_id = p_referred_user_id
  ) THEN
    message := 'تم استخدام رمز إحالة مسبقاً';
    
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'process_referral_error',
      'User already referred',
      jsonb_build_object(
        'referral_code', p_referral_code,
        'referred_user_id', p_referred_user_id,
        'timestamp', now()
      )
    );
    
    RETURN;
  END IF;
  
  -- Get points values
  v_points_reward := COALESCE(v_referral_code_record.points_reward, 100);
  v_points_referrer := COALESCE(v_referral_code_record.points_referrer, 50);
  
  -- Create referral record
  INSERT INTO referrals (
    referrer_id,
    referred_id,
    code_id,
    status,
    created_at
  ) VALUES (
    v_referrer_id,
    p_referred_user_id,
    v_referral_code_record.id,
    'completed',
    now()
  ) RETURNING id INTO v_referral_id;
  
  -- Get or create points account for referred user
  SELECT id INTO v_referred_account_id
  FROM points_accounts
  WHERE customer_id = p_referred_user_id;
  
  IF v_referred_account_id IS NULL THEN
    INSERT INTO points_accounts (
      customer_id,
      balance,
      total_earned,
      total_spent,
      last_activity
    ) VALUES (
      p_referred_user_id,
      v_points_reward,
      v_points_reward,
      0,
      now()
    ) RETURNING id INTO v_referred_account_id;
  ELSE
    -- Update existing account
    UPDATE points_accounts
    SET 
      balance = balance + v_points_reward,
      total_earned = total_earned + v_points_reward,
      last_activity = now()
    WHERE id = v_referred_account_id;
  END IF;
  
  -- Record transaction for referred user
  INSERT INTO points_transactions (
    account_id,
    amount,
    type,
    description,
    reference_id
  ) VALUES (
    v_referred_account_id,
    v_points_reward,
    'earn',
    'نقاط مكافأة الإحالة',
    v_referral_id
  );
  
  -- Get or create points account for referrer
  SELECT id INTO v_referrer_account_id
  FROM points_accounts
  WHERE customer_id = v_referrer_id;
  
  IF v_referrer_account_id IS NULL THEN
    INSERT INTO points_accounts (
      customer_id,
      balance,
      total_earned,
      total_spent,
      last_activity
    ) VALUES (
      v_referrer_id,
      v_points_referrer,
      v_points_referrer,
      0,
      now()
    ) RETURNING id INTO v_referrer_account_id;
  ELSE
    -- Update existing account
    UPDATE points_accounts
    SET 
      balance = balance + v_points_referrer,
      total_earned = total_earned + v_points_referrer,
      last_activity = now()
    WHERE id = v_referrer_account_id;
  END IF;
  
  -- Record transaction for referrer
  INSERT INTO points_transactions (
    account_id,
    amount,
    type,
    description,
    reference_id
  ) VALUES (
    v_referrer_account_id,
    v_points_referrer,
    'earn',
    'نقاط إحالة مستخدم جديد',
    v_referral_id
  );
  
  -- Log the successful referral
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'process_referral_success',
    'Referral processed successfully',
    jsonb_build_object(
      'referral_code', p_referral_code,
      'referred_user_id', p_referred_user_id,
      'referrer_id', v_referrer_id,
      'points_reward', v_points_reward,
      'points_referrer', v_points_referrer,
      'referral_id', v_referral_id,
      'timestamp', now()
    )
  );
  
  success := TRUE;
  message := 'تمت معالجة الإحالة بنجاح';
  points_awarded := v_points_reward;
  RETURN;
EXCEPTION
  WHEN OTHERS THEN
    success := FALSE;
    message := 'حدث خطأ أثناء معالجة الإحالة: ' || SQLERRM;
    
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'process_referral_error',
      'Error processing referral',
      jsonb_build_object(
        'referral_code', p_referral_code,
        'referred_user_id', p_referred_user_id,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    RETURN;
END;
$$;

-- Update the verify_otp function to process referral code if provided
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
  v_referral_result record;
  v_customer_id uuid;
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
      
      -- Log the referral processing
      INSERT INTO system_logs (
        event_type,
        message,
        details
      ) VALUES (
        'referral_processing',
        CASE WHEN v_referral_result.success THEN 'Referral processed successfully' ELSE 'Referral processing failed' END,
        jsonb_build_object(
          'phone', v_standardized_phone,
          'customer_id', v_customer_id,
          'referral_code', p_referral_code,
          'success', v_referral_result.success,
          'message', v_referral_result.message,
          'points_awarded', v_referral_result.points_awarded,
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
    'referral_processed', CASE 
      WHEN p_referral_code IS NULL OR p_referral_code = '' THEN NULL
      ELSE v_referral_result.success
    END,
    'referral_message', CASE 
      WHEN p_referral_code IS NULL OR p_referral_code = '' THEN NULL
      ELSE v_referral_result.message
    END,
    'points_awarded', CASE 
      WHEN p_referral_code IS NULL OR p_referral_code = '' THEN NULL
      ELSE v_referral_result.points_awarded
    END
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
GRANT EXECUTE ON FUNCTION process_referral(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION verify_otp_with_referral(text, text, text) TO authenticated, anon;