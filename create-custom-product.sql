-- Create a generic "Custom Order" product for all custom orders
-- Run this in Supabase SQL Editor

-- First, check if a custom order product exists
DO $$
DECLARE
  custom_product_id uuid;
BEGIN
  -- Try to find existing custom product
  SELECT id INTO custom_product_id
  FROM products
  WHERE name = 'طلب خاص'
  LIMIT 1;

  -- If not found, create it
  IF custom_product_id IS NULL THEN
    INSERT INTO products (
      id,
      name,
      description,
      price,
      vendor_id,
      category,
      status,
      is_available
    ) VALUES (
      '00000000-0000-0000-0000-000000000001'::uuid, -- Fixed UUID for custom orders
      'طلب خاص',
      'منتج عام للطلبات المخصصة',
      0,
      (SELECT id FROM vendors LIMIT 1), -- Use any vendor
      'custom',
      'active',
      true
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Custom order product created with ID: 00000000-0000-0000-0000-000000000001';
  ELSE
    RAISE NOTICE 'Custom order product already exists with ID: %', custom_product_id;
  END IF;
END $$;
