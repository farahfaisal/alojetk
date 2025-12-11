/*
  # Add delivery settings to shipping methods

  1. Changes
    - Add `delivery_type` column to shipping_methods table
      - Can be 'distance', 'fixed', or 'zones'
    - Add `settings` column to store delivery configuration
      - JSON field to store flexible delivery settings
      - Example: { "price_per_km": 5, "min_distance": 1, "max_distance": 10 }

  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns to shipping_methods
ALTER TABLE shipping_methods 
ADD COLUMN IF NOT EXISTS delivery_type text DEFAULT 'distance'::text,
ADD COLUMN IF NOT EXISTS settings jsonb;

-- Add comment to explain settings structure
COMMENT ON COLUMN shipping_methods.settings IS 
'JSON configuration for delivery settings. Example:
{
  "price_per_km": 5,
  "min_distance": 1,
  "max_distance": 10,
  "free_delivery_min": 100,
  "zones": [
    {
      "name": "Zone A",
      "cost": 10
    }
  ]
}';

-- Create function to validate delivery type
CREATE OR REPLACE FUNCTION validate_delivery_type()
RETURNS trigger AS $$
BEGIN
  IF NEW.delivery_type NOT IN ('distance', 'fixed', 'zones') THEN
    RAISE EXCEPTION 'Invalid delivery type. Must be one of: distance, fixed, zones';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate delivery type
DROP TRIGGER IF EXISTS validate_delivery_type_trigger ON shipping_methods;
CREATE TRIGGER validate_delivery_type_trigger
  BEFORE INSERT OR UPDATE ON shipping_methods
  FOR EACH ROW
  EXECUTE FUNCTION validate_delivery_type();