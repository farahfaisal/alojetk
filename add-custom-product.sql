-- Run this SQL in Supabase SQL Editor
-- https://supabase.com/dashboard/project/fliwyntfvfedslbwkvks/editor/sql

-- Insert the custom order product if it doesn't exist
INSERT INTO products (
  id,
  name,
  description,
  price,
  vendor_id,
  category,
  status,
  is_available,
  created_at
)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  'طلب خاص',
  'منتج عام للطلبات المخصصة',
  0,
  v.id,
  'custom',
  'active',
  true,
  now()
FROM vendors v
LIMIT 1
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = 'active',
  is_available = true;
