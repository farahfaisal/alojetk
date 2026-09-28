/*
# Add missing columns to customer_addresses

1. Changes
- Add `service_area_id` (uuid, nullable, FK to service_areas.id) to link addresses to a service area.
- Add `label` (text, nullable) for address labels (e.g. "Home", "Work").
- Add `main_area` (text, nullable) for main area name.
- Add `sub_area` (text, nullable) for sub area name.
2. Security
- No RLS changes — existing policies remain unchanged.
3. Notes
- These columns already exist in the frontend code (storage.ts) but were never applied to the database.
- The service_area_id FK enables the join with service_areas that the frontend expects.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_addresses' AND column_name = 'service_area_id'
  ) THEN
    ALTER TABLE customer_addresses ADD COLUMN service_area_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_addresses' AND column_name = 'label'
  ) THEN
    ALTER TABLE customer_addresses ADD COLUMN label text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_addresses' AND column_name = 'main_area'
  ) THEN
    ALTER TABLE customer_addresses ADD COLUMN main_area text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_addresses' AND column_name = 'sub_area'
  ) THEN
    ALTER TABLE customer_addresses ADD COLUMN sub_area text;
  END IF;
END $$;

-- Add FK constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_addresses_service_area_id_fkey'
  ) THEN
    ALTER TABLE customer_addresses
    ADD CONSTRAINT customer_addresses_service_area_id_fkey
    FOREIGN KEY (service_area_id) REFERENCES service_areas(id) ON DELETE SET NULL;
  END IF;
END $$;
