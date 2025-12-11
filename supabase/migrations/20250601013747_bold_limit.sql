/*
  # Fix ratings table to_type constraint
  
  1. Changes
    - Drop the existing constraint
    - Add a new constraint that includes 'product' as a valid type
    - Ensure 'vendor' is used instead of 'store' for store ratings
  
  2. Purpose
    - Allow product ratings to be submitted
    - Fix the error: "new row for relation "ratings" violates check constraint "ratings_to_type_check""
*/

-- Drop the existing constraint
ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_to_type_check;

-- Add the updated constraint including 'product' as a valid type
ALTER TABLE ratings
  ADD CONSTRAINT ratings_to_type_check 
  CHECK (to_type = ANY (ARRAY['customer'::text, 'vendor'::text, 'driver'::text, 'product'::text]));