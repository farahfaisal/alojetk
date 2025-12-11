/*
  # Add Featured Column to Vendors Table
  
  1. Changes
    - Add `featured` boolean column to vendors table if it doesn't exist
    - Create index for faster queries
    - Update some vendors to be featured for demonstration
  
  2. Security
    - No changes to RLS policies needed
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

-- Update some vendors to be featured (for demonstration)
UPDATE vendors
SET featured = true
WHERE id IN (
  SELECT id FROM vendors 
  WHERE status = 'active'
  ORDER BY created_at DESC
  LIMIT 5
);