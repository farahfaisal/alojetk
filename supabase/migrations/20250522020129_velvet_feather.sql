/*
  # Add driver_name column to orders table

  1. Changes
    - Add `driver_name` column to orders table
    - Add comment to explain the purpose of the column
    - Create index for faster lookups
  
  2. Purpose
    - Store driver name directly in orders table for easier access
    - Improve performance when displaying driver information in order tracking
*/

-- Add driver_name column to orders table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'driver_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN driver_name TEXT;
    
    -- Add comment to explain the purpose of the column
    COMMENT ON COLUMN orders.driver_name IS 'Name of the driver assigned to this order';
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_driver_name ON orders(driver_name);