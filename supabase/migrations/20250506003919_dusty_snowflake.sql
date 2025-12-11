/*
  # Add category type and update vendors query

  1. Changes
    - Add type column to categories table
    - Add index on type column
    - Update existing categories with default type
    - Add function to filter vendors by category type

  2. Security
    - Maintain existing RLS policies
*/

-- Add type column to categories if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'type'
  ) THEN
    ALTER TABLE categories ADD COLUMN type text DEFAULT 'restaurant'::text;
  END IF;
END $$;

-- Add index for type column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_categories_type'
  ) THEN
    CREATE INDEX idx_categories_type ON categories(type);
  END IF;
END $$;

-- Drop existing constraint if it exists and create new one
DO $$ 
BEGIN
  BEGIN
    ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_type_check;
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
  
  ALTER TABLE categories
    ADD CONSTRAINT categories_type_check 
    CHECK (type IN ('restaurant', 'supermarket', 'other'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Update existing categories
UPDATE categories SET type = 'supermarket' 
WHERE name ILIKE '%سوبر%' OR name ILIKE '%بقالة%';

UPDATE categories SET type = 'restaurant' 
WHERE type IS NULL OR type NOT IN ('restaurant', 'supermarket', 'other');

-- Create or replace function to get vendors by category type
CREATE OR REPLACE FUNCTION get_vendors_by_category_type(category_type text)
RETURNS SETOF vendors AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT v.*
  FROM vendors v
  JOIN vendor_categories vc ON v.id = vc.vendor_id
  JOIN categories c ON c.id = vc.category_id
  WHERE c.type = category_type
  AND v.status = 'active';
END;
$$ LANGUAGE plpgsql;