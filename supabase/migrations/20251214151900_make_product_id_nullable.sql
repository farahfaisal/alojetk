/*
  # Make product_id nullable in order_items table

  1. Changes
    - Make product_id column nullable in order_items table
    - This allows custom orders to be placed without a product_id
    - Custom orders are identified by having notes like "طلب خاص: ..."

  2. Security
    - No changes to RLS policies
*/

-- Make product_id nullable to support custom orders
ALTER TABLE order_items
ALTER COLUMN product_id DROP NOT NULL;
