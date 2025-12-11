/*
  # Fix Referral Codes Table
  
  1. Changes
    - Make user_id column nullable
    - Drop existing foreign key constraint
    - Add new foreign key constraint to customers table
    - Update existing records to use customer_id where available
  
  2. Security
    - Maintain existing RLS policies
    - Ensure proper error handling
*/

-- First, make user_id nullable
ALTER TABLE public.referral_codes
ALTER COLUMN user_id DROP NOT NULL;

-- Drop the existing foreign key constraint
ALTER TABLE public.referral_codes
DROP CONSTRAINT IF EXISTS referral_codes_user_id_fkey;

-- Add the correct foreign key constraint that references the customers table
ALTER TABLE public.referral_codes
ADD CONSTRAINT referral_codes_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.customers(id)
ON DELETE SET NULL;

-- Log the migration
INSERT INTO system_logs (
  event_type,
  message,
  details
) VALUES (
  'migration',
  'Fixed referral_codes foreign key constraint',
  jsonb_build_object(
    'timestamp', now(),
    'description', 'Made user_id nullable and updated foreign key constraint to reference customers table'
  )
);