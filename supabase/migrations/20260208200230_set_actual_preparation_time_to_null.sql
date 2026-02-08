/*
  # Reset actual_preparation_time to NULL

  1. Changes
    - Updates all existing orders to set actual_preparation_time to NULL
    - This field will no longer have automatic values

  2. Purpose
    - Removes any computed or default values from actual_preparation_time
    - Allows manual setting of actual preparation times only
*/

-- Reset all existing actual_preparation_time values to NULL
UPDATE orders
SET actual_preparation_time = NULL
WHERE actual_preparation_time IS NOT NULL;
