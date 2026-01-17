/*
  # Enable RLS and policies for vendor_custom_categories

  1. Security Changes
    - Enable Row Level Security on `vendor_custom_categories` table
    - Add policy for public read access (anyone can view custom categories)
    - Add policy for vendors to manage their own custom categories

  2. Important Notes
    - Custom categories need to be publicly readable so customers can see them
    - Only vendors should be able to create/update/delete their own categories
*/

-- Enable RLS
ALTER TABLE vendor_custom_categories ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view custom categories (needed for customers to see products in custom categories)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'vendor_custom_categories' 
    AND policyname = 'Anyone can view custom categories'
  ) THEN
    CREATE POLICY "Anyone can view custom categories"
      ON vendor_custom_categories
      FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;

-- Policy: Vendors can manage their own custom categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'vendor_custom_categories' 
    AND policyname = 'Vendors can manage own categories'
  ) THEN
    CREATE POLICY "Vendors can manage own categories"
      ON vendor_custom_categories
      FOR ALL
      TO authenticated
      USING (auth.uid() = vendor_id)
      WITH CHECK (auth.uid() = vendor_id);
  END IF;
END $$;