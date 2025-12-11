/*
  # Fix RLS policy for ratings table

  1. Security Changes
    - Add INSERT policy for ratings table to allow authenticated users to create ratings
    - Policy ensures users can only create ratings with their own customer ID as from_id

  2. Details
    - The policy checks that the from_id in the new rating matches the customer ID 
      associated with the authenticated user
    - This prevents users from creating ratings on behalf of other customers
    - Maintains data integrity while allowing legitimate rating submissions
*/

-- Add INSERT policy for ratings table
DO $$ 
BEGIN
  -- Check if the INSERT policy already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ratings' AND policyname = 'Users can insert their own ratings'
  ) THEN
    CREATE POLICY "Users can insert their own ratings"
      ON ratings FOR INSERT
      TO authenticated
      WITH CHECK (
        from_id IN (
          SELECT id FROM customers 
          WHERE auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Grant necessary permissions
GRANT INSERT ON ratings TO authenticated;

-- Log the change
INSERT INTO system_logs (
  event_type,
  message,
  details
) VALUES (
  'schema_update',
  'تمت إضافة سياسة INSERT لجدول التقييمات',
  jsonb_build_object(
    'timestamp', now(),
    'description', 'تم إنشاء سياسة RLS للسماح للمستخدمين بإدراج تقييماتهم الخاصة'
  )
);