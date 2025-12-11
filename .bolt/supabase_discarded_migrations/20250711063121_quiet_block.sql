/*
  # Add Detailed Address Column to Orders Table

  1. Changes
     - Add `detailed_address` column to the `orders` table to store additional address details
     - This allows for more specific delivery instructions like apartment numbers, floor numbers, etc.
*/

-- Add detailed_address column to orders table
ALTER TABLE public.orders 
ADD COLUMN detailed_address text;

-- Add index for better query performance
CREATE INDEX idx_orders_detailed_address ON public.orders USING gin (to_tsvector('arabic'::regconfig, COALESCE(detailed_address, ''::text)));

-- Add comment to explain the purpose of the column
COMMENT ON COLUMN public.orders.detailed_address IS 'Additional address details like apartment number, floor, landmarks, etc.';