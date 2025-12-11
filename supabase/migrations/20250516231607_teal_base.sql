/*
  # Connect user points to account page

  1. New Functions
    - `get_user_points` - Function to get a user's points balance
    - `get_user_points_history` - Function to get a user's points transaction history
  
  2. Security
    - Add RLS policies for points_accounts and points_transactions
    - Ensure users can only view their own points data
*/

-- Function to get a user's points balance
CREATE OR REPLACE FUNCTION get_user_points(user_phone TEXT)
RETURNS INTEGER AS $$
DECLARE
  points_balance INTEGER;
BEGIN
  SELECT pa.balance INTO points_balance
  FROM points_accounts pa
  JOIN customers c ON c.id = pa.customer_id
  WHERE c.phone = user_phone;
  
  RETURN COALESCE(points_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get a user's points history
CREATE OR REPLACE FUNCTION get_user_points_history(user_phone TEXT)
RETURNS TABLE (
  id UUID,
  amount INTEGER,
  type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pt.id,
    pt.amount,
    pt.type,
    pt.description,
    pt.created_at
  FROM points_transactions pt
  JOIN points_accounts pa ON pa.id = pt.account_id
  JOIN customers c ON c.id = pa.customer_id
  WHERE c.phone = user_phone
  ORDER BY pt.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure RLS is enabled on points tables
ALTER TABLE points_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_redemptions ENABLE ROW LEVEL SECURITY;

-- Add policies for points_accounts if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'points_accounts' 
    AND policyname = 'Users can view their own points account'
  ) THEN
    CREATE POLICY "Users can view their own points account" 
    ON points_accounts FOR SELECT 
    TO authenticated 
    USING (
      customer_id IN (
        SELECT id FROM customers WHERE phone = (
          SELECT phone FROM customers WHERE user_id = auth.uid()
        )
      )
    );
  END IF;
END $$;

-- Add policies for points_transactions if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'points_transactions' 
    AND policyname = 'Users can view their own points transactions'
  ) THEN
    CREATE POLICY "Users can view their own points transactions" 
    ON points_transactions FOR SELECT 
    TO authenticated 
    USING (
      account_id IN (
        SELECT pa.id FROM points_accounts pa
        JOIN customers c ON c.id = pa.customer_id
        WHERE c.phone = (
          SELECT phone FROM customers WHERE user_id = auth.uid()
        )
      )
    );
  END IF;
END $$;

-- Add policies for points_redemptions if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'points_redemptions' 
    AND policyname = 'Users can view their own points redemptions'
  ) THEN
    CREATE POLICY "Users can view their own points redemptions" 
    ON points_redemptions FOR SELECT 
    TO authenticated 
    USING (
      account_id IN (
        SELECT pa.id FROM points_accounts pa
        JOIN customers c ON c.id = pa.customer_id
        WHERE c.phone = (
          SELECT phone FROM customers WHERE user_id = auth.uid()
        )
      )
    );
  END IF;
END $$;

-- Create a function to redeem points
CREATE OR REPLACE FUNCTION redeem_points(
  user_phone TEXT,
  reward_id UUID,
  OUT success BOOLEAN,
  OUT message TEXT,
  OUT redemption_code TEXT
)
AS $$
DECLARE
  account_record RECORD;
  reward_record RECORD;
  points_needed INTEGER;
  redemption_id UUID;
BEGIN
  success := FALSE;
  
  -- Get the user's points account
  SELECT pa.*, c.id as customer_id 
  INTO account_record
  FROM points_accounts pa
  JOIN customers c ON c.id = pa.customer_id
  WHERE c.phone = user_phone;
  
  IF account_record IS NULL THEN
    message := 'حساب النقاط غير موجود';
    RETURN;
  END IF;
  
  -- Get the reward details
  SELECT * INTO reward_record
  FROM points_rewards
  WHERE id = reward_id AND status = 'active';
  
  IF reward_record IS NULL THEN
    message := 'المكافأة غير موجودة أو غير نشطة';
    RETURN;
  END IF;
  
  points_needed := reward_record.points_cost;
  
  -- Check if user has enough points
  IF account_record.balance < points_needed THEN
    message := 'رصيد النقاط غير كافٍ';
    RETURN;
  END IF;
  
  -- Check if reward has usage limit and if it's reached
  IF reward_record.usage_limit IS NOT NULL AND reward_record.used_count >= reward_record.usage_limit THEN
    message := 'تم الوصول إلى الحد الأقصى لاستخدام هذه المكافأة';
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
    account_record.id,
    reward_id,
    points_needed,
    'active',
    redemption_code,
    CURRENT_TIMESTAMP + INTERVAL '30 days'
  ) RETURNING id INTO redemption_id;
  
  -- Deduct points from account
  UPDATE points_accounts
  SET 
    balance = balance - points_needed,
    total_spent = total_spent + points_needed,
    last_activity = CURRENT_TIMESTAMP
  WHERE id = account_record.id;
  
  -- Record the transaction
  INSERT INTO points_transactions (
    account_id,
    amount,
    type,
    description,
    reference_id
  ) VALUES (
    account_record.id,
    -points_needed,
    'spend',
    'استبدال نقاط بمكافأة: ' || reward_record.name,
    redemption_id
  );
  
  -- Update reward usage count
  UPDATE points_rewards
  SET used_count = used_count + 1
  WHERE id = reward_id;
  
  success := TRUE;
  message := 'تم استبدال النقاط بنجاح';
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;