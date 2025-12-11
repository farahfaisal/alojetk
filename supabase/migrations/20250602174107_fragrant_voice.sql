/*
  # Fix Order Creation Function
  
  1. Changes
    - Update create_order_with_status_v2 function to let the database calculate total
    - Remove total from the INSERT statement
    - Calculate subtotal from items_data
    
  2. Security
    - Maintain SECURITY DEFINER attribute for proper access control
    - Ensure proper error handling and logging
*/

-- First drop the existing function
DROP FUNCTION IF EXISTS create_order_with_status_v2(jsonb);

-- Then recreate it with the fixed implementation
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
  
  -- Insert the order WITHOUT specifying total (let it be calculated by the database)
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