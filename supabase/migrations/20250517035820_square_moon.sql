/*
  # Add points_applied column to orders table

  1. Changes
     - Adds `points_applied` column to the `orders` table to track how many points were applied to an order
     - Creates an index on the column for faster queries
     - Adds a check constraint to ensure points_applied is non-negative
*/

-- Add points_applied column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'points_applied'
  ) THEN
    ALTER TABLE orders 
    ADD COLUMN points_applied INTEGER DEFAULT 0;

    -- Add constraint to ensure points_applied is non-negative
    ALTER TABLE orders
    ADD CONSTRAINT points_applied_non_negative CHECK (points_applied >= 0);

    -- Create index for faster queries
    CREATE INDEX idx_orders_points_applied ON orders (points_applied);
  END IF;
END $$;