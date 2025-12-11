/*
  # Add vendor_name column to order_items table

  1. Changes
    - Add vendor_name column to order_items table
    - Refresh the schema cache for PostgREST
*/

-- Add vendor_name column to order_items table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'order_items' AND column_name = 'vendor_name'
  ) THEN
    ALTER TABLE order_items ADD COLUMN vendor_name TEXT;
  END IF;
END $$;

-- Refresh the schema cache for PostgREST
SELECT pg_notify('pgrst', 'reload schema');