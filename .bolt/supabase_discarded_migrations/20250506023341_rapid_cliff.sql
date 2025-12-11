/*
  # Add featured flag to vendors

  1. Changes
    - Add is_featured column to vendors table
    - Add index on is_featured column
    - Add function to get featured vendors by category type

  2. Security
    - Maintain existing RLS policies
*/

-- Add is_featured column to vendors if it doesn't exist
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- Add index for is_featured column
CREATE INDEX IF NOT EXISTS idx_vendors_featured ON vendors(is_featured);

-- Create or replace function to get featured vendors by category type
CREATE OR REPLACE FUNCTION get_featured_vendors_by_type(category_type text)
RETURNS SETOF vendors AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT v.*
  FROM vendors v
  JOIN vendor_categories vc ON v.id = vc.vendor_id
  JOIN categories c ON c.id = vc.category_id
  WHERE c.type = category_type
  AND v.status = 'active'
  AND v.is_featured = true;
END;
$$ LANGUAGE plpgsql;