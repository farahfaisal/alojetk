-- Drop the existing function
DROP FUNCTION IF EXISTS award_points_for_order(uuid);

-- Create an improved version with better logging and error handling
CREATE OR REPLACE FUNCTION award_points_for_order(
  p_order_id uuid,
  OUT success boolean,
  OUT message text,
  OUT points_awarded integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_customer_id uuid;
  v_account_id uuid;
  v_points_to_award integer;
  v_transaction_id uuid;
BEGIN
  success := false;
  points_awarded := 0;
  
  -- Get order details
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    message := 'الطلب غير موجود';
    
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'award_points_error',
      'Order not found',
      jsonb_build_object(
        'order_id', p_order_id,
        'timestamp', now()
      )
    );
    
    RETURN;
  END IF;
  
  -- Log the order details for debugging
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'award_points_debug',
    'Order details for points calculation',
    jsonb_build_object(
      'order_id', p_order_id,
      'subtotal', v_order.subtotal,
      'total', v_order.total,
      'customer_id', v_order.customer_id,
      'customer_phone', v_order.customer_phone,
      'timestamp', now()
    )
  );
  
  -- Get customer ID
  v_customer_id := v_order.customer_id;
  
  -- If no customer ID, try to find by phone
  IF v_customer_id IS NULL AND v_order.customer_phone IS NOT NULL THEN
    SELECT id INTO v_customer_id
    FROM customers
    WHERE phone = v_order.customer_phone
    LIMIT 1;
    
    -- If still no customer ID, create a new customer
    IF v_customer_id IS NULL AND v_order.customer_name IS NOT NULL THEN
      INSERT INTO customers (
        name,
        phone,
        created_at
      ) VALUES (
        v_order.customer_name,
        v_order.customer_phone,
        now()
      ) RETURNING id INTO v_customer_id;
    END IF;
  END IF;
  
  -- If still no customer ID, we can't award points
  IF v_customer_id IS NULL THEN
    message := 'لا يمكن العثور على العميل';
    
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'award_points_error',
      'Customer not found',
      jsonb_build_object(
        'order_id', p_order_id,
        'customer_phone', v_order.customer_phone,
        'customer_name', v_order.customer_name,
        'timestamp', now()
      )
    );
    
    RETURN;
  END IF;
  
  -- Calculate points to award (1 point per shekel)
  -- Make sure we're using the subtotal, not the total (which includes delivery fee)
  -- Also ensure we're using FLOOR to get a whole number
  IF v_order.subtotal IS NOT NULL AND v_order.subtotal > 0 THEN
    v_points_to_award := FLOOR(v_order.subtotal)::integer;
  ELSE
    -- If subtotal is NULL or 0, try using total minus delivery fee
    v_points_to_award := FLOOR(COALESCE(v_order.total, 0) - COALESCE(v_order.delivery_fee, 0))::integer;
  END IF;
  
  -- Ensure we award at least 1 point for any valid order
  IF v_points_to_award <= 0 AND COALESCE(v_order.total, 0) > 0 THEN
    v_points_to_award := 1;
  END IF;
  
  -- If no points to award, return
  IF v_points_to_award <= 0 THEN
    message := 'لا توجد نقاط للإضافة';
    
    -- Log the message
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'award_points_info',
      'No points to award',
      jsonb_build_object(
        'order_id', p_order_id,
        'customer_id', v_customer_id,
        'order_total', v_order.total,
        'order_subtotal', v_order.subtotal,
        'calculated_points', v_points_to_award,
        'timestamp', now()
      )
    );
    
    RETURN;
  END IF;
  
  -- Get or create points account
  SELECT id INTO v_account_id
  FROM points_accounts
  WHERE customer_id = v_customer_id;
  
  IF v_account_id IS NULL THEN
    INSERT INTO points_accounts (
      customer_id,
      balance,
      total_earned,
      total_spent,
      last_activity
    ) VALUES (
      v_customer_id,
      v_points_to_award,
      v_points_to_award,
      0,
      now()
    ) RETURNING id INTO v_account_id;
  ELSE
    -- Update existing account
    UPDATE points_accounts
    SET 
      balance = balance + v_points_to_award,
      total_earned = total_earned + v_points_to_award,
      last_activity = now()
    WHERE id = v_account_id;
  END IF;
  
  -- Record transaction
  INSERT INTO points_transactions (
    account_id,
    amount,
    type,
    description,
    reference_id
  ) VALUES (
    v_account_id,
    v_points_to_award,
    'earn',
    'نقاط مكتسبة من الطلب #' || COALESCE(v_order.order_number, v_order.id::text),
    p_order_id
  ) RETURNING id INTO v_transaction_id;
  
  -- Log the successful points award
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'award_points_success',
    'Points awarded successfully',
    jsonb_build_object(
      'order_id', p_order_id,
      'customer_id', v_customer_id,
      'points_awarded', v_points_to_award,
      'account_id', v_account_id,
      'transaction_id', v_transaction_id,
      'timestamp', now()
    )
  );
  
  success := TRUE;
  message := 'تم إضافة النقاط بنجاح';
  points_awarded := v_points_to_award;
  RETURN;
