/*
  # Points Rewards Redemption System

  1. New Functions
    - `has_redeemed_reward`: Checks if a user has already redeemed a specific reward
    - `redeem_reward`: Handles the reward redemption process

  2. Changes
    - No changes to existing tables or policies
*/

-- Function to check if a user has already redeemed a specific reward
CREATE OR REPLACE FUNCTION has_redeemed_reward(
  p_user_id uuid,
  p_reward_id uuid
) RETURNS boolean AS $$
DECLARE
  redemption_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM points_rewards_redemptions prr
    JOIN points_accounts pa ON pa.id = prr.account_id
    JOIN customers c ON c.id = pa.customer_id
    WHERE c.user_id = p_user_id
    AND prr.reward_id = p_reward_id
    AND prr.status != 'cancelled'
  ) INTO redemption_exists;
  
  RETURN redemption_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to redeem a reward
CREATE OR REPLACE FUNCTION redeem_reward(
  p_user_id uuid,
  p_reward_id uuid,
  OUT success boolean,
  OUT message text,
  OUT redemption_code text
) AS $$
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
  
  -- Get customer ID
  SELECT id INTO v_customer_id
  FROM customers
  WHERE user_id = p_user_id;
  
  IF v_customer_id IS NULL THEN
    message := 'المستخدم غير موجود';
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
    RETURN;
  END IF;
  
  -- Check if user has enough points
  IF v_points_balance < v_reward_cost THEN
    message := 'رصيد النقاط غير كافٍ';
    RETURN;
  END IF;
  
  -- Check if reward has usage limit and if it's reached
  IF v_reward_limit IS NOT NULL AND v_reward_used_count >= v_reward_limit THEN
    message := 'تم الوصول إلى الحد الأقصى لاستخدام هذه المكافأة';
    RETURN;
  END IF;
  
  -- Generate a unique redemption code
  redemption_code := 'RED-' || floor(random() * 900000 + 100000)::TEXT;
  
  -- Create redemption record
  INSERT INTO points_rewards_redemptions (
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
    'pending',
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
  
  success := true;
  message := 'تم استبدال النقاط بنجاح';
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;