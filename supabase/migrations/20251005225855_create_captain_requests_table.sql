/*
  # Create captain_requests table

  1. New Tables
    - `captain_requests`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, references auth.users)
      - `customer_name` (text, required)
      - `customer_phone` (text, required)
      - `pickup_address` (text, required)
      - `pickup_latitude` (numeric, optional)
      - `pickup_longitude` (numeric, optional)
      - `destination_address` (text, required)
      - `destination_latitude` (numeric, optional)
      - `destination_longitude` (numeric, optional)
      - `notes` (text, optional)
      - `status` (text, required - pending/assigned/completed/cancelled)
      - `captain_id` (uuid, optional - references auth.users)
      - `estimated_fare` (numeric, optional)
      - `final_fare` (numeric, optional)
      - `payment_method` (text, required - cash/wallet)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
      - `completed_at` (timestamptz, optional)

  2. Security
    - Enable RLS on `captain_requests` table
    - Add policy for authenticated users to create their own requests
    - Add policy for users to view their own requests
    - Add policy for authenticated users (admin/captain) to view all requests

  3. Indexes
    - Index on customer_id for filtering user requests
    - Index on status for filtering by status
    - Index on created_at for sorting
    - Index on captain_id for captain assignments
*/

CREATE TABLE IF NOT EXISTS captain_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  pickup_address text NOT NULL,
  pickup_latitude numeric(10, 7),
  pickup_longitude numeric(10, 7),
  destination_address text NOT NULL,
  destination_latitude numeric(10, 7),
  destination_longitude numeric(10, 7),
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
  captain_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  estimated_fare numeric(10, 2),
  final_fare numeric(10, 2),
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'wallet')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz
);

-- Enable Row Level Security
ALTER TABLE captain_requests ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_captain_requests_customer_id ON captain_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_captain_requests_status ON captain_requests(status);
CREATE INDEX IF NOT EXISTS idx_captain_requests_created_at ON captain_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_captain_requests_captain_id ON captain_requests(captain_id);
CREATE INDEX IF NOT EXISTS idx_captain_requests_status_created ON captain_requests(status, created_at DESC);

-- Policies for Row Level Security

-- Users can create their own captain requests
CREATE POLICY "Users can create own captain requests"
  ON captain_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

-- Users can view their own captain requests
CREATE POLICY "Users can view own captain requests"
  ON captain_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id OR auth.uid() = captain_id);

-- Users can update their own pending requests (to cancel)
CREATE POLICY "Users can update own pending captain requests"
  ON captain_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id AND status = 'pending')
  WITH CHECK (auth.uid() = customer_id);

-- Authenticated users (admins/captains) can view all requests
CREATE POLICY "Authenticated users can view all captain requests for admin"
  ON captain_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users (admins/captains) can update requests
CREATE POLICY "Authenticated users can manage captain requests"
  ON captain_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_captain_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_captain_requests_updated_at_trigger
  BEFORE UPDATE ON captain_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_captain_requests_updated_at();

-- Create trigger to set completed_at when status changes to completed
CREATE OR REPLACE FUNCTION set_captain_request_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_captain_request_completed_at_trigger
  BEFORE UPDATE ON captain_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_captain_request_completed_at();
