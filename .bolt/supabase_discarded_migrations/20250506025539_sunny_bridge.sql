/*
  # Add service areas to vendors table

  1. Changes
    - Add service_areas column to vendors table
    - Add index for service_areas column
    - Update existing vendors with empty array
    - Add function to check if vendor serves area

  2. Security
    - Maintain existing RLS policies
*/

-- Add service_areas column to vendors table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'service_areas'
  ) THEN
    ALTER TABLE vendors ADD COLUMN service_areas text[] DEFAULT '{}'::text[];
  END IF;
END $$;

-- Add index for service_areas column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_vendors_service_areas'
  ) THEN
    CREATE INDEX idx_vendors_service_areas ON vendors USING gin (service_areas);
  END IF;
END $$;

-- Create function to check if vendor serves area
CREATE OR REPLACE FUNCTION vendor_serves_area(vendor_id uuid, area_name text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM vendors
    WHERE id = vendor_id
    AND area_name = ANY(service_areas)
  );
END;
$$ LANGUAGE plpgsql;