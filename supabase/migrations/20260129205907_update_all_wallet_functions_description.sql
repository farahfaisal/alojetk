/*
  # تحديث جميع دوال المحفظة للتأكد من وجود description

  ## التحديثات
  - إضافة قيم افتراضية لـ description في جميع الدوال
  - استخدام COALESCE للتأكد من عدم وجود null
*/

-- تحديث دالة add_money_to_customer_wallet
CREATE OR REPLACE FUNCTION add_money_to_customer_wallet(
  p_customer_id uuid,
  p_amount numeric,
  p_description text DEFAULT 'إيداع في المحفظة',
  p_payment_type text DEFAULT 'admin_adjustment',
  p_reference_id text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_wallet_id uuid;
  v_transaction_id uuid;
  v_safe_description text;
BEGIN
  -- التأكد من وجود description
  v_safe_description := COALESCE(NULLIF(TRIM(p_description), ''), 'إيداع في المحفظة');

  -- البحث عن محفظة العميل
  SELECT id INTO v_wallet_id
  FROM customer_wallets
  WHERE customer_id = p_customer_id;
  
  -- إنشاء محفظة إذا لم تكن موجودة
  IF v_wallet_id IS NULL THEN
    INSERT INTO customer_wallets (customer_id)
    VALUES (p_customer_id)
    RETURNING id INTO v_wallet_id;
  END IF;
  
  -- إضافة معاملة الإيداع
  INSERT INTO customer_wallet_transactions (
    wallet_id,
    amount,
    type,
    payment_type,
    status,
    description,
    reference_id
  ) VALUES (
    v_wallet_id,
    p_amount,
    'deposit',
    p_payment_type,
    'completed',
    v_safe_description,
    p_reference_id
  ) RETURNING id INTO v_transaction_id;
  
  UPDATE customer_wallets
  SET 
    balance = balance + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'تم إضافة المبلغ بنجاح',
    'transaction_id', v_transaction_id,
    'wallet_id', v_wallet_id
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'message', 'فشل في إضافة المبلغ: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تحديث دالة withdraw_from_customer_wallet
CREATE OR REPLACE FUNCTION withdraw_from_customer_wallet(
  p_customer_id uuid,
  p_amount numeric,
  p_description text DEFAULT 'سحب من المحفظة',
  p_payment_type text DEFAULT 'cash',
  p_reference_id text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_wallet_id uuid;
  v_current_balance numeric;
  v_transaction_id uuid;
  v_safe_description text;
BEGIN
  -- التأكد من وجود description
  v_safe_description := COALESCE(NULLIF(TRIM(p_description), ''), 'سحب من المحفظة');

  -- البحث عن محفظة العميل
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
      'message', 'الرصيد غير كافي'
    );
  END IF;
  
  -- إضافة معاملة السحب
  INSERT INTO customer_wallet_transactions (
    wallet_id,
    amount,
    type,
    payment_type,
    status,
    description,
    reference_id
  ) VALUES (
    v_wallet_id,
    p_amount,
    'withdrawal',
    p_payment_type,
    'completed',
    v_safe_description,
    p_reference_id
  ) RETURNING id INTO v_transaction_id;
  
  UPDATE customer_wallets
  SET 
    balance = balance - p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'تم سحب المبلغ بنجاح',
    'transaction_id', v_transaction_id,
    'remaining_balance', v_current_balance - p_amount
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'message', 'فشل في سحب المبلغ: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;