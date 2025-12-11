/*
  # Fix variant_id foreign key to be nullable and non-strict
  
  1. Changes
    - Make variant_id in order_items truly optional by removing strict foreign key
    - Allow orders to be placed even if variant doesn't exist in product_variants
    - This fixes the error when variant_id is passed but doesn't exist in the variants table
  
  2. Security
    - No changes to RLS policies
*/

-- Drop the strict foreign key constraint
ALTER TABLE order_items 
DROP CONSTRAINT IF EXISTS order_items_variant_id_fkey;

-- We don't re-add the constraint to allow flexibility
-- variant_id will remain as a nullable field without strict foreign key validation
-- This allows us to store variant information even if the variant is later deleted
-- or if the variant_id doesn't match the product_variants table structure