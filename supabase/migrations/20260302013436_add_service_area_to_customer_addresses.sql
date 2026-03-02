/*
  # Add service area to customer addresses

  1. Changes
    - Add service_area_id column to customer_addresses table
    - Add foreign key constraint to service_areas table
    - Add index for better query performance

  2. Security
    - No RLS changes needed (existing policies still apply)
*/

-- Add service_area_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_addresses' AND column_name = 'service_area_id'
  ) THEN
    ALTER TABLE customer_addresses 
    ADD COLUMN service_area_id uuid REFERENCES service_areas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_customer_addresses_service_area_id 
ON customer_addresses(service_area_id);

-- Add comment
COMMENT ON COLUMN customer_addresses.service_area_id IS 'ID of the service area for this address';
