/*
  # إصلاح تسجيل العميل
  
  1. التغييرات
     - إضافة عمود auth_user_id إلى جدول customers إذا لم يكن موجودًا
     - إضافة مؤشر فهرسة على عمود auth_user_id
     - إضافة قيد فريد على عمود auth_user_id
     - إضافة دالة لإنشاء سجل عميل تلقائيًا عند إنشاء مستخدم جديد
     - إضافة محفز لاستدعاء الدالة عند إنشاء مستخدم جديد
*/

-- إضافة عمود auth_user_id إذا لم يكن موجودًا
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN auth_user_id uuid;
  END IF;
END $$;

-- إضافة مؤشر فهرسة على عمود auth_user_id
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON customers(auth_user_id);

-- إضافة قيد فريد على عمود auth_user_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'customers' AND column_name = 'auth_user_id' AND constraint_name = 'customers_auth_user_id_key'
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT customers_auth_user_id_key UNIQUE (auth_user_id);
  END IF;
END $$;

-- إنشاء دالة لإنشاء سجل عميل تلقائيًا عند إنشاء مستخدم جديد
CREATE OR REPLACE FUNCTION create_customer_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- التحقق من عدم وجود سجل عميل لهذا المستخدم
  IF NOT EXISTS (SELECT 1 FROM customers WHERE auth_user_id = NEW.id) THEN
    -- إنشاء سجل عميل جديد
    INSERT INTO customers (
      name,
      phone,
      email,
      auth_user_id
    ) VALUES (
      COALESCE(NEW.raw_user_meta_data->>'name', 'مستخدم جديد'),
      COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
      NEW.email,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء محفز لاستدعاء الدالة عند إنشاء مستخدم جديد
DROP TRIGGER IF EXISTS create_customer_for_new_user_trigger ON auth.users;
CREATE TRIGGER create_customer_for_new_user_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_customer_for_new_user();

-- تحديث سجلات العملاء الحالية لربطها بالمستخدمين
DO $$ 
BEGIN
  -- تحديث سجلات العملاء التي لها رقم هاتف مطابق لمستخدم موجود
  UPDATE customers c
  SET auth_user_id = u.id
  FROM auth.users u
  WHERE c.phone = u.phone
  AND c.auth_user_id IS NULL
  AND u.id IS NOT NULL;
  
  -- تحديث سجلات العملاء التي لها بريد إلكتروني مطابق لمستخدم موجود
  UPDATE customers c
  SET auth_user_id = u.id
  FROM auth.users u
  WHERE c.email = u.email
  AND c.auth_user_id IS NULL
  AND u.id IS NOT NULL
  AND c.email IS NOT NULL
  AND u.email IS NOT NULL;
END $$;