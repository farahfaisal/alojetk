/*
  # إنشاء جدول محافظ العملاء

  1. جداول جديدة
    - `customer_wallets`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, foreign key to customers)
      - `balance` (numeric, الرصيد الحالي)
      - `total_deposits` (numeric, إجمالي الإيداعات)
      - `total_withdrawals` (numeric, إجمالي السحوبات)
      - `total_spent` (numeric, إجمالي المصروفات)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `customer_wallet_transactions`
      - `id` (uuid, primary key)
      - `wallet_id` (uuid, foreign key to customer_wallets)
      - `order_id` (uuid, foreign key to orders, nullable)
      - `amount` (numeric, المبلغ)
      - `type` (text, نوع المعاملة)
      - `payment_type` (text, طريقة الدفع)
      - `status` (text, حالة المعاملة)
      - `description` (text, وصف المعاملة)
      - `reference_id` (text, مرجع خارجي)
      - `created_at` (timestamp)

  2. الأمان
    - تفعيل RLS على جميع الجداول
    - إضافة سياسات للعملاء لعرض وإدارة محافظهم فقط

  3. المحفزات
    - محفز لتحديث رصيد المحفظة عند إضافة معاملة جديدة
    - محفز لإنشاء محفظة تلقائياً عند إنشاء عميل جديد
*/

-- إنشاء جدول محافظ العملاء
CREATE TABLE IF NOT EXISTS customer_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  balance numeric(10,2) DEFAULT 0.00 NOT NULL,
  total_deposits numeric(10,2) DEFAULT 0.00 NOT NULL,
  total_withdrawals numeric(10,2) DEFAULT 0.00 NOT NULL,
  total_spent numeric(10,2) DEFAULT 0.00 NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- قيود للتأكد من صحة البيانات
  CONSTRAINT positive_balance CHECK (balance >= 0),
  CONSTRAINT positive_deposits CHECK (total_deposits >= 0),
  CONSTRAINT positive_withdrawals CHECK (total_withdrawals >= 0),
  CONSTRAINT positive_spent CHECK (total_spent >= 0),
  CONSTRAINT unique_customer_wallet UNIQUE (customer_id)
);

-- إنشاء جدول معاملات محافظ العملاء
CREATE TABLE IF NOT EXISTS customer_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES customer_wallets(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL,
  type text NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'payment', 'refund', 'bonus', 'penalty')),
  payment_type text NOT NULL CHECK (payment_type IN ('cash', 'electronic', 'bank_transfer', 'credit_card', 'admin_adjustment')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  description text NOT NULL,
  reference_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_customer_wallets_customer_id ON customer_wallets(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_wallets_balance ON customer_wallets(balance);
CREATE INDEX IF NOT EXISTS idx_customer_wallet_transactions_wallet_id ON customer_wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_customer_wallet_transactions_order_id ON customer_wallet_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_customer_wallet_transactions_type ON customer_wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_customer_wallet_transactions_status ON customer_wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_customer_wallet_transactions_created_at ON customer_wallet_transactions(created_at);

-- تفعيل RLS
ALTER TABLE customer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان لمحافظ العملاء
CREATE POLICY "العملاء يمكنهم عرض محافظهم فقط"
  ON customer_wallets
  FOR SELECT
  TO authenticated
  USING (customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid() OR id = auth.uid()
  ));

CREATE POLICY "العملاء يمكنهم تحديث محافظهم فقط"
  ON customer_wallets
  FOR UPDATE
  TO authenticated
  USING (customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid() OR id = auth.uid()
  ));

-- سياسات الأمان لمعاملات محافظ العملاء
CREATE POLICY "العملاء يمكنهم عرض معاملات محافظهم فقط"
  ON customer_wallet_transactions
  FOR SELECT
  TO authenticated
  USING (wallet_id IN (
    SELECT cw.id FROM customer_wallets cw
    JOIN customers c ON c.id = cw.customer_id
    WHERE c.user_id = auth.uid() OR c.id = auth.uid()
  ));

CREATE POLICY "العملاء يمكنهم إضافة معاملات لمحافظهم"
  ON customer_wallet_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (wallet_id IN (
    SELECT cw.id FROM customer_wallets cw
    JOIN customers c ON c.id = cw.customer_id
    WHERE c.user_id = auth.uid() OR c.id = auth.uid()
  ));

