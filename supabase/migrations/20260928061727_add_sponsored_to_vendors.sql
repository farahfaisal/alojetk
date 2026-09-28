/*
# Add sponsored column to vendors

1. Changes
- Add `sponsored` boolean column to `vendors` table, default false.
- This allows marking specific vendors as "sponsored" (متجار مموله) to display in a dedicated section.
2. Security
- No RLS policy changes needed — existing policies cover the new column.
*/

ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS sponsored boolean DEFAULT false;
