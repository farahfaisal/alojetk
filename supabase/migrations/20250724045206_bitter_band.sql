/*
  # إضافة العلاقات المفقودة لجدول عمليات المحفظة

  1. العلاقات المضافة
    - علاقة مع جدول `orders` عبر `order_id`
    - فهارس لتحسين الأداء
  
  2. التحسينات
    - إضافة فهارس للبحث السريع
    - تحسين استعلامات المعاملات
*/

-- إضافة علاقة مع جدول الطلبات إذا لم تكن موجودة
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customer_wallet_transactions_order_id_fkey'
    AND table_name = 'customer_wallet_transactions'
  ) THEN
    ALTER TABLE customer_wallet_transactions 
    ADD CONSTRAINT customer_wallet_transactions_order_id_fkey 
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- إضافة فهارس إضافية لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_customer_wallet_transactions_order_id 
ON customer_wallet_transactions(order_id);

CREATE INDEX IF NOT EXISTS idx_customer_wallet_transactions_wallet_id 
ON customer_wallet_transactions(wallet_id);

CREATE INDEX IF NOT EXISTS idx_customer_wallet_transactions_type 
ON customer_wallet_transactions(type);

CREATE INDEX IF NOT EXISTS idx_customer_wallet_transactions_status 
ON customer_wallet_transactions(status);

CREATE INDEX IF NOT EXISTS idx_customer_wallet_transactions_created_at 
ON customer_wallet_transactions(created_at);

-- إضافة فهرس مركب للاستعلامات الشائعة
CREATE INDEX IF NOT EXISTS idx_customer_wallet_transactions_wallet_status_date 
ON customer_wallet_transactions(wallet_id, status, created_at DESC);

-- تحديث سياسات الأمان إذا لزم الأمر
DO $$
BEGIN
  -- التأكد من وجود سياسة للعملاء لعرض معاملاتهم
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_wallet_transactions' 
    AND policyname = 'العملاء يمكنهم عرض معاملات محافظهم فقط'
  ) THEN
    CREATE POLICY "العملاء يمكنهم عرض معاملات محافظهم فقط"
    ON customer_wallet_transactions
    FOR SELECT
    TO authenticated
    USING (
      wallet_id IN (
        SELECT cw.id 
        FROM customer_wallets cw 
        JOIN customers c ON c.id = cw.customer_id 
        WHERE c.user_id = auth.uid() OR c.id = auth.uid()
      )
    );
  END IF;

  -- التأكد من وجود سياسة للعملاء لإضافة معاملات لمحافظهم
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_wallet_transactions' 
    AND policyname = 'العملاء يمكنهم إضافة معاملات لمحافظهم فقط'
  ) THEN
    CREATE POLICY "العملاء يمكنهم إضافة معاملات لمحافظهم فقط"
    ON customer_wallet_transactions
    FOR INSERT
    TO authenticated
    WITH CHECK (
      wallet_id IN (
        SELECT cw.id 
        FROM customer_wallets cw 
        JOIN customers c ON c.id = cw.customer_id 
        WHERE c.user_id = auth.uid() OR c.id = auth.uid()
      )
    );
  END IF;

  -- سياسة للمديرين لإدارة جميع معاملات المحافظ
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_wallet_transactions' 
    AND policyname = 'المديرون يمكنهم إدارة جميع معاملات المحافظ'
  ) THEN
    CREATE POLICY "المديرون يمكنهم إدارة جميع معاملات المحافظ"
    ON customer_wallet_transactions
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.user_id = auth.uid()
      )
    );
  END IF;
END $$;