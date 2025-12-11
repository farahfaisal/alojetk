/*
  # Add vendor_name column to orders table

  1. Changes
     - Add vendor_name column to orders table
     - Create index on vendor_name column for faster lookups
     - Update schema cache for PostgREST
*/

-- Add vendor_name column to orders table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'vendor_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN vendor_name TEXT;
  END IF;
END $$;

-- Create index on vendor_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_vendor_name ON orders(vendor_name);

-- Refresh the schema cache for PostgREST
SELECT pg_notify('pgrst', 'reload schema');