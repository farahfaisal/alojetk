/*
  # إضافة أعمدة مفقودة إلى جدول الطلبات

  1. التغييرات
    - إضافة عمود `user_id` من نوع UUID
    - إضافة عمود `delivery_method` من نوع text
    - إضافة عمود `items_data` من نوع jsonb
  2. الفهارس
    - إضافة فهرس على عمود `user_id` لتحسين الأداء
*/

-- إضافة الأعمدة المفقودة إذا لم تكن موجودة
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS user_id uuid,
ADD COLUMN IF NOT EXISTS delivery_method text,
ADD COLUMN IF NOT EXISTS items_data jsonb;

-- إضافة فهرس على عمود user_id
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- إضافة مفتاح أجنبي لربط user_id بجدول users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_user_id_fkey'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'لم يتم إضافة المفتاح الأجنبي: %', SQLERRM;
END $$;