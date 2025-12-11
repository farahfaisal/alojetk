/*
  # Add driver_name to driver_waiting_list table

  1. New Columns
    - `driver_name` (text) - Name of the driver who claimed this order
    - `customer_name` (text) - Customer name for easier reference
    - `address` (text) - Delivery address
    - `total` (numeric) - Order total amount
    - `notes` (text) - Additional notes or special instructions for the delivery

  2. Changes
    - Add columns to driver_waiting_list table
    - Add indexes for faster lookups
    - Add comments to explain column purposes
*/

-- Add driver_name column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'driver_waiting_list' AND column_name = 'driver_name'
  ) THEN
    ALTER TABLE driver_waiting_list ADD COLUMN driver_name TEXT;
    
    -- Add comment to explain the purpose of the column
    COMMENT ON COLUMN driver_waiting_list.driver_name IS 'Name of the driver who claimed this order';
  END IF;
END $$;

-- Add customer_name column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'driver_waiting_list' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE driver_waiting_list ADD COLUMN customer_name TEXT;
  END IF;
END $$;

-- Add address column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'driver_waiting_list' AND column_name = 'address'
  ) THEN
    ALTER TABLE driver_waiting_list ADD COLUMN address TEXT;
  END IF;
END $$;

-- Add total column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'driver_waiting_list' AND column_name = 'total'
  ) THEN
    ALTER TABLE driver_waiting_list ADD COLUMN total NUMERIC(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add notes column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'driver_waiting_list' AND column_name = 'notes'
  ) THEN
    ALTER TABLE driver_waiting_list ADD COLUMN notes TEXT;
    
    -- Add comment to explain the purpose of the column
    COMMENT ON COLUMN driver_waiting_list.notes IS 'Additional notes or special instructions for the delivery';
  END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_driver_waiting_list_driver_name ON driver_waiting_list(driver_name);
CREATE INDEX IF NOT EXISTS idx_driver_waiting_list_total ON driver_waiting_list(total);
CREATE INDEX IF NOT EXISTS idx_driver_waiting_list_notes ON driver_waiting_list USING gin (to_tsvector('arabic', COALESCE(notes, '')));