EXCEPTION
  WHEN OTHERS THEN
    success := FALSE;
    message := 'حدث خطأ أثناء إضافة النقاط: ' || SQLERRM;
    
    -- Log the error
    INSERT INTO system_logs (
      event_type,
      message,
      details
    ) VALUES (
      'award_points_error',
      'Error awarding points',
      jsonb_build_object(
        'order_id', p_order_id,
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    RETURN;
END;
$$;

-- Update the create_order_with_status_v2 function to properly return points
DROP FUNCTION IF EXISTS create_order_with_status_v2(jsonb);

CREATE OR REPLACE FUNCTION create_order_with_status_v2(order_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_order_id uuid;
  order_number text;
  order_items jsonb;
  item_element jsonb;
  order_status text;
  vendor_id uuid;
  subtotal numeric := 0;
  total numeric := 0;
  delivery_fee numeric := 0;
  points_discount numeric := 0;
  points_result record;
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
    COALESCE(SUM((elem->>'price')::numeric * (elem->>'quantity')::numeric), 0)
  INTO subtotal
  FROM jsonb_array_elements(order_items) AS elem;
  
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
    FOR item_element IN SELECT * FROM jsonb_array_elements(order_items)
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
        (item_element->>'product_id')::uuid,
        COALESCE((item_element->>'quantity')::integer, 1),
        COALESCE((item_element->>'price')::numeric, 0),
        COALESCE((item_element->>'price')::numeric, 0) * COALESCE((item_element->>'quantity')::integer, 1),
        (item_element->>'vendor_id')::uuid,
        item_element->>'vendor_name',
        item_element->>'name',
        item_element->>'notes'
      );
    END LOOP;
  END IF;

  -- Create initial status history entry with NULL created_by
  -- The trigger will handle setting the correct value
  INSERT INTO order_status_history (
    order_id,
    status,
    note
  ) VALUES (
    new_order_id,
    COALESCE(order_data->>'status', 'pending'),
    'تم إنشاء الطلب'
  );

  -- Award points for the order
  SELECT * FROM award_points_for_order(new_order_id) INTO points_result;
  
  -- Log the points award result
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'order_points_award',
    CASE WHEN points_result.success THEN 'Points awarded successfully' ELSE 'Failed to award points' END,
    jsonb_build_object(
      'order_id', new_order_id,
      'success', points_result.success,
      'message', points_result.message,
      'points_awarded', points_result.points_awarded,
      'subtotal', subtotal,
      'total', total,
      'timestamp', now()
    )
  );

  -- Get order status for response
  SELECT status INTO order_status
  FROM orders
  WHERE id = new_order_id;

  -- Return order details with points information
  RETURN jsonb_build_object(
    'success', true,
    'id', new_order_id,
    'order_number', order_number,
    'status', order_status,
    'points_awarded', COALESCE(points_result.points_awarded, 0)
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
GRANT EXECUTE ON FUNCTION award_points_for_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION create_order_with_status_v2(jsonb) TO authenticated, anon;