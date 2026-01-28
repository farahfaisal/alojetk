/*
  # Create Points Settings Table

  1. New Tables
    - `points_settings`
      - `id` (uuid, primary key) - معرف الإعداد
      - `status` (text) - حالة الإعداد (active/inactive)
      - `point_value` (numeric) - قيمة النقطة بالشيكل (النقطة الواحدة = كم شيكل)
      - `min_points_to_redeem` (integer) - الحد الأدنى من النقاط للاستبدال
      - `max_points_per_order` (integer, optional) - الحد الأقصى من النقاط لكل طلب
      - `points_expiry_days` (integer, optional) - عدد أيام انتهاء صلاحية النقاط
      - `earn_rate` (numeric) - نسبة الربح (نقطة واحدة لكل X شيكل)
      - `referral_points` (integer) - نقاط الإحالة
      - `review_points` (integer) - نقاط التقييم
      - `signup_bonus` (integer) - مكافأة التسجيل
      - `created_at` (timestamptz) - وقت الإنشاء
      - `updated_at` (timestamptz) - وقت التحديث

  2. Security
    - Enable RLS on `points_settings` table
    - Add policy for all users to read settings
    - Add policy for admin users to manage settings

  3. Important Notes
    - This table stores the global points system configuration
    - Only one active settings row should exist at a time
    - All users can read the settings to display points information
*/

-- Create points_settings table
CREATE TABLE IF NOT EXISTS points_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  point_value numeric(10, 2) NOT NULL DEFAULT 1.0,
  min_points_to_redeem integer NOT NULL DEFAULT 10,
  max_points_per_order integer,
  points_expiry_days integer,
  earn_rate numeric(10, 2) NOT NULL DEFAULT 10,
  referral_points integer NOT NULL DEFAULT 100,
  review_points integer NOT NULL DEFAULT 10,
  signup_bonus integer NOT NULL DEFAULT 50,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_points_settings_status ON points_settings(status);

-- Enable RLS
ALTER TABLE points_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view active points settings" ON points_settings;

-- Policy: Anyone can view active points settings
CREATE POLICY "Anyone can view active points settings"
  ON points_settings
  FOR SELECT
  TO authenticated
  USING (status = 'active');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_points_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_points_settings_timestamp ON points_settings;
CREATE TRIGGER update_points_settings_timestamp
  BEFORE UPDATE ON points_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_points_settings_updated_at();

-- Insert default settings
INSERT INTO points_settings (
  status,
  point_value,
  min_points_to_redeem,
  max_points_per_order,
  points_expiry_days,
  earn_rate,
  referral_points,
  review_points,
  signup_bonus
) VALUES (
  'active',
  0.1,
  10,
  NULL,
  NULL,
  10,
  100,
  10,
  50
) ON CONFLICT DO NOTHING;
