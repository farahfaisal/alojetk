/*
  # Delete existing categories

  1. Changes
    - Delete all existing categories
    - Reset sequence for category IDs
    - Keep table structure intact
*/

-- Delete all existing categories
DELETE FROM categories;

-- Reset the sequence if using serial/bigserial for ID
ALTER SEQUENCE IF EXISTS categories_id_seq RESTART WITH 1;