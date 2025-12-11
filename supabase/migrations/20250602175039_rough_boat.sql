/*
  # Fix JSONB type casting in order creation function

  1. Changes
    - Modify create_order_with_status_v2 function to properly handle JSONB data
    - Add explicit JSONB casting for items_data array
    - Update function parameter type from json to jsonb

  2. Security
    - No changes to RLS policies
    - Maintains existing security model
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS create_order_with_status_v2(order_data jsonb);

-- Recreate the function with proper JSONB handling
CREATE OR REPLACE FUNCTION create_order_with_status_v2(order_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_order_id uuid;
  item_record record;
  vendor_id uuid;
BEGIN
  -- Insert the main order
  INSERT INTO orders (
    customer_name,
    customer_phone,
    address,
    city,
    payment_method,
    delivery_method,
    delivery_fee,
    scheduled_time,
    is_scheduled,
    redemption_code,
    points_applied,
    points_discount,
    items_data,
    status
  )
  VALUES (
    (order_data->>'customer_name')::text,
    (order_data->>'customer_phone')::text,
    (order_data->>'address')::text,
    (order_data->>'city')::text,
    (order_data->>'payment_method')::text,
    (order_data->>'delivery_method')::text,
    (order_data->>'delivery_fee')::numeric,
    (order_data->>'scheduled_time')::timestamptz,
    (order_data->>'is_scheduled')::boolean,
    (order_data->>'redemption_code')::text,
    (order_data->>'points_applied')::integer,
    (order_data->>'points_discount')::numeric,
    (order_data->'items_data')::jsonb,
    'pending'
  )
  RETURNING id INTO new_order_id;

  -- Process each item in the items_data array
  FOR item_record IN 
    SELECT * FROM jsonb_array_elements(order_data->'items_data') AS items
  LOOP
    -- Get the vendor_id from the first item (assuming all items are from the same vendor)
    IF vendor_id IS NULL THEN
      vendor_id := (item_record.value->>'vendor_id')::uuid;
    END IF;
    
    -- Insert order items
    INSERT INTO order_items (
      order_id,
      product_id,
      quantity,
      price,
      name,
      vendor_id,
      vendor_name,
      variant_name
    )
    VALUES (
      new_order_id,
      (item_record.value->>'product_id')::uuid,
      (item_record.value->>'quantity')::integer,
      (item_record.value->>'price')::numeric,
      (item_record.value->>'name')::text,
      (item_record.value->>'vendor_id')::uuid,
      (item_record.value->>'vendor_name')::text,
      (item_record.value->>'variant_name')::text
    );
  END LOOP;

  -- Update the order with the vendor_id
  UPDATE orders 
  SET vendor_id = vendor_id
  WHERE id = new_order_id;

  -- Insert initial status history
  INSERT INTO order_status_history (
    order_id,
    status,
    created_at
  )
  VALUES (
    new_order_id,
    'pending',
    now()
  );

  RETURN new_order_id;
END;
$$;