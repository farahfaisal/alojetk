/*
  # Add items column to orders table

  1. New Columns
    - `items` (text) - A column to store order items information
  
  2. Changes
    - Adds the items column to the orders table if it doesn't exist
    - Creates an index on the items column for faster queries
*/

-- Add items column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'items'
  ) THEN
    ALTER TABLE orders 
    ADD COLUMN items TEXT;

    -- Create index for faster queries
    CREATE INDEX idx_orders_items ON orders (items);
  END IF;
END $$;