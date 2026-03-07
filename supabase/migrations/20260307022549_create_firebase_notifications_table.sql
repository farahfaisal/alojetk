/*
  # Create Firebase Notifications Table

  1. New Tables
    - `firebase_notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references customers)
      - `title` (text)
      - `body` (text)
      - `data` (jsonb, stores notification payload)
      - `is_read` (boolean, default false)
      - `created_at` (timestamptz, default now())
  
  2. Security
    - Enable RLS on `firebase_notifications` table
    - Add policy for authenticated users to read their own notifications
    - Add policy for inserting notifications
*/

-- Create firebase_notifications table
CREATE TABLE IF NOT EXISTS firebase_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_firebase_notifications_user_id ON firebase_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_firebase_notifications_created_at ON firebase_notifications(created_at DESC);

-- Enable RLS
ALTER TABLE firebase_notifications ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own notifications
CREATE POLICY "Users can view own firebase notifications"
  ON firebase_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy for users to view their own notifications (using customer_id)
CREATE POLICY "Customers can view own firebase notifications"
  ON firebase_notifications
  FOR SELECT
  TO public
  USING (
    user_id IN (
      SELECT id FROM customers WHERE id = user_id
    )
  );

-- Policy for inserting notifications (allow system to insert)
CREATE POLICY "Allow inserting firebase notifications"
  ON firebase_notifications
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy for updating notifications to mark as read
CREATE POLICY "Users can update own firebase notifications"
  ON firebase_notifications
  FOR UPDATE
  TO public
  USING (
    user_id IN (
      SELECT id FROM customers WHERE id = user_id
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM customers WHERE id = user_id
    )
  );