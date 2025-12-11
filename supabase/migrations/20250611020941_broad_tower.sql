-- حذف المحفزات التي تزامن بيانات المستخدمين مع custom_users
DROP TRIGGER IF EXISTS add_customer_to_custom_users ON customers;
DROP TRIGGER IF EXISTS update_custom_users_from_customer ON customers;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS add_driver_to_auth ON drivers;

-- حذف الدوال المرتبطة بالمحفزات
DROP FUNCTION IF EXISTS trigger_add_customer_to_custom_users();
DROP FUNCTION IF EXISTS trigger_update_custom_users_from_customer();
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS trigger_add_driver_to_auth();

-- إزالة قيود المفاتيح الخارجية
DO $$ 
BEGIN
  -- حذف قيد المفتاح الخارجي من جدول customers إلى custom_users
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customers_user_id_fkey' 
    AND table_name = 'customers'
  ) THEN
    ALTER TABLE customers DROP CONSTRAINT customers_user_id_fkey;
  END IF;

  -- حذف قيد المفتاح الخارجي من جدول customers إلى auth.users
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customers_auth_user_id_fkey' 
    AND table_name = 'customers'
  ) THEN
    ALTER TABLE customers DROP CONSTRAINT customers_auth_user_id_fkey;
  END IF;
  
  -- حذف قيد المفتاح الخارجي من جدول vendors إلى custom_users
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'vendors_user_id_fkey' 
    AND table_name = 'vendors'
  ) THEN
    ALTER TABLE vendors DROP CONSTRAINT vendors_user_id_fkey;
  END IF;
  
  -- حذف قيد المفتاح الخارجي من جدول drivers إلى custom_users
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'drivers_user_id_fkey' 
    AND table_name = 'drivers'
  ) THEN
    ALTER TABLE drivers DROP CONSTRAINT drivers_user_id_fkey;
  END IF;
END $$;

-- جعل حقول user_id و auth_user_id قابلة للقيم الفارغة
DO $$ 
BEGIN
  -- التحقق من وجود حقل user_id وجعله قابل للقيم الفارغة
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE customers ALTER COLUMN user_id DROP NOT NULL;
  END IF;
  
  -- التحقق من وجود حقل auth_user_id وجعله قابل للقيم الفارغة
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE customers ALTER COLUMN auth_user_id DROP NOT NULL;
  END IF;
  
  -- التحقق من وجود حقل user_id في جدول vendors وجعله قابل للقيم الفارغة
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE vendors ALTER COLUMN user_id DROP NOT NULL;
  END IF;
  
  -- التحقق من وجود حقل user_id في جدول drivers وجعله قابل للقيم الفارغة
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drivers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE drivers ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

-- تحديث سياسات RLS لجدول customers
DO $$ 
BEGIN
  -- حذف السياسات الموجودة
  DROP POLICY IF EXISTS "Users can view their own customer data" ON customers;
  DROP POLICY IF EXISTS "Users can update their own customer data" ON customers;
  DROP POLICY IF EXISTS "Users can delete their own customer data" ON customers;
  DROP POLICY IF EXISTS "Users can insert their own customer data" ON customers;
  
  -- التحقق من وجود السياسات الجديدة قبل إنشائها
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customers' AND policyname = 'Allow user to read their own row'
  ) THEN
    CREATE POLICY "Allow user to read their own row"
      ON customers FOR SELECT
      TO public
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customers' AND policyname = 'Allow user to update their own row'
  ) THEN
    CREATE POLICY "Allow user to update their own row"
      ON customers FOR UPDATE
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customers' AND policyname = 'Allow user to insert their own row'
  ) THEN
    CREATE POLICY "Allow user to insert their own row"
      ON customers FOR INSERT
      TO public
      WITH CHECK (true);
  END IF;
    
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customers' AND policyname = 'Customers can delete their own data'
  ) THEN
    CREATE POLICY "Customers can delete their own data"
      ON customers FOR DELETE
      TO public
      USING (true);
  END IF;
END $$;

-- إنشاء دالة للمصادقة المباشرة عن طريق رقم الهاتف
DROP FUNCTION IF EXISTS authenticate_by_phone(text);
CREATE OR REPLACE FUNCTION authenticate_by_phone(
  p_phone text,
  OUT success boolean,
  OUT customer_id uuid,
  OUT customer_name text,
  OUT message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  customer_record customers%ROWTYPE;
BEGIN
  -- البحث عن العميل برقم الهاتف
  SELECT *
  INTO customer_record
  FROM customers
  WHERE phone = p_phone;
  
  IF customer_record IS NULL THEN
    success := false;
    message := 'لم يتم العثور على حساب بهذا الرقم';
    RETURN;
  END IF;
  
  -- إرجاع معلومات العميل
  success := true;
  customer_id := customer_record.id;
  customer_name := customer_record.name;
  message := 'تم تسجيل الدخول بنجاح';
  
  RETURN;
END;
$$;

-- منح صلاحيات التنفيذ
GRANT EXECUTE ON FUNCTION authenticate_by_phone TO authenticated, anon;

-- تسجيل التغييرات
INSERT INTO system_logs (
  event_type,
  message,
  details
) VALUES (
  'schema_update',
  'تمت إزالة العلاقة بين جداول المستخدمين',
  jsonb_build_object(
    'timestamp', now(),
    'description', 'تمت إزالة المحفزات والقيود وتحديث سياسات RLS'
  )
);