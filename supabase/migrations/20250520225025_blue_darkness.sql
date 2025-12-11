/*
  # Add Phone Exists Function

  1. New Functions
    - `phone_exists` - Function to check if a phone number exists in the customers table
  
  2. Security
    - Function runs with security definer to bypass RLS
    - Returns boolean indicating if the phone number exists
*/

-- Create function to check if a phone number exists
CREATE OR REPLACE FUNCTION phone_exists(
  phone_number text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  exists_already boolean;
BEGIN
  -- Validate phone format
  IF NOT phone_number ~ '^0\d{9}$' THEN
    RETURN false;
  END IF;
  
  -- Check if phone exists in customers table
  SELECT EXISTS(
    SELECT 1 FROM customers WHERE phone = phone_number
  ) INTO exists_already;
  
  RETURN exists_already;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION phone_exists TO authenticated, anon;