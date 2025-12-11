/*
  # Create delivery_offers table

  1. New Tables
    - `delivery_offers`
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `description` (text, optional)
      - `discount_type` (text, required - percentage/fixed/free)
      - `discount_value` (numeric, required)
      - `min_order_amount` (numeric, required)
      - `max_discount` (numeric, optional)
      - `vendor_id` (uuid, optional - references vendors table)
      - `category_id` (uuid, optional - references categories table)
      - `start_date` (date, required)
      - `end_date` (date, required)
      - `status` (text, required - active/inactive/expired)
      - `usage_limit` (integer, optional)
      - `used_count` (integer, default 0)
      - `image_url` (text, optional)
      - `background_color` (text, required)
      - `text_color` (text, required)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `delivery_offers` table
    - Add policy for public read access to active offers
    - Add policy for authenticated users to manage offers

  3. Indexes
    - Index on status for filtering active offers
    - Index on date range for filtering current offers
    - Index on vendor_id and category_id for filtering by vendor/category
*/

CREATE TABLE IF NOT EXISTS delivery_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free')),
  discount_value numeric(10,2) NOT NULL,
  min_order_amount numeric(10,2) NOT NULL DEFAULT 0,
  max_discount numeric(10,2),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  usage_limit integer,
  used_count integer NOT NULL DEFAULT 0,
  image_url text,
  background_color text NOT NULL DEFAULT '#FF6B35',
  text_color text NOT NULL DEFAULT '#FFFFFF',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE delivery_offers ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_delivery_offers_status ON delivery_offers(status);
CREATE INDEX IF NOT EXISTS idx_delivery_offers_dates ON delivery_offers(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_delivery_offers_vendor_id ON delivery_offers(vendor_id);
CREATE INDEX IF NOT EXISTS idx_delivery_offers_category_id ON delivery_offers(category_id);
CREATE INDEX IF NOT EXISTS idx_delivery_offers_active_dates ON delivery_offers(status, start_date, end_date);

-- Create policies for Row Level Security
CREATE POLICY "Public can view active delivery offers"
  ON delivery_offers
  FOR SELECT
  TO public
  USING (status = 'active' AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE);

CREATE POLICY "Authenticated users can view all delivery offers"
  ON delivery_offers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage delivery offers"
  ON delivery_offers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_delivery_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_delivery_offers_updated_at_trigger
  BEFORE UPDATE ON delivery_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_offers_updated_at();

-- Insert some sample data for testing
INSERT INTO delivery_offers (
  title,
  description,
  discount_type,
  discount_value,
  min_order_amount,
  start_date,
  end_date,
  status,
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
  'active',
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
  'active',
  '#10B981',
  '#FFFFFF'
),
(
  'توصيل بـ 5 شيكل فقط',
  'توصيل بسعر مخفض للطلبات أكثر من 25 شيكل',
  'fixed',
  5,
  25,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '20 days',
  'active',
  '#3B82F6',
  '#FFFFFF'
);