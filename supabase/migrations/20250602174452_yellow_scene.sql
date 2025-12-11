/*
  # Fix ambiguous item reference in create_order_with_status_v2 function

  1. Changes
    - Drop and recreate the create_order_with_status_v2 function with fixed item references
    - Properly qualify all item references with their table/alias names
    - Add better error handling and validation
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS create_order_with_status_v2;

-- Recreate the function with fixed item references
CREATE OR REPLACE FUNCTION create_order_with_status_v2(order_data json)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_order_id uuid;
    order_number text;
    vendor_id uuid;
    item_data json;
    order_items_data jsonb[];
    order_status text := 'pending';
BEGIN
    -- Extract vendor_id from the first item
    SELECT (items->>>'vendor_id')::uuid 
    INTO vendor_id
    FROM jsonb_array_elements(order_data->'items_data') as items
    LIMIT 1;

    -- Generate order number
    SELECT CONCAT('ORD-', SUBSTRING(UPPER(encode(gen_random_bytes(6), 'hex')), 1, 8))
    INTO order_number;

    -- Create the order
    INSERT INTO orders (
        customer_name,
        customer_phone,
        address,
        city,
        payment_method,
        delivery_method,
        delivery_fee,
        status,
        vendor_id,
        order_number,
        scheduled_time,
        is_scheduled,
        redemption_code,
        points_applied,
        points_discount,
        items_data
    ) VALUES (
        order_data->>'customer_name',
        order_data->>'customer_phone',
        order_data->>'address',
        order_data->>'city',
        order_data->>'payment_method',
        order_data->>'delivery_method',
        COALESCE((order_data->>'delivery_fee')::numeric, 0),
        order_status,
        vendor_id,
        order_number,
        (order_data->>'scheduled_time')::timestamp with time zone,
        COALESCE((order_data->>'is_scheduled')::boolean, false),
        order_data->>'redemption_code',
        COALESCE((order_data->>'points_applied')::integer, 0),
        COALESCE((order_data->>'points_discount')::numeric, 0),
        order_data->'items_data'
    )
    RETURNING id INTO new_order_id;

    -- Insert order items
    INSERT INTO order_items (
        order_id,
        product_id,
        quantity,
        price,
        name,
        variant_name,
        vendor_id,
        vendor_name
    )
    SELECT 
        new_order_id,
        (item_data->>'product_id')::uuid,
        (item_data->>'quantity')::integer,
        (item_data->>'price')::numeric,
        item_data->>'name',
        item_data->>'variant_name',
        (item_data->>'vendor_id')::uuid,
        item_data->>'vendor_name'
    FROM jsonb_array_elements(order_data->'items_data') AS item_data;

    -- Create initial order status history
    INSERT INTO order_status_history (
        order_id,
        status,
        created_at
    ) VALUES (
        new_order_id,
        order_status,
        now()
    );

    -- Return success response
    RETURN json_build_object(
        'success', true,
        'id', new_order_id,
        'order_number', order_number,
        'status', order_status
    );

EXCEPTION WHEN OTHERS THEN
    -- Return error response
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'detail', SQLSTATE
    );
END;
$$;