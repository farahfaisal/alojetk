/*
  # Add name column to order_items table

  1. Changes
     - Adds the `name` column to the `order_items` table if it doesn't exist
     - Refreshes the PostgREST schema cache to ensure the new column is recognized

  This migration ensures that the order_items table has the name column needed for storing product names.
*/

-- Add name column to order_items table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'order_items' AND column_name = 'name'
  ) THEN
    ALTER TABLE order_items ADD COLUMN name TEXT;
  END IF;
END $$;

-- Refresh the schema cache for PostgREST
SELECT pg_notify('pgrst', 'reload schema');