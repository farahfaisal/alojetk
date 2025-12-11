/*
  # Create spend_points function

  1. New Function
    - `spend_points` - Deducts points from a customer's account and records the transaction
    
  2. Parameters
    - p_account_id: The points account ID
    - p_points: Number of points to spend
    - p_description: Description of the transaction
    
  3. Security
    - Function validates that sufficient points are available
    - Creates transaction record for audit trail
*/

CREATE OR REPLACE FUNCTION spend_points(
  p_account_id UUID,
  p_points INTEGER,
  p_description TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- Get current balance
  SELECT balance INTO v_current_balance
  FROM points_accounts
  WHERE id = p_account_id;
  
  -- Check if account exists
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'حساب النقاط غير موجود');
  END IF;
  
  -- Check if sufficient points
  IF v_current_balance < p_points THEN
    RETURN json_build_object('success', false, 'message', 'رصيد نقاط غير كافٍ');
  END IF;
  
  -- Update balance
  UPDATE points_accounts
  SET 
    balance = balance - p_points,
    total_spent = total_spent + p_points,
    last_activity = NOW()
  WHERE id = p_account_id;
  
  -- Create transaction record
  INSERT INTO points_transactions (account_id, amount, type, description)
  VALUES (p_account_id, -p_points, 'spend', p_description)
  RETURNING id INTO v_transaction_id;
  
  RETURN json_build_object(
    'success', true, 
    'message', 'تم خصم النقاط بنجاح',
    'transaction_id', v_transaction_id,
    'points_spent', p_points,
    'new_balance', v_current_balance - p_points
  );
END;
$$;
