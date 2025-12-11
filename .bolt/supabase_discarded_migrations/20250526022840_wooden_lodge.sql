/*
  # Add vendor type column

  1. Changes
    - Add type column to vendors table
    - Add check constraint for valid types
    - Set default type values for existing vendors
  
  2. Security
    - Maintains existing RLS policies
*/

-- Add type column to vendors if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'type'
  ) THEN
    ALTER TABLE vendors ADD COLUMN type text DEFAULT 'restaurant'::text;
    
    -- Add constraint for valid types
    ALTER TABLE vendors
      ADD CONSTRAINT vendors_type_check 
      CHECK (type IN ('restaurant', 'supermarket'));
      
    -- Create index for type column
    CREATE INDEX IF NOT EXISTS idx_vendors_type ON vendors(type);
  END IF;
END $$;