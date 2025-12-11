/*
  # Add service areas table

  1. New Tables
    - `service_areas`
      - `id` (uuid, primary key)
      - `name` (text)
      - `status` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for viewing service areas
*/

-- Create service areas table
CREATE TABLE IF NOT EXISTS service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT service_areas_status_check CHECK (status IN ('active', 'coming_soon'))
);

-- Enable RLS
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Service areas are viewable by everyone"
  ON service_areas
  FOR SELECT
  TO public
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_service_areas_updated_at
  BEFORE UPDATE ON service_areas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert some initial data
INSERT INTO service_areas (name, status) VALUES
  ('جنين - وسط البلد', 'active'),
  ('جنين - المنطقة الصناعية', 'active'),
  ('جنين - حي البساتين', 'active'),
  ('جنين - شارع حيفا', 'active'),
  ('جنين - شارع الناصرة', 'active'),
  ('جنين - مخيم جنين', 'active'),
  ('جنين - حي الجابريات', 'coming_soon'),
  ('جنين - حي الزهراء', 'coming_soon');