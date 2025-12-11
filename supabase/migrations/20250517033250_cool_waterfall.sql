/*
  # Add items column to orders table

  1. Changes
    - Add `items_data` JSONB column to store order items
    - Add GIN index for faster JSON querying
    - Add trigger to update updated_at timestamp

  2. Notes
    - Using JSONB for flexible item storage
    - GIN index improves query performance on JSON data
*/

-- Add items_data column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'items_data'
  ) THEN
    ALTER TABLE orders ADD COLUMN items_data JSONB DEFAULT '[]'::jsonb;
    
    -- Create GIN index for faster JSON querying
    CREATE INDEX IF NOT EXISTS idx_orders_items_data ON orders USING gin (items_data);
  END IF;
END $$;