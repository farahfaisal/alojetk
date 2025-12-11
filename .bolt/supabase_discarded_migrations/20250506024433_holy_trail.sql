/*
  # Add service areas table and update vendors

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
ON service_areas FOR SELECT 
TO public 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_service_areas_updated_at
  BEFORE UPDATE ON service_areas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert initial data
INSERT INTO service_areas (name, status) VALUES
  ('جنين', 'active'),
  ('نابلس', 'coming_soon'),
  ('طولكرم', 'coming_soon'),
  ('رام الله', 'coming_soon'),
  ('الخليل', 'coming_soon'),
  ('بيت لحم', 'coming_soon'),
  ('قلقيلية', 'coming_soon'),
  ('طوباس', 'coming_soon'),
  ('سلفيت', 'coming_soon'),
  ('أريحا', 'coming_soon')
ON CONFLICT DO NOTHING;