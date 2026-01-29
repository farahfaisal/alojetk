/*
  # تحديث دالة الدفع من المحفظة - التأكد من وجود description دائماً

  ## التحديثات
  - التأكد من أن p_description لا يكون null أو فارغ
  - استخدام COALESCE للتأكد من وجود قيمة دائماً
*/

CREATE OR REPLACE FUNCTION pay_from_customer_wallet(
  p_customer_id UUID,
  p_order_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT DEFAULT 'دفع طلب'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance DECIMAL(10,2);
  v_transaction_id UUID;
  v_safe_description TEXT;
BEGIN
  -- التأكد من أن description ليس null أو فارغ
  v_safe_description := COALESCE(NULLIF(TRIM(p_description), ''), 'دفع طلب');

  -- البحث عن محفظة العميل
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM customer_wallets
  WHERE customer_id = p_customer_id;
  
  -- التحقق من وجود المحفظة
  IF v_wallet_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'محفظة العميل غير موجودة'
    );
  END IF;
  
  -- التحقق من كفاية الرصيد
  IF v_current_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'message', 'رصيد المحفظة غير كافي',
      'current_balance', v_current_balance,
      'required_amount', p_amount
    );
  END IF;
  
  -- إنشاء معاملة الدفع
  INSERT INTO customer_wallet_transactions (
    wallet_id,
    order_id,
    amount,
    type,
    payment_type,
    status,
    description
  ) VALUES (
    v_wallet_id,
    p_order_id,
    p_amount,
    'payment',
    'wallet',
    'completed',
    v_safe_description -- استخدام القيمة الآمنة
  ) RETURNING id INTO v_transaction_id;
  
  -- تحديث رصيد المحفظة
  UPDATE customer_wallets
  SET 
    balance = balance - p_amount,
    total_spent = total_spent + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  -- إرجاع النتيجة
  RETURN json_build_object(
    'success', true,
    'message', 'تم الدفع من المحفظة بنجاح',
    'transaction_id', v_transaction_id,
    'remaining_balance', v_current_balance - p_amount
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'حدث خطأ أثناء الدفع من المحفظة: ' || SQLERRM
    );
END;
$$;