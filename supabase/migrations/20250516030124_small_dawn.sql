/*
  # Add city column to orders table

  1. Changes
     - Add city column to orders table if it doesn't exist
     - Refresh schema cache to ensure PostgREST recognizes the new column
*/

-- Add city column to orders table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'city'
  ) THEN
    ALTER TABLE orders ADD COLUMN city TEXT;
  END IF;
END $$;

-- Refresh the schema cache for PostgREST
SELECT pg_notify('pgrst', 'reload schema');