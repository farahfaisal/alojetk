/*
  # Add Main and Sub Area Fields to Customer Addresses

  1. Changes
    - Add `main_area` column (text, nullable) - للمنطقة الرئيسية
    - Add `sub_area` column (text, nullable) - للمنطقة الفرعية
  
  2. Purpose
    - Allow customers to specify main and sub areas for better address organization
    - Both fields are optional to maintain backward compatibility
*/

-- Add main_area column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_addresses' AND column_name = 'main_area'
  ) THEN
    ALTER TABLE customer_addresses ADD COLUMN main_area text;
  END IF;
END $$;

-- Add sub_area column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_addresses' AND column_name = 'sub_area'
  ) THEN
    ALTER TABLE customer_addresses ADD COLUMN sub_area text;
  END IF;
END $$;
