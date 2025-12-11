/*
# Fix Order Creation Function

1. Changes
   - Drop all existing versions of create_order_with_status function
   - Create a new version with proper error handling
   - Add guest user support
   - Add proper RLS policies for anonymous users

2. Security
   - Enable RLS on order_status_history table
   - Add policies for authenticated and anonymous users
*/

-- First, drop all existing versions of the function
DROP FUNCTION IF EXISTS create_order_with_status(jsonb);
DROP FUNCTION IF EXISTS create_order_with_status(order_data jsonb);

-- Create a function to handle guest users if they don't exist
CREATE OR REPLACE FUNCTION get_or_create_guest_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  guest_user_id uuid;
BEGIN
  -- Try to find existing guest user
  SELECT id INTO guest_user_id FROM custom_users WHERE username = 'guest_user' LIMIT 1;
  
  -- If no guest user exists, create one
  IF guest_user_id IS NULL THEN
    INSERT INTO custom_users (
      username, 
      password_hash, 
      name, 
      role, 
      status
    ) VALUES (
      'guest_user',
      'not_a_real_password_hash',
      'Guest User',
      'customer',
      'active'
    )
    RETURNING id INTO guest_user_id;
  END IF;
  
  RETURN guest_user_id;
END;
$$;

-- Now create the create_order_with_status function with a unique name
CREATE OR REPLACE FUNCTION create_order_with_status_v2(order_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_order_id uuid;
  new_order_number text;
  current_user_id uuid;
  guest_user_id uuid;
  order_items jsonb;
  customer_id uuid;
  vendor_id uuid;
BEGIN
  -- Get current user ID or use guest user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    -- Use guest user for anonymous orders
    guest_user_id := get_or_create_guest_user();
    current_user_id := guest_user_id;
    
    RAISE NOTICE 'Using guest user ID: %', current_user_id;
  ELSE
    RAISE NOTICE 'Using authenticated user ID: %', current_user_id;
  END IF;

  -- Generate order number
  SELECT 'ORD-' || LPAD(CAST(FLOOR(random() * 900000 + 100000) AS TEXT), 6, '0') INTO new_order_number;
  
  -- Store items data
  order_items := order_data->'items_data';

  -- Get vendor ID from first item if available
  IF jsonb_array_length(order_items) > 0 THEN
    vendor_id := (order_items->0->>'vendor_id')::uuid;
  END IF;

  -- Create the order
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
    order_number,
    total,
    subtotal,
    vendor_id
  )
  VALUES (
    order_data->>'customer_name',
    order_data->>'customer_phone',
    order_data->>'address',
    order_data->>'city',
    order_data->>'payment_method',
    order_data->>'notes',
    (order_data->>'delivery_fee')::numeric,
    order_data->>'redemption_code',
    (order_data->>'scheduled_time')::timestamp with time zone,
    (order_data->>'is_scheduled')::boolean,
    (order_data->>'points_applied')::integer,
    (order_data->>'points_discount')::numeric,
    order_items,
    order_data->>'status',
    new_order_number,
    COALESCE((
      SELECT SUM(((item->>'price')::numeric) * ((item->>'quantity')::numeric))
      FROM jsonb_array_elements(order_items) AS item
    ), 0) + COALESCE((order_data->>'delivery_fee')::numeric, 0),
    COALESCE((
      SELECT SUM(((item->>'price')::numeric) * ((item->>'quantity')::numeric))
      FROM jsonb_array_elements(order_items) AS item
    ), 0),
    vendor_id
  )
  RETURNING id INTO new_order_id;

  -- Create order status history with error handling
  BEGIN
    INSERT INTO order_status_history (
      order_id,
      status,
      note,
      created_by
    )
    VALUES (
      new_order_id,
      order_data->>'status',
      'Order created',
      current_user_id
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but continue (don't fail the whole transaction)
    RAISE NOTICE 'Failed to create order status history: %', SQLERRM;
  END;

  -- Return the order details
  RETURN jsonb_build_object(
    'id', new_order_id,
    'order_number', new_order_number,
    'status', order_data->>'status',
    'success', true
  );
EXCEPTION WHEN OTHERS THEN
  -- Return error information
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION create_order_with_status_v2 TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_or_create_guest_user TO authenticated, anon;

-- Ensure RLS is enabled on order_status_history
ALTER TABLE IF EXISTS order_status_history ENABLE ROW LEVEL SECURITY;

-- Add policy for order status history if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'order_status_history' AND policyname = 'Authenticated users can insert into order status history'
  ) THEN
    CREATE POLICY "Authenticated users can insert into order status history" 
    ON order_status_history FOR INSERT 
    TO authenticated, anon
    WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'order_status_history' AND policyname = 'Authenticated users can view order status history'
  ) THEN
    CREATE POLICY "Authenticated users can view order status history" 
    ON order_status_history FOR SELECT 
    TO authenticated, anon
    USING (true);
  END IF;
END
$$;

-- Ensure orders table has proper RLS policies for anonymous users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'orders' AND policyname = 'Anonymous users can create orders'
  ) THEN
    CREATE POLICY "Anonymous users can create orders" 
    ON orders FOR INSERT 
    TO anon
    WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'orders' AND policyname = 'Anonymous users can view orders'
  ) THEN
    CREATE POLICY "Anonymous users can view orders" 
    ON orders FOR SELECT 
    TO anon
    USING (true);
  END IF;
END
$$;