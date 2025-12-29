/*
  # Fix Captain Requests Customer Reference

  1. Changes
    - Drop existing foreign key constraint on captain_requests.customer_id
    - Add new foreign key constraint pointing to customers table instead of auth.users
    - This allows captain requests to reference customers directly

  2. Purpose
    - Fix the foreign key relationship to match the application's data model
    - customers table is the main table for customer data, not auth.users
*/

-- Drop the existing foreign key constraint
ALTER TABLE captain_requests 
DROP CONSTRAINT IF EXISTS captain_requests_customer_id_fkey;

-- Add new foreign key constraint pointing to customers table
ALTER TABLE captain_requests 
ADD CONSTRAINT captain_requests_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;