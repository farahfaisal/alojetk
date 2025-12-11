/*
  # Add Featured Vendors and Categories

  1. Changes
    - Add is_featured column to vendors table
    - Create vendor_categories table for vendor-category relationships
    - Add necessary indexes and policies

  2. Security
    - Enable RLS on vendor_categories table
    - Add policies for public viewing and vendor management
*/

-- Add is_featured column to vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_vendors_is_featured ON vendors(is_featured);

-- Create vendor_categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS vendor_categories (
    vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE,
    category_id uuid REFERENCES vendor_categories_table(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (vendor_id, category_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vendor_categories_vendor_id ON vendor_categories(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_categories_category_id ON vendor_categories(category_id);

-- Enable RLS
ALTER TABLE vendor_categories ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public can view vendor categories"
    ON vendor_categories FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Vendors can manage their categories"
    ON vendor_categories FOR ALL
    TO authenticated
    USING (vendor_id IN (
        SELECT id FROM vendors WHERE user_id = auth.uid()
    ))
    WITH CHECK (vendor_id IN (
        SELECT id FROM vendors WHERE user_id = auth.uid()
    ));