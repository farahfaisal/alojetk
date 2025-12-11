/*
  # Fix create_order_with_status_v2 function ambiguity

  1. Database Changes
    - Drop existing ambiguous function definitions
    - Create a single, properly defined create_order_with_status_v2 function
    - Ensure the function uses jsonb parameter type for consistency
    - Add proper error handling and return values

  2. Security
    - Maintain existing RLS policies
    - Ensure function has proper permissions
*/

-- Drop existing function definitions to resolve ambiguity
DROP FUNCTION IF EXISTS public.create_order_with_status_v2(order_data json);
DROP FUNCTION IF EXISTS public.create_order_with_status_v2(order_data jsonb);

-- Create a single, properly defined function
CREATE OR REPLACE FUNCTION public.create_order_with_status_v2(order_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_order_id uuid;
    new_order_number text;
    vendor_id_val uuid;
    customer_id_val uuid;
    subtotal_val numeric(10,2) := 0;
    total_val numeric(10,2);
    delivery_fee_val numeric(10,2);
    item_record jsonb;
    result jsonb;
BEGIN
    -- Validate required fields
    IF order_data->>'customer_name' IS NULL OR order_data->>'customer_name' = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer name is required');
    END IF;
    
    IF order_data->>'customer_phone' IS NULL OR order_data->>'customer_phone' = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer phone is required');
    END IF;
    
    IF order_data->>'payment_method' IS NULL OR order_data->>'payment_method' = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment method is required');
    END IF;
    
    -- Validate items_data
    IF order_data->'items_data' IS NULL OR jsonb_array_length(order_data->'items_data') = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order must contain at least one item');
    END IF;
    
    -- Extract vendor_id from first item
    vendor_id_val := (order_data->'items_data'->0->>'vendor_id')::uuid;
    
    IF vendor_id_val IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Vendor ID is required');
    END IF;
    
    -- Try to find existing customer by phone
    SELECT id INTO customer_id_val 
    FROM customers 
    WHERE phone = order_data->>'customer_phone' 
    LIMIT 1;
    
    -- If customer doesn't exist, create one
    IF customer_id_val IS NULL THEN
        INSERT INTO customers (name, phone, email)
        VALUES (
            order_data->>'customer_name',
            order_data->>'customer_phone',
            order_data->>'email'
        )
        RETURNING id INTO customer_id_val;
    END IF;
    
    -- Calculate subtotal from items
    FOR item_record IN SELECT * FROM jsonb_array_elements(order_data->'items_data')
    LOOP
        subtotal_val := subtotal_val + (
            (item_record->>'price')::numeric * (item_record->>'quantity')::integer
        );
    END LOOP;
    
    -- Get delivery fee
    delivery_fee_val := COALESCE((order_data->>'delivery_fee')::numeric, 0);
    
    -- Calculate total
    total_val := subtotal_val + delivery_fee_val - COALESCE((order_data->>'points_discount')::numeric, 0);
    
    -- Generate new order ID
    new_order_id := gen_random_uuid();
    
    -- Generate order number (simple format: ORD + timestamp)
    new_order_number := 'ORD' || EXTRACT(EPOCH FROM NOW())::bigint::text;
    
    -- Insert the order
    INSERT INTO orders (
        id,
        order_number,
        customer_id,
        vendor_id,
        status,
        customer_name,
        customer_phone,
        address,
        city,
        total,
        subtotal,
        delivery_fee,
        payment_method,
        notes,
        scheduled_time,
        is_scheduled,
        redemption_code,
        points_applied,
        points_discount,
        items_data,
        vendor_name,
        created_at,
        updated_at
    ) VALUES (
        new_order_id,
        new_order_number,
        customer_id_val,
        vendor_id_val,
        COALESCE(order_data->>'status', 'pending'),
        order_data->>'customer_name',
        order_data->>'customer_phone',
        order_data->>'address',
        order_data->>'city',
        total_val,
        subtotal_val,
        delivery_fee_val,
        order_data->>'payment_method',
        order_data->>'notes',
        CASE 
            WHEN order_data->>'scheduled_time' IS NOT NULL 
            THEN (order_data->>'scheduled_time')::timestamptz 
            ELSE NULL 
        END,
        COALESCE((order_data->>'is_scheduled')::boolean, false),
        order_data->>'redemption_code',
        COALESCE((order_data->>'points_applied')::integer, 0),
        COALESCE((order_data->>'points_discount')::numeric, 0),
        order_data->'items_data',
        (SELECT store_name FROM vendors WHERE id = vendor_id_val LIMIT 1),
        NOW(),
        NOW()
    );
    
    -- Insert order items
    FOR item_record IN SELECT * FROM jsonb_array_elements(order_data->'items_data')
    LOOP
        INSERT INTO order_items (
            order_id,
            product_id,
            quantity,
            price,
            total,
            notes,
            vendor_name
        ) VALUES (
            new_order_id,
            (item_record->>'product_id')::uuid,
            (item_record->>'quantity')::integer,
            (item_record->>'price')::numeric,
            (item_record->>'price')::numeric * (item_record->>'quantity')::integer,
            item_record->>'notes',
            item_record->>'vendor_name'
        );
    END LOOP;
    
    -- Insert initial status history
    INSERT INTO order_status_history (
        order_id,
        status,
        note,
        created_by,
        created_at
    ) VALUES (
        new_order_id,
        'pending',
        'Order created',
        customer_id_val,
        NOW()
    );
    
    -- Return success response
    result := jsonb_build_object(
        'success', true,
        'id', new_order_id,
        'order_number', new_order_number,
        'status', 'pending'
    );
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error response
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'detail', SQLSTATE
        );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_order_with_status_v2(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_status_v2(jsonb) TO anon;