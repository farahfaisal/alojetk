/*
  # Add customer_id to orders table

  1. Changes
    - Add customer_id column to orders table
    - Add foreign key constraint to customers table
    - Add index for performance
*/

-- Add customer_id column
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);

-- Add index for customer_id
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);