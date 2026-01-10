/*
  # Improve Referral Points System
  
  1. Changes
    - Fix the relationship between referral_codes and customers tables
    - Ensure points are properly awarded for successful referrals
    - Add trigger to automatically generate referral codes for new customers
    - Add function to process referrals with proper points calculation
  
  2. Security
    - Maintain existing RLS policies
    - Ensure proper error handling and logging
*/

-- Create a function to generate a customer referral code
CREATE OR REPLACE FUNCTION generate_customer_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  v_code text;
  v_exists boolean;
BEGIN
  -- Generate a unique referral code
  LOOP
    -- Generate a random 6-character alphanumeric code
    v_code := upper(substring(md5(random()::text) from 1 for 6));
    
    -- Check if this code already exists
    SELECT EXISTS(
      SELECT 1 FROM referral_codes WHERE code = v_code
    ) INTO v_exists;
    
    -- If it doesn't exist, we can use it
    IF NOT v_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  -- Create referral code record
  INSERT INTO referral_codes (
    code,
    type,
    status,
    points_reward,
    points_referrer,
    customer_id,
    referral_link
  ) VALUES (
    v_code,
    'user',
    'active',
    100, -- Points for the referred user
    50,  -- Points for the referrer
    NEW.id,
    'https://app.alojetk.site/signup?ref=' || v_code
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the transaction
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'referral_code_generation_error',
      'Error generating referral code',
      jsonb_build_object(
        'customer_id', NEW.id,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically generate referral code for new customers
DROP TRIGGER IF EXISTS generate_customer_referral_code_trigger ON customers;
CREATE TRIGGER generate_customer_referral_code_trigger
  AFTER INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION generate_customer_referral_code();

-- Improve the process_referral function to better handle referrals
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
  
  -- Get referrer ID (customer_id is the primary field we should use)
  v_referrer_id := v_referral_code_record.customer_id;
  
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

-- Create a function to get a customer's referral code
CREATE OR REPLACE FUNCTION get_customer_referral_code(
  p_customer_id uuid,
  OUT code text,
  OUT referral_link text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Get the customer's referral code
  SELECT 
    rc.code,
    rc.referral_link
  INTO 
    code,
    referral_link
  FROM referral_codes rc
  WHERE rc.customer_id = p_customer_id
  LIMIT 1;
  
  -- If no referral code exists, return NULL
  IF code IS NULL THEN
    RETURN;
  END IF;
  
  -- If referral link is NULL but code exists, generate a link
  IF referral_link IS NULL AND code IS NOT NULL THEN
    referral_link := 'https://app.alojetk.site/signup?ref=' || code;

    -- Update the referral code record with the link
    UPDATE referral_codes
    SET referral_link = referral_link
    WHERE code = code;
  END IF;
  
  RETURN;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'get_referral_code_error',
      'Error getting referral code',
      jsonb_build_object(
        'customer_id', p_customer_id,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    code := NULL;
    referral_link := NULL;
    RETURN;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_customer_referral_code() TO service_role;
GRANT EXECUTE ON FUNCTION process_referral(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION get_customer_referral_code(uuid) TO authenticated, anon;