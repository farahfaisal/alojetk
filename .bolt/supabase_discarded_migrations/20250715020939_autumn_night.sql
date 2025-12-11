/*
  # إضافة نظام المحفظة للزبائن

  1. جداول جديدة
    - `customer_wallets` - محافظ الزبائن
    - `wallet_transactions` - معاملات المحفظة

  2. وظائف
    - `add_funds_to_wallet` - إضافة رصيد للمحفظة
    - `use_wallet_for_payment` - استخدام المحفظة للدفع
    - `create_customer_wallet` - إنشاء محفظة للزبون الجديد

  3. محفزات
    - `create_wallet_for_new_customer` - إنشاء محفظة تلقائياً للزبون الجديد
    - `update_wallet_balance` - تحديث رصيد المحفظة عند إجراء معاملة
*/

-- إنشاء جدول محافظ الزبائن
CREATE TABLE IF NOT EXISTS customer_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  available_balance NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  pending_balance NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  last_transaction TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT positive_balance CHECK (balance >= 0),
  CONSTRAINT positive_available_balance CHECK (available_balance >= 0),
  CONSTRAINT positive_pending_balance CHECK (pending_balance >= 0)
);

-- إنشاء فهرس للبحث السريع بواسطة معرف الزبون
CREATE INDEX IF NOT EXISTS idx_customer_wallets_customer_id ON customer_wallets(customer_id);

-- إنشاء قيد فريد لضمان وجود محفظة واحدة فقط لكل زبون
ALTER TABLE customer_wallets ADD CONSTRAINT customer_wallets_customer_id_unique UNIQUE (customer_id);

-- إنشاء جدول معاملات المحفظة
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES customer_wallets(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'payment', 'refund', 'withdrawal', 'adjustment')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- إنشاء فهارس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_order_id ON wallet_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);

-- إنشاء وظيفة لإضافة رصيد للمحفظة
CREATE OR REPLACE FUNCTION add_funds_to_wallet(
  p_customer_id UUID,
  p_amount NUMERIC(10,2),
  p_description TEXT DEFAULT 'إضافة رصيد',
  p_reference_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_result JSONB;
BEGIN
  -- التحقق من وجود المحفظة
  SELECT id INTO v_wallet_id FROM customer_wallets WHERE customer_id = p_customer_id;
  
  IF v_wallet_id IS NULL THEN
    -- إنشاء محفظة جديدة إذا لم تكن موجودة
    INSERT INTO customer_wallets (customer_id, balance, available_balance)
    VALUES (p_customer_id, p_amount, p_amount)
    RETURNING id INTO v_wallet_id;
  ELSE
    -- تحديث رصيد المحفظة الموجودة
    UPDATE customer_wallets
    SET 
      balance = balance + p_amount,
      available_balance = available_balance + p_amount,
      last_transaction = now(),
      updated_at = now()
    WHERE id = v_wallet_id;
  END IF;
  
  -- إنشاء معاملة جديدة
  INSERT INTO wallet_transactions (
    wallet_id,
    amount,
    type,
    status,
    description,
    reference_id,
    completed_at
  )
  VALUES (
    v_wallet_id,
    p_amount,
    'deposit',
    'completed',
    p_description,
    p_reference_id,
    now()
  )
  RETURNING id INTO v_transaction_id;
  
  -- إعداد النتيجة
  SELECT jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet_id,
    'transaction_id', v_transaction_id,
    'amount', p_amount,
    'new_balance', (SELECT balance FROM customer_wallets WHERE id = v_wallet_id)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء وظيفة لاستخدام المحفظة للدفع
CREATE OR REPLACE FUNCTION use_wallet_for_payment(
  p_customer_id UUID,
  p_order_id UUID,
  p_amount NUMERIC(10,2)
) RETURNS JSONB AS $$
DECLARE
  v_wallet_id UUID;
  v_available_balance NUMERIC(10,2);
  v_transaction_id UUID;
  v_result JSONB;
BEGIN
  -- التحقق من وجود المحفظة
  SELECT id, available_balance INTO v_wallet_id, v_available_balance
  FROM customer_wallets
  WHERE customer_id = p_customer_id;
  
  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'المحفظة غير موجودة'
    );
  END IF;
  
  -- التحقق من كفاية الرصيد
  IF v_available_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'الرصيد غير كافٍ',
      'available_balance', v_available_balance,
      'required_amount', p_amount
    );
  END IF;
  
  -- تحديث رصيد المحفظة
  UPDATE customer_wallets
  SET 
    balance = balance - p_amount,
    available_balance = available_balance - p_amount,
    last_transaction = now(),
    updated_at = now()
  WHERE id = v_wallet_id;
  
  -- إنشاء معاملة جديدة
  INSERT INTO wallet_transactions (
    wallet_id,
    order_id,
    amount,
    type,
    status,
    description,
    completed_at
  )
  VALUES (
    v_wallet_id,
    p_order_id,
    p_amount,
    'payment',
    'completed',
    'دفع الطلب #' || p_order_id,
    now()
  )
  RETURNING id INTO v_transaction_id;
  
  -- تحديث طريقة الدفع في الطلب
  UPDATE orders
  SET payment_method = 'wallet'
  WHERE id = p_order_id;
  
  -- إعداد النتيجة
  SELECT jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet_id,
    'transaction_id', v_transaction_id,
    'amount', p_amount,
    'new_balance', (SELECT balance FROM customer_wallets WHERE id = v_wallet_id)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء وظيفة لإنشاء محفظة للزبون
CREATE OR REPLACE FUNCTION create_customer_wallet() RETURNS TRIGGER AS $$
BEGIN
  -- إنشاء محفظة جديدة للزبون
  INSERT INTO customer_wallets (customer_id)
  VALUES (NEW.id)
  ON CONFLICT (customer_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء محفز لإنشاء محفظة تلقائياً للزبون الجديد
CREATE TRIGGER create_wallet_for_new_customer
AFTER INSERT ON customers
FOR EACH ROW
EXECUTE FUNCTION create_customer_wallet();

-- إنشاء محفظة لجميع الزبائن الحاليين الذين ليس لديهم محفظة
INSERT INTO customer_wallets (customer_id)
SELECT id FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM customer_wallets w WHERE w.customer_id = c.id
);

-- إضافة سياسات الأمان للمحفظة
ALTER TABLE customer_wallets ENABLE ROW LEVEL SECURITY;

-- سياسة للزبائن لعرض محافظهم الخاصة
CREATE POLICY customer_wallets_select_policy
  ON customer_wallets
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE user_id = auth.uid()
    )
  );

-- سياسة للمشرفين لعرض جميع المحافظ
CREATE POLICY admin_wallets_select_policy
  ON customer_wallets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );

-- سياسة للمشرفين لتحديث المحافظ
CREATE POLICY admin_wallets_update_policy
  ON customer_wallets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );

-- إضافة سياسات الأمان لمعاملات المحفظة
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- سياسة للزبائن لعرض معاملاتهم الخاصة
CREATE POLICY customer_transactions_select_policy
  ON wallet_transactions
  FOR SELECT
  TO authenticated
  USING (
    wallet_id IN (
      SELECT w.id FROM customer_wallets w
      JOIN customers c ON w.customer_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- سياسة للمشرفين لعرض جميع المعاملات
CREATE POLICY admin_transactions_select_policy
  ON wallet_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );

-- سياسة للمشرفين لإنشاء معاملات جديدة
CREATE POLICY admin_transactions_insert_policy
  ON wallet_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );