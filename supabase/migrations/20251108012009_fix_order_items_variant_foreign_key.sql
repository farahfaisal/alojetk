/*
  # Fix order_items variant_id foreign key constraint

  1. Changes
    - Drop incorrect foreign key constraint `order_items_variant_id_fkey` that points to `products` table
    - Add correct foreign key constraint for `variant_id` that points to `product_variants` table
  
  2. Security
    - No changes to RLS policies
*/

-- Drop the incorrect foreign key constraint
ALTER TABLE order_items 
DROP CONSTRAINT IF EXISTS order_items_variant_id_fkey;

-- Add the correct foreign key constraint pointing to product_variants table
ALTER TABLE order_items 
ADD CONSTRAINT order_items_variant_id_fkey 
FOREIGN KEY (variant_id) 
REFERENCES product_variants(id) 
ON DELETE SET NULL;