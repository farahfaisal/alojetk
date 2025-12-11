/*
  # Fix orders items_data column

  1. New Columns
    - Add `items_data` column to the `orders` table if it doesn't exist
    - This column will store order items as a JSON array

  2. Indexes
    - Create a GIN index on the `items_data` column for faster JSON querying
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