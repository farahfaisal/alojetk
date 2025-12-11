/*
  # Update ratings table to_type constraint

  1. Changes
    - Modify the to_type check constraint to include 'product' as a valid value
    - This allows product ratings to be submitted through the RatingModal component

  2. Security
    - No changes to RLS policies required
    - Existing permissions continue to apply
*/

-- Drop the existing constraint
ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_to_type_check;

-- Add the updated constraint including 'product' as a valid type
ALTER TABLE ratings
  ADD CONSTRAINT ratings_to_type_check 
  CHECK (to_type = ANY (ARRAY['customer'::text, 'vendor'::text, 'driver'::text, 'product'::text]));