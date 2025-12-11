/*
  # إضافة دوال الدفع من المحفظة

  1. دوال جديدة
    - `pay_from_customer_wallet()` - دفع من محفظة العميل
    - `process_wallet_payment()` - معالجة دفعة المحفظة
    
  2. تحديثات
    - تحديث رصيد المحفظة عند الدفع
    - إنشاء سجل معاملة للدفع
    - التحقق من كفاية الرصيد
*/

-- دالة للدفع من محفظة العميل
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
BEGIN
  -- التحقق من وجود المحفظة
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM customer_wallets
  WHERE customer_id = p_customer_id;
  
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
    p_description
  ) RETURNING id INTO v_transaction_id;
  
  -- تحديث رصيد المحفظة
  UPDATE customer_wallets
  SET 
    balance = balance - p_amount,
    total_spent = total_spent + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'تم الدفع من المحفظة بنجاح',
    'transaction_id', v_transaction_id,
    'remaining_balance', v_current_balance - p_amount
  );
END;
$$;

-- دالة للتحقق من رصيد المحفظة
CREATE OR REPLACE FUNCTION check_wallet_balance(
  p_customer_id UUID,
  p_required_amount DECIMAL(10,2)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
BEGIN
  -- الحصول على الرصيد الحالي
  SELECT balance INTO v_current_balance
  FROM customer_wallets
  WHERE customer_id = p_customer_id;
  
  IF v_current_balance IS NULL THEN
    v_current_balance := 0;
  END IF;
  
  RETURN json_build_object(
    'sufficient', v_current_balance >= p_required_amount,
    'current_balance', v_current_balance,
    'required_amount', p_required_amount,
    'shortage', GREATEST(0, p_required_amount - v_current_balance)
  );
END;
$$;

-- دالة لاسترداد الأموال للمحفظة (في حالة إلغاء الطلب)
CREATE OR REPLACE FUNCTION refund_to_customer_wallet(
  p_customer_id UUID,
  p_order_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT DEFAULT 'استرداد طلب ملغي'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
BEGIN
  -- التحقق من وجود المحفظة
  SELECT id INTO v_wallet_id
  FROM customer_wallets
  WHERE customer_id = p_customer_id;
  
  IF v_wallet_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'محفظة العميل غير موجودة'
    );
  END IF;
  
  -- إنشاء معاملة الاسترداد
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
    'refund',
    'wallet',
    'completed',
    p_description
  ) RETURNING id INTO v_transaction_id;
  
  -- تحديث رصيد المحفظة
  UPDATE customer_wallets
  SET 
    balance = balance + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'تم استرداد المبلغ للمحفظة بنجاح',
    'transaction_id', v_transaction_id
  );
END;
$$;