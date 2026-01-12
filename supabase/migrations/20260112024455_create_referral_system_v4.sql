/*
  # نظام الإحالة (Referral System)

  1. التعديلات على الجداول
    - إضافة الأعمدة المفقودة في جدول `customers`
    - إنشاء جدول `referrals` لتتبع الإحالات
    - إنشاء جدول `referral_settings` للإعدادات
    
  2. الأعمدة الجديدة
    - customers.referred_by: معرف المستخدم المُحيل  
    - customers.referral_count: عدد الإحالات الناجحة
    
  3. جدول الإحالات
    - تتبع كل عملية إحالة
    - حالة الإحالة (pending, completed, rewarded)
    - النقاط الممنوحة للمُحيل والمُحال
    
  4. المكافآت الافتراضية
    - المُحيل: 50 نقطة
    - المُحال: 50 نقطة
*/

-- إضافة الأعمدة المفقودة
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'referred_by'
  ) THEN
    ALTER TABLE customers ADD COLUMN referred_by uuid REFERENCES customers(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'referral_count'
  ) THEN
    ALTER TABLE customers ADD COLUMN referral_count integer DEFAULT 0;
  END IF;
END $$;

-- إنشاء جدول الإحالات
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES customers(id) NOT NULL,
  referred_id uuid REFERENCES customers(id) NOT NULL,
  used_referral_code uuid NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rewarded')),
  referrer_reward_points integer DEFAULT 50,
  referred_reward_points integer DEFAULT 50,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  rewarded_at timestamptz,
  UNIQUE(referrer_id, referred_id)
);

-- إنشاء جدول الإعدادات
CREATE TABLE IF NOT EXISTS referral_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_points integer DEFAULT 50,
  referred_points integer DEFAULT 50,
  min_order_amount decimal(10,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- إضافة الإعدادات الافتراضية
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM referral_settings LIMIT 1) THEN
    INSERT INTO referral_settings (referrer_points, referred_points, is_active)
    VALUES (50, 50, true);
  END IF;
END $$;

-- تفعيل RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_settings ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان للإحالات
DROP POLICY IF EXISTS "Users can view own referrals" ON referrals;
CREATE POLICY "Users can view own referrals"
  ON referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "System can insert referrals" ON referrals;
CREATE POLICY "System can insert referrals"
  ON referrals FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can update referrals" ON referrals;
CREATE POLICY "System can update referrals"
  ON referrals FOR UPDATE
  TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- سياسات الأمان للإعدادات
DROP POLICY IF EXISTS "Anyone can view referral settings" ON referral_settings;
CREATE POLICY "Anyone can view referral settings"
  ON referral_settings FOR SELECT
  TO authenticated
  USING (is_active = true);

-- إنشاء indexes للأداء
CREATE INDEX IF NOT EXISTS idx_customers_referral_code ON customers(referral_code);
CREATE INDEX IF NOT EXISTS idx_customers_referred_by ON customers(referred_by);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);