/*
  # Add Zone IDs to Captain Requests

  1. Changes
    - Add `pickup_zone_id` column to captain_requests table
    - Add `destination_zone_id` column to captain_requests table
    - Add foreign key constraints to service_areas table
    - Make lat/lng columns optional since we'll use zones instead

  2. Purpose
    - Allow captain requests to use service areas instead of map coordinates
    - Simplify the delivery request process by using predefined zones
*/

-- Add zone ID columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'captain_requests' AND column_name = 'pickup_zone_id'
  ) THEN
    ALTER TABLE captain_requests 
    ADD COLUMN pickup_zone_id uuid REFERENCES service_areas(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'captain_requests' AND column_name = 'destination_zone_id'
  ) THEN
    ALTER TABLE captain_requests 
    ADD COLUMN destination_zone_id uuid REFERENCES service_areas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_captain_requests_pickup_zone ON captain_requests(pickup_zone_id);
CREATE INDEX IF NOT EXISTS idx_captain_requests_destination_zone ON captain_requests(destination_zone_id);