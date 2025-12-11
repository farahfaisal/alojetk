/*
  # Fix referral_codes foreign key constraint
  
  1. Changes
    - Make user_id nullable first before attempting to update records
    - Handle existing records with invalid user_ids
    - Add the correct foreign key constraint to reference customers table
    
  2. Security
    - Use ON DELETE SET NULL for safer cascading behavior
    - Log changes for audit purposes
*/

-- First, make user_id nullable to allow the updates to proceed
ALTER TABLE public.referral_codes
ALTER COLUMN user_id DROP NOT NULL;

-- Drop the existing incorrect foreign key constraint
ALTER TABLE public.referral_codes
DROP CONSTRAINT IF EXISTS referral_codes_user_id_fkey;

-- Now identify and handle existing records with invalid user_ids
DO $$ 
BEGIN
  -- Create a temporary table to store invalid records
  CREATE TEMP TABLE invalid_referral_codes AS
  SELECT rc.id, rc.user_id, rc.customer_id
  FROM referral_codes rc
  LEFT JOIN customers c ON rc.user_id = c.id
  WHERE c.id IS NULL AND rc.user_id IS NOT NULL;
  
  -- Log the invalid records for reference
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'migration',
    'Found invalid referral_codes records',
    jsonb_build_object(
      'count', (SELECT COUNT(*) FROM invalid_referral_codes),
      'timestamp', now()
    )
  );
  
  -- Option 1: Update invalid records to use customer_id instead of user_id if available
  UPDATE referral_codes rc
  SET user_id = rc.customer_id
  FROM invalid_referral_codes irc
  WHERE rc.id = irc.id
  AND rc.customer_id IS NOT NULL;
  
  -- Option 2: Set user_id to NULL for remaining invalid records
  UPDATE referral_codes rc
  SET user_id = NULL
  FROM invalid_referral_codes irc
  WHERE rc.id = irc.id
  AND (rc.customer_id IS NULL OR rc.user_id != rc.customer_id);
  
  -- Drop the temporary table
  DROP TABLE invalid_referral_codes;
END $$;

-- Add the correct foreign key constraint that references the customers table
-- Use ON DELETE SET NULL instead of CASCADE to be safer
ALTER TABLE public.referral_codes
ADD CONSTRAINT referral_codes_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.customers(id)
ON DELETE SET NULL;

-- Log the completion of the migration
INSERT INTO system_logs (
  event_type,
  message,
  details
) VALUES (
  'migration',
  'Fixed referral_codes foreign key constraint',
  jsonb_build_object(
    'timestamp', now(),
    'description', 'Updated referral_codes table to properly reference customers table'
  )
);