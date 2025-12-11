/*
  # Add city column to customers table

  1. Changes
    - Add `city` column to `customers` table as optional text field
    - This allows storing customer city information during registration

  2. Details
    - Column type: text (nullable)
    - Default value: null
    - This resolves the error where the application tries to insert city data
      but the column doesn't exist in the database schema
*/

-- Add city column to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'city'
  ) THEN
    ALTER TABLE customers ADD COLUMN city text;
  END IF;
END $$;