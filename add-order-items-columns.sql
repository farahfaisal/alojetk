-- Add missing columns to order_items table for custom orders and variants

-- Add product_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'product_name'
  ) THEN
    ALTER TABLE order_items ADD COLUMN product_name text;
  END IF;
END $$;

-- Add addons_data column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'addons_data'
  ) THEN
    ALTER TABLE order_items ADD COLUMN addons_data jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add variant_id column if it doesn't exist (might already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'variant_id'
  ) THEN
    ALTER TABLE order_items ADD COLUMN variant_id uuid;
  END IF;
END $$;

-- Add variant_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'variant_name'
  ) THEN
    ALTER TABLE order_items ADD COLUMN variant_name text;
  END IF;
END $$;

-- Add preparation_time column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'preparation_time'
  ) THEN
    ALTER TABLE order_items ADD COLUMN preparation_time integer;
  END IF;
END $$;
