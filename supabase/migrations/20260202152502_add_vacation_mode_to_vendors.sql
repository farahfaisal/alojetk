/*
  # إضافة وضع الإجازة للمتاجر

  1. التغييرات
    - إضافة عمود `vacation_mode` إلى جدول `vendors`
      - نوع boolean مع قيمة افتراضية false
      - يسمح بإغلاق المتجر يدوياً من لوحة التحكم
      - عندما يكون true، المتجر مغلق بغض النظر عن ساعات العمل
  
  2. الأمان
    - لا تغييرات على سياسات RLS (تستخدم نفس السياسات الموجودة)
*/

-- إضافة عمود vacation_mode إذا لم يكن موجوداً
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'vacation_mode'
  ) THEN
    ALTER TABLE vendors ADD COLUMN vacation_mode boolean DEFAULT false;
  END IF;
END $$;

-- تأكد من أن القيمة الافتراضية صحيحة
ALTER TABLE vendors ALTER COLUMN vacation_mode SET DEFAULT false;

-- إضافة تعليق على العمود
COMMENT ON COLUMN vendors.vacation_mode IS 'وضع الإجازة - عند التفعيل، المتجر يكون مغلق بغض النظر عن ساعات العمل';
