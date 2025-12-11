/*
  # Add Scheduled Delivery Time to Orders

  1. Changes
    - Add `scheduled_delivery_time` column to `orders` table
      - Type: timestamptz (timestamp with timezone)
      - Nullable: true (only required for scheduled deliveries)
      - Purpose: Store the customer's preferred delivery time for scheduled orders
  
  2. Notes
    - If null, the order is for immediate delivery
    - If set, the order is scheduled for the specified time
    - Helps restaurants and drivers plan ahead
*/

-- Add scheduled_delivery_time column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'scheduled_delivery_time'
  ) THEN
    ALTER TABLE orders ADD COLUMN scheduled_delivery_time timestamptz;
  END IF;
END $$;

-- Add index for querying scheduled orders
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_delivery 
ON orders(scheduled_delivery_time) 
WHERE scheduled_delivery_time IS NOT NULL;