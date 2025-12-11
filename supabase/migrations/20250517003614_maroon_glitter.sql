/*
  # Add redemption code to orders table
  
  1. Changes
    - Add redemption_code column to orders table
    - Add index for faster lookups
    
  2. Purpose
    - Allow tracking of points redemption codes used in orders
*/

-- Add redemption_code column to orders table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'redemption_code'
  ) THEN
    ALTER TABLE orders ADD COLUMN redemption_code text;
  END IF;
END $$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_redemption_code ON orders(redemption_code);