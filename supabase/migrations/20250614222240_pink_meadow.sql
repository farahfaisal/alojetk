/*
  # Fix Points Redemption Function
  
  1. Changes
    - Update redeem_reward function to properly handle user ID parameter
    - Improve error handling and logging
    - Fix customer lookup logic
  
  2. Security
    - Maintain SECURITY DEFINER attribute for proper access control
    - Grant appropriate permissions
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS redeem_reward(uuid, uuid);

-- Create a new version with proper parameters and improved error handling
CREATE OR REPLACE FUNCTION redeem_reward(
  p_reward_id uuid,
  p_user_id uuid,
  OUT success boolean,
  OUT message text,
  OUT redemption_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account_id uuid;
  v_customer_id uuid;
  v_points_balance integer;
  v_reward_cost integer;
  v_reward_name text;
  v_reward_limit integer;
  v_reward_used_count integer;
  v_redemption_id uuid;
BEGIN
  success := false;
  
  -- Log the function call for debugging
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'redeem_reward_call',
    'Redeem reward function called',
    jsonb_build_object(
      'reward_id', p_reward_id,
      'user_id', p_user_id,
      'timestamp', now()
    )
  );
  
  -- Get customer ID from user ID
  SELECT id INTO v_customer_id
  FROM customers
  WHERE id = p_user_id OR user_id = p_user_id OR auth_user_id = p_user_id;
  
  IF v_customer_id IS NULL THEN
    -- Try to find by phone if customer ID is not found
    SELECT c.id INTO v_customer_id
    FROM customers c
    JOIN users u ON c.phone = u.phone
    WHERE u.id = p_user_id;
  END IF;
  
  IF v_customer_id IS NULL THEN
    message := 'المستخدم غير موجود';
    
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'redeem_reward_error',
      'Customer not found',
      jsonb_build_object(
        'reward_id', p_reward_id,
        'user_id', p_user_id,
        'timestamp', now()
      )
    );
    
    RETURN;
  END IF;
  
  -- Get points account
  SELECT id, balance INTO v_account_id, v_points_balance
  FROM points_accounts
  WHERE customer_id = v_customer_id;
  
  IF v_account_id IS NULL THEN
    -- Create points account if it doesn't exist
    INSERT INTO points_accounts (customer_id, balance, total_earned, total_spent)
    VALUES (v_customer_id, 0, 0, 0)
    RETURNING id, balance INTO v_account_id, v_points_balance;
  END IF;
  
  -- Get reward details
  SELECT 
    points_cost, 
    name, 
    usage_limit, 
    used_count
  INTO 
    v_reward_cost, 
    v_reward_name, 
    v_reward_limit, 
    v_reward_used_count
  FROM points_rewards
  WHERE id = p_reward_id AND status = 'active';
  
  IF v_reward_name IS NULL THEN
    message := 'المكافأة غير موجودة أو غير نشطة';
    
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'redeem_reward_error',
      'Reward not found or inactive',
      jsonb_build_object(
        'reward_id', p_reward_id,
        'user_id', p_user_id,
        'customer_id', v_customer_id,
        'timestamp', now()
      )
    );
    
    RETURN;
  END IF;
  
  -- Check if user has enough points
  IF v_points_balance < v_reward_cost THEN
    message := 'رصيد النقاط غير كافٍ';
    
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'redeem_reward_error',
      'Insufficient points balance',
      jsonb_build_object(
        'reward_id', p_reward_id,
        'user_id', p_user_id,
        'customer_id', v_customer_id,
        'points_balance', v_points_balance,
        'points_cost', v_reward_cost,
        'timestamp', now()
      )
    );
    
    RETURN;
  END IF;
  
  -- Check if reward has usage limit and if it's reached
  IF v_reward_limit IS NOT NULL AND v_reward_used_count >= v_reward_limit THEN
    message := 'تم الوصول إلى الحد الأقصى لاستخدام هذه المكافأة';
    
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'redeem_reward_error',
      'Reward usage limit reached',
      jsonb_build_object(
        'reward_id', p_reward_id,
        'user_id', p_user_id,
        'customer_id', v_customer_id,
        'usage_limit', v_reward_limit,
        'used_count', v_reward_used_count,
        'timestamp', now()
      )
    );
    
    RETURN;
  END IF;
  
  -- Generate a unique redemption code
  redemption_code := 'RED-' || floor(random() * 900000 + 100000)::TEXT;
  
  -- Create redemption record
  INSERT INTO points_redemptions (
    account_id,
    reward_id,
    points_spent,
    status,
    code,
    expires_at
  ) VALUES (
    v_account_id,
    p_reward_id,
    v_reward_cost,
    'active',
    redemption_code,
    CURRENT_TIMESTAMP + INTERVAL '30 days'
  ) RETURNING id INTO v_redemption_id;
  
  -- Deduct points from account
  UPDATE points_accounts
  SET 
    balance = balance - v_reward_cost,
    total_spent = total_spent + v_reward_cost,
    last_activity = CURRENT_TIMESTAMP
  WHERE id = v_account_id;
  
  -- Record the transaction
  INSERT INTO points_transactions (
    account_id,
    amount,
    type,
    description,
    reference_id
  ) VALUES (
    v_account_id,
    -v_reward_cost,
    'spend',
    'استبدال نقاط بمكافأة: ' || v_reward_name,
    v_redemption_id
  );
  
  -- Update reward usage count
  UPDATE points_rewards
  SET used_count = COALESCE(used_count, 0) + 1
  WHERE id = p_reward_id;
  
  -- Log the successful redemption
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'redeem_reward_success',
    'Points redeemed successfully',
    jsonb_build_object(
      'reward_id', p_reward_id,
      'user_id', p_user_id,
      'customer_id', v_customer_id,
      'account_id', v_account_id,
      'points_cost', v_reward_cost,
      'redemption_code', redemption_code,
      'timestamp', now()
    )
  );
  
  success := TRUE;
  message := 'تم استبدال النقاط بنجاح';
  RETURN;
EXCEPTION
  WHEN OTHERS THEN
    success := FALSE;
    message := 'حدث خطأ أثناء استبدال النقاط: ' || SQLERRM;
    
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'redeem_reward_error',
      'Error redeeming reward',
      jsonb_build_object(
        'reward_id', p_reward_id,
        'user_id', p_user_id,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    RETURN;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION redeem_reward(uuid, uuid) TO authenticated, anon;