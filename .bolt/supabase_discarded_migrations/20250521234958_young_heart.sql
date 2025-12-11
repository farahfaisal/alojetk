/*
  # Add featured column to vendors table
  
  1. Changes
    - Add `featured` boolean column to vendors table
    - Add index for faster queries
    - Update existing vendors with sample featured data
*/

-- Add featured column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'vendors' 
    AND column_name = 'featured'
  ) THEN
    ALTER TABLE vendors 
    ADD COLUMN featured BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_vendors_featured ON vendors(featured);

-- Update a few vendors to be featured (for demonstration)
UPDATE vendors
SET featured = true
WHERE id IN (
  SELECT id FROM vendors ORDER BY created_at DESC LIMIT 5
);