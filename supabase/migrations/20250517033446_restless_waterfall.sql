/*
  # Add items data to orders table

  1. Changes
    - Add `items_data` JSONB column to orders table to store order items
    - Create GIN index for efficient JSON querying
    - Add default empty array value
  
  2. Security
    - No changes to RLS policies needed
*/

-- Add items_data column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'items_data'
  ) THEN
    ALTER TABLE orders 
    ADD COLUMN items_data JSONB DEFAULT '[]'::jsonb;

    -- Create index for JSON querying
    CREATE INDEX idx_orders_items_data ON orders USING gin (items_data);
  END IF;
END $$;