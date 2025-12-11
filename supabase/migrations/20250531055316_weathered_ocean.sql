/*
  # Fix ambiguous ID column in create_order_with_status_v2 function

  1. Changes
    - Drop and recreate the create_order_with_status_v2 function
    - Add explicit table aliases to all ID column references
    - Ensure proper column qualification throughout the function
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.create_order_with_status_v2(order_data jsonb);

-- Recreate the function with proper column qualification
CREATE OR REPLACE FUNCTION public.create_order_with_status_v2(order_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_order_id uuid;
    new_order_record record;
    item_record record;
    vendor_record record;
    customer_record record;
BEGIN
    -- Create the order
    INSERT INTO orders (
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
        items_data,
        status,
        created_at
    )
    SELECT
        order_data->>'customer_name',
        order_data->>'customer_phone',
        order_data->>'address',
        order_data->>'city',
        order_data->>'payment_method',
        order_data->>'delivery_method',
        order_data->>'notes',
        COALESCE((order_data->>'delivery_fee')::numeric, 0),
        order_data->>'redemption_code',
        (order_data->>'scheduled_time')::timestamp with time zone,
        COALESCE((order_data->>'is_scheduled')::boolean, false),
        COALESCE((order_data->>'points_applied')::integer, 0),
        COALESCE((order_data->>'points_discount')::numeric, 0),
        COALESCE(order_data->'items_data', '[]'::jsonb),
        COALESCE(order_data->>'status', 'pending'),
        COALESCE((order_data->>'created_at')::timestamp with time zone, now())
    RETURNING orders.id INTO new_order_id;

    -- Get the created order
    SELECT * INTO new_order_record FROM orders WHERE orders.id = new_order_id;

    -- Create order items
    FOR item_record IN 
        SELECT * FROM jsonb_array_elements(COALESCE(order_data->'items_data', '[]'::jsonb))
    LOOP
        INSERT INTO order_items (
            order_id,
            product_id,
            quantity,
            price,
            total,
            notes
        )
        VALUES (
            new_order_id,
            (item_record.value->>'product_id')::uuid,
            COALESCE((item_record.value->>'quantity')::integer, 1),
            COALESCE((item_record.value->>'price')::numeric, 0),
            COALESCE((item_record.value->>'price')::numeric * COALESCE((item_record.value->>'quantity')::integer, 1), 0),
            item_record.value->>'notes'
        );
    END LOOP;

    -- Create initial order status history
    INSERT INTO order_status_history (
        order_id,
        status,
        created_by,
        note
    )
    VALUES (
        new_order_id,
        new_order_record.status,
        auth.uid(),
        'Order created'
    );

    -- Return the created order data
    RETURN jsonb_build_object(
        'success', true,
        'order_id', new_order_id,
        'status', new_order_record.status
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