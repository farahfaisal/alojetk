/*
  # Create delivery offers table

  1. New Tables
    - `delivery_offers`
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `description` (text, optional)
      - `discount_type` (text, required - percentage/fixed/free)
      - `discount_value` (numeric, required)
      - `min_order_amount` (numeric, required)
      - `max_discount` (numeric, optional)
      - `vendor_id` (uuid, optional foreign key to vendors)
      - `category_id` (uuid, optional foreign key to categories)
      - `start_date` (date, required)
      - `end_date` (date, required)
      - `status` (text, required - active/inactive/expired)
      - `usage_limit` (integer, optional)
      - `used_count` (integer, default 0)
      - `image_url` (text, optional)
      - `background_color` (text, default '#FF6B35')
      - `text_color` (text, default '#FFFFFF')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `delivery_offers` table
    - Add policies for public read access and admin management
*/

CREATE TABLE IF NOT EXISTS delivery_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free')),
  discount_value numeric NOT NULL CHECK (discount_value >= 0),
  min_order_amount numeric NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  max_discount numeric CHECK (max_discount IS NULL OR max_discount >= 0),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL CHECK (end_date >= start_date),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  image_url text,
  background_color text NOT NULL DEFAULT '#FF6B35',
  text_color text NOT NULL DEFAULT '#FFFFFF',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE delivery_offers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Delivery offers are viewable by everyone" ON delivery_offers
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage delivery offers" ON delivery_offers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_delivery_offers_status ON delivery_offers(status);
CREATE INDEX IF NOT EXISTS idx_delivery_offers_dates ON delivery_offers(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_delivery_offers_vendor_id ON delivery_offers(vendor_id);
CREATE INDEX IF NOT EXISTS idx_delivery_offers_category_id ON delivery_offers(category_id);

-- Insert sample delivery offers
INSERT INTO delivery_offers (
  title,
  description,
  discount_type,
  discount_value,
  min_order_amount,
  start_date,
  end_date,
  background_color,
  text_color
) VALUES 
(
  'توصيل مجاني',
  'توصيل مجاني للطلبات أكثر من 50 شيكل',
  'free',
  0,
  50,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  '#FF6B35',
  '#FFFFFF'
),
(
  'خصم 50% على التوصيل',
  'خصم 50% على رسوم التوصيل للطلبات أكثر من 30 شيكل',
  'percentage',
  50,
  30,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '15 days',
  '#10B981',
  '#FFFFFF'
),
(
  'توصيل بـ 5 شيكل',
  'توصيل بسعر ثابت 5 شيكل فقط',
  'fixed',
  5,
  0,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '7 days',
  '#8B5CF6',
  '#FFFFFF'
);