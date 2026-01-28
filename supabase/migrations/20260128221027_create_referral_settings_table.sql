/*
  # Create Referral Settings Table

  1. New Tables
    - `referral_settings`
      - `id` (uuid, primary key) - معرف الإعداد
      - `status` (text) - حالة الإعداد (active/inactive)
      - `referrer_reward_type` (text) - نوع مكافأة المُحيل (points/cash/discount)
      - `referrer_reward_value` (numeric) - قيمة مكافأة المُحيل
      - `referee_reward_type` (text) - نوع مكافأة المُحال (points/cash/discount)
      - `referee_reward_value` (numeric) - قيمة مكافأة المُحال
      - `min_order_value` (numeric, optional) - الحد الأدنى لقيمة الطلب لتفعيل المكافأة
      - `max_referrals_per_user` (integer, optional) - الحد الأقصى للإحالات لكل مستخدم
      - `referral_expiry_days` (integer, optional) - عدد أيام انتهاء صلاحية رمز الإحالة
      - `created_at` (timestamptz) - وقت الإنشاء
      - `updated_at` (timestamptz) - وقت التحديث

  2. Security
    - Enable RLS on `referral_settings` table
    - Add policy for all users to read settings
    - Add policy for admin users to manage settings

  3. Important Notes
    - This table stores the global referral system configuration
    - Only one active settings row should exist at a time
    - All users can read the settings to display referral information
*/

-- Create referral_settings table
CREATE TABLE IF NOT EXISTS referral_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  referrer_reward_type text NOT NULL DEFAULT 'points' CHECK (referrer_reward_type IN ('points', 'cash', 'discount')),
  referrer_reward_value numeric(10, 2) NOT NULL DEFAULT 100,
  referee_reward_type text NOT NULL DEFAULT 'points' CHECK (referee_reward_type IN ('points', 'cash', 'discount')),
  referee_reward_value numeric(10, 2) NOT NULL DEFAULT 50,
  min_order_value numeric(10, 2),
  max_referrals_per_user integer,
  referral_expiry_days integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_referral_settings_status ON referral_settings(status);

-- Enable RLS
ALTER TABLE referral_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view active referral settings" ON referral_settings;
DROP POLICY IF EXISTS "Admins can manage referral settings" ON referral_settings;

-- Policy: Anyone can view active referral settings
CREATE POLICY "Anyone can view active referral settings"
  ON referral_settings
  FOR SELECT
  TO authenticated
  USING (status = 'active');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_referral_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_referral_settings_timestamp ON referral_settings;
CREATE TRIGGER update_referral_settings_timestamp
  BEFORE UPDATE ON referral_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_referral_settings_updated_at();

-- Insert default settings
INSERT INTO referral_settings (
  status,
  referrer_reward_type,
  referrer_reward_value,
  referee_reward_type,
  referee_reward_value,
  min_order_value,
  max_referrals_per_user,
  referral_expiry_days
) VALUES (
  'active',
  'points',
  100,
  'points',
  50,
  NULL,
  NULL,
  NULL
) ON CONFLICT DO NOTHING;
