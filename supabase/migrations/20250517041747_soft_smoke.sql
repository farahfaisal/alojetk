/*
# Fix null user ID error in create_order_with_status function

1. Changes
   - Modify the create_order_with_status function to handle null user IDs
   - Add a fallback user ID for order status history
   - Ensure order creation works even when the user is not authenticated

2. Security
   - Maintain existing RLS policies
   - Function remains security definer for proper access control
*/

-- Create or replace the function to handle order creation with status history
CREATE OR REPLACE FUNCTION create_order_with_status(order_data json)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_order orders;
  new_status_history order_status_history;
  current_user_id uuid;
  default_user_id uuid;
BEGIN
  -- Get the current user ID or use a default if null
  current_user_id := auth.uid();
  
  -- If current_user_id is null, find or create a default user in custom_users
  IF current_user_id IS NULL THEN
    -- Try to find an existing default user
    SELECT id INTO default_user_id FROM custom_users WHERE username = 'guest_user' LIMIT 1;
    
    -- If no default user exists, create one
    IF default_user_id IS NULL THEN
      INSERT INTO custom_users (
        username,
        password_hash,
        name,
        role,
        status
      ) VALUES (
        'guest_user',
        'not_applicable',
        'Guest User',
        'customer',
        'active'
      ) RETURNING id INTO default_user_id;
    END IF;
    
    current_user_id := default_user_id;
  END IF;

  -- Insert the order
  INSERT INTO orders (
    customer_name,
    customer_phone,
    address,
    city,
    payment_method,
    notes,
    delivery_fee,
    redemption_code,
    scheduled_time,
    is_scheduled,
    points_applied,
    points_discount,
    items_data,
    status,
    created_at
  )
  SELECT
    (order_data->>'customer_name')::text,
    (order_data->>'customer_phone')::text,
    (order_data->>'address')::text,
    (order_data->>'city')::text,
    (order_data->>'payment_method')::text,
    (order_data->>'notes')::text,
    (order_data->>'delivery_fee')::numeric,
    (order_data->>'redemption_code')::text,
    (order_data->>'scheduled_time')::timestamptz,
    (order_data->>'is_scheduled')::boolean,
    (order_data->>'points_applied')::integer,
    (order_data->>'points_discount')::numeric,
    (order_data->>'items_data')::jsonb,
    'pending',
    now()
  RETURNING * INTO new_order;

  -- Create initial status history entry with the determined user ID
  INSERT INTO order_status_history (
    order_id,
    status,
    note,
    created_by,
    created_at
  )
  VALUES (
    new_order.id,
    'pending',
    'تم إنشاء الطلب',
    current_user_id,
    now()
  )
  RETURNING * INTO new_status_history;

  -- Return the created order
  RETURN row_to_json(new_order);
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION create_order_with_status(json) TO authenticated, anon;

-- Ensure RLS is enabled on order_status_history
ALTER TABLE IF EXISTS order_status_history ENABLE ROW LEVEL SECURITY;

-- Add policy for order_status_history if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'order_status_history' 
    AND policyname = 'Authenticated users can insert into order status history'
  ) THEN
    CREATE POLICY "Authenticated users can insert into order status history" 
    ON order_status_history FOR INSERT 
    TO authenticated 
    WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'order_status_history' 
    AND policyname = 'Authenticated users can view order status history'
  ) THEN
    CREATE POLICY "Authenticated users can view order status history" 
    ON order_status_history FOR SELECT 
    TO authenticated 
    USING (true);
  END IF;
END $$;