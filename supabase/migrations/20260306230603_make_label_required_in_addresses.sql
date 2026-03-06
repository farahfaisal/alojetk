/*
  # Make Label Field Required in Customer Addresses

  1. Changes
    - Make `label` column NOT NULL in customer_addresses table
    - Set default value for existing NULL labels
  
  2. Security
    - No changes to RLS policies
*/

-- First, update any NULL labels with a default value
UPDATE customer_addresses 
SET label = 'عنوان - ' || phone 
WHERE label IS NULL OR label = '';

-- Now make the column NOT NULL
ALTER TABLE customer_addresses 
ALTER COLUMN label SET NOT NULL;
