/*
  # Add Featured Vendors Support
  
  1. New Columns
    - `featured_until` (timestamptz) - Date until which the vendor is featured
    - `featured_order` (integer) - Order in which to display featured vendors
  
  2. Changes
    - Add columns to vendors table if they don't exist
    - Add index for faster queries
    - Update existing vendors with sample featured data
*/

-- Add featured_until column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'vendors' 
    AND column_name = 'featured_until'
  ) THEN
    ALTER TABLE vendors 
    ADD COLUMN featured_until TIMESTAMPTZ;
  END IF;
END $$;

-- Add featured_order column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'vendors' 
    AND column_name = 'featured_order'
  ) THEN
    ALTER TABLE vendors 
    ADD COLUMN featured_order INTEGER;
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_vendors_featured_until ON vendors(featured_until);
CREATE INDEX IF NOT EXISTS idx_vendors_featured_order ON vendors(featured_order);

-- Update a few vendors to be featured (for demonstration)
UPDATE vendors
SET 
  featured_until = CURRENT_DATE + INTERVAL '30 days',
  featured_order = 1
WHERE id IN (
  SELECT id FROM vendors ORDER BY created_at DESC LIMIT 1
);

UPDATE vendors
SET 
  featured_until = CURRENT_DATE + INTERVAL '30 days',
  featured_order = 2
WHERE id IN (
  SELECT id FROM vendors WHERE id NOT IN (
    SELECT id FROM vendors ORDER BY created_at DESC LIMIT 1
  ) ORDER BY created_at DESC LIMIT 1
);