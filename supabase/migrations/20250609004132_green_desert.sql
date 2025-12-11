/*
  # Add type column to vendors table

  1. Changes
    - Add `type` column to `vendors` table to categorize vendors (restaurants, supermarkets, etc.)
    - Set default value and add constraint for valid types
    - Update existing records with appropriate type values based on categories they're associated with

  2. Security
    - No changes to RLS policies needed as this is just adding a column
*/

-- Add type column to vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS type text DEFAULT 'مطاعم';

-- Add constraint to ensure only valid types are allowed
ALTER TABLE vendors ADD CONSTRAINT vendors_type_check 
CHECK (type = ANY (ARRAY['مطاعم'::text, 'ماركت'::text, 'other'::text]));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_vendors_type ON vendors USING btree (type);

-- Update existing vendors with appropriate types based on their category associations
-- This is a best-effort update - you may need to manually adjust some records
UPDATE vendors 
SET type = 'ماركت' 
WHERE id IN (
  SELECT DISTINCT v.id 
  FROM vendors v
  JOIN vendor_categories vc ON v.id = vc.vendor_id
  JOIN categories c ON vc.category_id = c.id
  WHERE c.name ILIKE '%ماركت%' OR c.name ILIKE '%market%' OR c.name ILIKE '%سوبر%'
);

-- Set remaining vendors as restaurants (default)
UPDATE vendors 
SET type = 'مطاعم' 
WHERE type IS NULL OR type = 'مطاعم';