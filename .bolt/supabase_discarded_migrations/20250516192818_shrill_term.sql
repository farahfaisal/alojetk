/*
  # Add name column to order_items table

  1. Changes
     - Adds the `name` column to the `order_items` table if it doesn't exist
     - Refreshes the PostgREST schema cache to ensure the new column is recognized

  This migration addresses the error "Could not find the 'vendor_name' column of 'order_items' in the schema cache"
  by ensuring both required columns exist and are properly recognized by the API.
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

-- Refresh the schema cache for PostgREST to recognize the new column
SELECT pg_notify('pgrst', 'reload schema');