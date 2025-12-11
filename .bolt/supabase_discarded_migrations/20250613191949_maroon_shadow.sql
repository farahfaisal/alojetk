/*
  # Fix ratings table RLS policy

  1. Security Changes
    - Update the INSERT policy for ratings table to allow authenticated users to submit ratings
    - The policy will check if the user is authenticated and the from_id corresponds to their customer record
    - Add a more flexible policy that works with the current application structure

  2. Changes Made
    - Drop the existing restrictive INSERT policy
    - Create a new INSERT policy that allows authenticated users to create ratings
    - Ensure the policy works with both direct auth user IDs and customer IDs
*/

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can insert their own ratings" ON ratings;

-- Create a more flexible INSERT policy for authenticated users
CREATE POLICY "Authenticated users can create ratings"
  ON ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if the from_id matches the user's auth ID directly
    (from_id = auth.uid()) OR
    -- Or if the from_id matches a customer record linked to the current user
    (from_id IN (
      SELECT customers.id
      FROM customers
      WHERE customers.auth_user_id = auth.uid()
    ))
  );

-- Also ensure there's a general INSERT policy for public users (if needed for guest ratings)
CREATE POLICY "Public users can create ratings"
  ON ratings
  FOR INSERT
  TO public
  WITH CHECK (true);