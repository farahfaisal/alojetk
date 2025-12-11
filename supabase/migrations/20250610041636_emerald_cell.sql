/*
  # Fix order_status_history foreign key constraint
  
  1. Changes
    - Make created_by column nullable
    - Use existing system user or create one if needed
    - Add trigger to handle NULL created_by values
    - Update existing NULL values
  
  2. Security
    - Maintain existing RLS policies
    - Ensure proper error handling
*/

-- First, let's make the created_by column nullable if it's not already
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'order_status_history' 
    AND column_name = 'created_by' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE order_status_history 
    ALTER COLUMN created_by DROP NOT NULL;
  END IF;
END $$;

-- Check if we have a system user, if not find an existing admin user to use
DO $$
DECLARE
  system_user_id uuid;
  admin_user_id uuid;
BEGIN
  -- First check if we already have a system user
  SELECT id INTO system_user_id 
  FROM custom_users 
  WHERE username = 'system' OR id = '00000000-0000-0000-0000-000000000000'
  LIMIT 1;
  
  -- If no system user exists, find an admin user
  IF system_user_id IS NULL THEN
    SELECT id INTO admin_user_id 
    FROM custom_users 
    WHERE role = 'admin' 
    LIMIT 1;
    
    -- If we found an admin user, use that ID
    IF admin_user_id IS NOT NULL THEN
      system_user_id := admin_user_id;
    ELSE
      -- If no admin user exists, try to find any user
      SELECT id INTO system_user_id 
      FROM custom_users 
      LIMIT 1;
      
      -- If we still don't have a user, create one with a new UUID
      IF system_user_id IS NULL THEN
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
      END IF;
    END IF;
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

-- Update the create_order_with_status_v2 function to handle NULL created_by
CREATE OR REPLACE FUNCTION create_order_with_status_v2(order_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_order_id uuid;
  order_number text;
  order_items jsonb;
  item jsonb;
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
    COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::numeric), 0)
  INTO subtotal
  FROM jsonb_array_elements(order_items) AS item;
  
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
    FOR item IN SELECT * FROM jsonb_array_elements(order_items)
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
        (item->>'product_id')::uuid,
        COALESCE((item->>'quantity')::integer, 1),
        COALESCE((item->>'price')::numeric, 0),
        COALESCE((item->>'price')::numeric, 0) * COALESCE((item->>'quantity')::integer, 1),
        (item->>'vendor_id')::uuid,
        item->>'vendor_name',
        item->>'name',
        item->>'notes'
      );
    END LOOP;
  END IF;

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