-- سياسات للمديرين
CREATE POLICY "المديرون يمكنهم إدارة جميع المحافظ"
  ON customer_wallets
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "المديرون يمكنهم إدارة جميع معاملات المحافظ"
  ON customer_wallet_transactions
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  ));

-- دالة لتحديث رصيد المحفظة
CREATE OR REPLACE FUNCTION update_customer_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- تحديث رصيد المحفظة بناءً على نوع المعاملة
  IF NEW.status = 'completed' THEN
    CASE NEW.type
      WHEN 'deposit', 'refund', 'bonus' THEN
        UPDATE customer_wallets 
        SET 
          balance = balance + NEW.amount,
          total_deposits = CASE WHEN NEW.type = 'deposit' THEN total_deposits + NEW.amount ELSE total_deposits END,
          updated_at = now()
        WHERE id = NEW.wallet_id;
        
      WHEN 'withdrawal', 'payment', 'penalty' THEN
        UPDATE customer_wallets 
        SET 
          balance = balance - NEW.amount,
          total_withdrawals = CASE WHEN NEW.type = 'withdrawal' THEN total_withdrawals + NEW.amount ELSE total_withdrawals END,
          total_spent = CASE WHEN NEW.type = 'payment' THEN total_spent + NEW.amount ELSE total_spent END,
          updated_at = now()
        WHERE id = NEW.wallet_id;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- محفز لتحديث رصيد المحفظة
DROP TRIGGER IF EXISTS update_customer_wallet_balance_trigger ON customer_wallet_transactions;
CREATE TRIGGER update_customer_wallet_balance_trigger
  AFTER INSERT OR UPDATE OF status ON customer_wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_wallet_balance();

-- دالة لإنشاء محفظة تلقائياً للعميل الجديد
CREATE OR REPLACE FUNCTION create_customer_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO customer_wallets (customer_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- محفز لإنشاء محفظة تلقائياً
DROP TRIGGER IF EXISTS create_customer_wallet_trigger ON customers;
CREATE TRIGGER create_customer_wallet_trigger
  AFTER INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION create_customer_wallet();

-- دالة لإضافة أموال إلى محفظة العميل
CREATE OR REPLACE FUNCTION add_money_to_customer_wallet(
  p_customer_id uuid,
  p_amount numeric,
  p_description text,
  p_payment_type text DEFAULT 'admin_adjustment',
  p_reference_id text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_wallet_id uuid;
  v_transaction_id uuid;
BEGIN
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
    p_description,
    p_reference_id
  ) RETURNING id INTO v_transaction_id;
  
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

-- دالة لسحب أموال من محفظة العميل
CREATE OR REPLACE FUNCTION withdraw_from_customer_wallet(
  p_customer_id uuid,
  p_amount numeric,
  p_description text,
  p_payment_type text DEFAULT 'withdrawal',
  p_reference_id text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_wallet_id uuid;
  v_current_balance numeric;
  v_transaction_id uuid;
BEGIN
  -- البحث عن محفظة العميل والرصيد الحالي
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
    p_description,
    p_reference_id
  ) RETURNING id INTO v_transaction_id;
  
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

-- دالة للدفع من محفظة العميل
CREATE OR REPLACE FUNCTION pay_from_customer_wallet(
  p_customer_id uuid,
  p_order_id uuid,
  p_amount numeric,
  p_description text DEFAULT 'دفع طلب'
)
RETURNS json AS $$
DECLARE
  v_wallet_id uuid;
  v_current_balance numeric;
  v_transaction_id uuid;
BEGIN
  -- البحث عن محفظة العميل والرصيد الحالي
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
      'message', 'الرصيد غير كافي للدفع'
    );
  END IF;
  
  -- إضافة معاملة الدفع
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
  
  RETURN json_build_object(
    'success', true,
    'message', 'تم الدفع بنجاح من المحفظة',
    'transaction_id', v_transaction_id,
    'remaining_balance', v_current_balance - p_amount
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'message', 'فشل في الدفع من المحفظة: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة للحصول على رصيد محفظة العميل
CREATE OR REPLACE FUNCTION get_customer_wallet_balance(p_customer_id uuid)
RETURNS numeric AS $$
DECLARE
  v_balance numeric;
BEGIN
  SELECT balance INTO v_balance
  FROM customer_wallets
  WHERE customer_id = p_customer_id;
  
  RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;