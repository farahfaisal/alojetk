/*
  # Fix create_order_with_status_v2 function
  
  1. Changes
    - Drop the existing function before recreating it
    - Fix ambiguous column references
    - Properly handle order items
  
  2. Security
    - Maintain SECURITY DEFINER attribute
    - Preserve existing functionality
*/

-- First drop the existing function
DROP FUNCTION IF EXISTS create_order_with_status_v2(jsonb);

-- Then recreate it with the fixed implementation
CREATE FUNCTION create_order_with_status_v2(order_data jsonb)
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
BEGIN
  -- Extract items array from order data
  order_items := order_data->'items_data';
  
  -- Generate new order ID and number
  new_order_id := gen_random_uuid();
  order_number := 'ORD-' || substring(new_order_id::text, 1, 8);
  
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
    delivery_method,
    notes,
    delivery_fee,
    redemption_code,
    scheduled_time,
    is_scheduled,
    points_applied,
    points_discount,
    created_at
  )
  VALUES (
    new_order_id,
    order_number,
    order_data->>'status',
    order_data->>'customer_name',
    order_data->>'customer_phone',
    order_data->>'address',
    order_data->>'city',
    order_data->>'payment_method',
    order_data->>'delivery_method',
    order_data->>'notes',
    (order_data->>'delivery_fee')::numeric,
    order_data->>'redemption_code',
    (order_data->>'scheduled_time')::timestamptz,
    (order_data->>'is_scheduled')::boolean,
    (order_data->>'points_applied')::integer,
    (order_data->>'points_discount')::numeric,
    COALESCE((order_data->>'created_at')::timestamptz, now())
  );

  -- Insert order items
  FOR item IN SELECT * FROM jsonb_array_elements(order_items)
  LOOP
    INSERT INTO order_items (
      order_id,
      product_id,
      quantity,
      price,
      vendor_id,
      vendor_name,
      name
    )
    VALUES (
      new_order_id,
      (item->>'product_id')::text,
      (item->>'quantity')::integer,
      (item->>'price')::numeric,
      (item->>'vendor_id')::text,
      item->>'vendor_name',
      item->>'name'
    );
  END LOOP;

  -- Get order status for response
  SELECT orders.status INTO order_status
  FROM orders
  WHERE orders.id = new_order_id;

  -- Return order details
  RETURN jsonb_build_object(
    'success', true,
    'id', new_order_id,
    'order_number', order_number,
    'status', order_status
  );
EXCEPTION
  WHEN others THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;