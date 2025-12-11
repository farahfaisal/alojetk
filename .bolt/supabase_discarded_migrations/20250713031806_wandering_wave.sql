/*
  # إضافة عمود user_id إلى جدول orders

  1. التغييرات
    - إضافة عمود `user_id` من نوع UUID إلى جدول `orders`
    - إضافة مؤشر على عمود `user_id` لتحسين الأداء
    - إضافة مفتاح أجنبي يربط `user_id` بجدول `users`
*/

-- إضافة عمود user_id إلى جدول orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- إضافة مؤشر على عمود user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_orders_user_id'
  ) THEN
    CREATE INDEX idx_orders_user_id ON orders(user_id);
  END IF;
END $$;