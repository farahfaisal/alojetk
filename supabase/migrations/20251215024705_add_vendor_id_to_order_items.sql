/*
  # Add vendor_id column to order_items

  1. Changes
    - Add vendor_id column to order_items table if it doesn't exist
    - Make it nullable to support both regular and custom orders
    - Add foreign key reference to vendors table

  2. Notes
    - This change is safe and backward compatible
    - Existing orders will have NULL vendor_id
*/

-- Add vendor_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'order_items' AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE order_items ADD COLUMN vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_order_items_vendor_id ON order_items(vendor_id);
