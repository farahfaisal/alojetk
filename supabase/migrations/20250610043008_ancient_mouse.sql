/*
  # Fix Order Completion Issue
  
  1. Changes
    - Make created_by column nullable in order_status_history table
    - Create a default system user for automated status updates
    - Add trigger to handle NULL created_by values
    - Fix ambiguous item reference in create_order_with_status_v2 function
  
  2. Security
    - Safely check for existing system user before creating
    - Maintain proper error handling and logging
*/

-- First, let's make the created_by column nullable
ALTER TABLE order_status_history 
ALTER COLUMN created_by DROP NOT NULL;

-- Check if system user exists before trying to create it
DO $$
DECLARE
  system_user_count integer;
  system_user_id uuid;
BEGIN
  -- Check if a system user already exists
  SELECT COUNT(*) INTO system_user_count 
  FROM custom_users 
  WHERE username = 'system' OR id = '00000000-0000-0000-0000-000000000000';
  
  -- If no system user exists, create one with a new UUID
  IF system_user_count = 0 THEN
    system_user_id := gen_random_uuid();
    
    INSERT INTO custom_users (
      id,
      username,
      name,
      role,
      status,
      created_at
    ) VALUES (
      system_user_id,
      'system',
      'System User',
      'admin',
      'active',
      now()
    );
    
    -- Log the creation
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'system_user_created',
      'Created system user for order status updates',
      jsonb_build_object(
        'id', system_user_id,
        'timestamp', now()
      )
    );
  ELSE
    -- Get the existing system user ID
    SELECT id INTO system_user_id 
    FROM custom_users 
    WHERE username = 'system' OR id = '00000000-0000-0000-0000-000000000000'
    LIMIT 1;
  END IF;
  
  -- Create or replace function to handle created_by when NULL
  EXECUTE format('
    CREATE OR REPLACE FUNCTION handle_order_status_created_by()
    RETURNS TRIGGER AS $func$
    BEGIN
      -- If created_by is NULL, set it to the system user
      IF NEW.created_by IS NULL THEN
        NEW.created_by := %L;
      END IF;
      
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  ', system_user_id);
  
  -- Update any existing NULL values
  EXECUTE format('
    UPDATE order_status_history 
    SET created_by = %L
    WHERE created_by IS NULL;
  ', system_user_id);
END $$;

-- Create trigger to automatically set created_by when NULL
DROP TRIGGER IF EXISTS set_order_status_created_by_trigger ON order_status_history;
CREATE TRIGGER set_order_status_created_by_trigger
  BEFORE INSERT ON order_status_history
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_status_created_by();

-- Drop the existing function with ambiguous item reference
DROP FUNCTION IF EXISTS create_order_with_status_v2(jsonb);

-- Create a new version with fixed item references
CREATE OR REPLACE FUNCTION create_order_with_status_v2(order_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_order_id uuid;
  order_number text;
  order_items jsonb;
  item_data jsonb;
  order_status text;
  vendor_id uuid;
  subtotal numeric := 0;
  total numeric := 0;
  delivery_fee numeric := 0;
  points_discount numeric := 0;
BEGIN
  -- Generate new order ID and number
  new_order_id := gen_random_uuid();
  order_number := 'ORD-' || substring(new_order_id::text, 1, 8);
  
  -- Extract items array from order data
  order_items := order_data->'items_data';
  
  -- Get vendor ID from first item if available
  IF jsonb_array_length(order_items) > 0 THEN
    vendor_id := (order_items->0->>'vendor_id')::uuid;
  END IF;
  
  -- Calculate subtotal
  SELECT 
    COALESCE(SUM((item_element->>'price')::numeric * (item_element->>'quantity')::numeric), 0)
  INTO subtotal
  FROM jsonb_array_elements(order_items) AS item_element;
  
  -- Get delivery fee and points discount
  delivery_fee := COALESCE((order_data->>'delivery_fee')::numeric, 0);
  points_discount := COALESCE((order_data->>'points_discount')::numeric, 0);
  
  -- Calculate total
  total := subtotal + delivery_fee - points_discount;
  
  -- Insert the order
  INSERT INTO orders (
    id,
    order_number,
    status,
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
    created_at,
    items_data,
    vendor_id,
    subtotal,
    total,
    vendor_name
  )
  VALUES (
    new_order_id,
    order_number,
    COALESCE(order_data->>'status', 'pending'),
    order_data->>'customer_name',
    order_data->>'customer_phone',
    order_data->>'address',
    order_data->>'city',
    order_data->>'payment_method',
    order_data->>'notes',
    delivery_fee,
    order_data->>'redemption_code',
    NULLIF(order_data->>'scheduled_time', '')::timestamptz,
    COALESCE((order_data->>'is_scheduled')::boolean, false),
    COALESCE((order_data->>'points_applied')::integer, 0),
    points_discount,
    COALESCE((order_data->>'created_at')::timestamptz, now()),
    order_items,
    vendor_id,
    subtotal,
    total,
    order_data->>'vendor_name'
  );

  -- Insert order items if the table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items') THEN
    FOR item_data IN SELECT * FROM jsonb_array_elements(order_items)
    LOOP
      INSERT INTO order_items (
        order_id,
        product_id,
        quantity,
        price,
        total,
        vendor_id,
        vendor_name,
        name,
        notes
      )
      VALUES (
        new_order_id,
        (item_data->>'product_id')::uuid,
        COALESCE((item_data->>'quantity')::integer, 1),
        COALESCE((item_data->>'price')::numeric, 0),
        COALESCE((item_data->>'price')::numeric, 0) * COALESCE((item_data->>'quantity')::integer, 1),
        (item_data->>'vendor_id')::uuid,
        item_data->>'vendor_name',
        item_data->>'name',
        item_data->>'notes'
      );
    END LOOP;
  END IF;

  -- Create initial status history entry with NULL created_by
  -- The trigger will handle setting the correct value
  INSERT INTO order_status_history (
    order_id,
    status,
    note,
    created_by
  ) VALUES (
    new_order_id,
    COALESCE(order_data->>'status', 'pending'),
    'تم إنشاء الطلب',
    NULL
  );

  -- Get order status for response
  SELECT status INTO order_status
  FROM orders
  WHERE id = new_order_id;

  -- Return order details
  RETURN jsonb_build_object(
    'success', true,
    'id', new_order_id,
    'order_number', order_number,
    'status', order_status
  );
EXCEPTION
  WHEN others THEN
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'order_creation_error',
      'Error creating order',
      jsonb_build_object(
        'error', SQLERRM,
        'detail', SQLSTATE,
        'order_data', order_data
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_order_with_status_v2(jsonb) TO authenticated, anon;