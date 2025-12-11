/*
  # Add points_discount column to orders table

  1. New Columns
    - `points_discount` (numeric) - The discount amount applied from points redemption
  
  2. Changes
    - Adds a new column to track the monetary value of points applied to an order
    - Creates an index for faster queries
    - Ensures the discount value is non-negative
*/

-- Add points_discount column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'points_discount'
  ) THEN
    ALTER TABLE orders 
    ADD COLUMN points_discount NUMERIC(10,2) DEFAULT 0;

    -- Add constraint to ensure points_discount is non-negative
    ALTER TABLE orders
    ADD CONSTRAINT points_discount_non_negative CHECK (points_discount >= 0);

    -- Create index for faster queries
    CREATE INDEX idx_orders_points_discount ON orders (points_discount);
  END IF;
END $$;