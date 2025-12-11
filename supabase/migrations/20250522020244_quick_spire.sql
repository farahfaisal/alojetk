/*
  # Add function to update delivery status with driver

  1. New Functions
    - `update_delivery_status_with_driver` - Updates order status when a driver is assigned
  
  2. Changes
    - Creates a trigger function to update order status and driver information
    - Adds a trigger to the driver_waiting_list table
*/

-- Create function to update order status when a driver is assigned
CREATE OR REPLACE FUNCTION update_delivery_status_with_driver()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if driver_id has been updated (assigned)
  IF NEW.driver_id IS NOT NULL AND (OLD.driver_id IS NULL OR OLD.driver_id <> NEW.driver_id) THEN
    -- Update the order with driver information
    UPDATE orders
    SET 
      driver_id = NEW.driver_id,
      driver_name = NEW.driver_name,
      status = 'delivering'
    WHERE id = NEW.order_id;
    
    -- Create a status history entry
    INSERT INTO order_status_history (
      order_id,
      status,
      note,
      created_by
    ) VALUES (
      NEW.order_id,
      'delivering',
      'تم تعيين السائق ' || COALESCE(NEW.driver_name, 'غير معروف') || ' للطلب',
      NEW.driver_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on driver_waiting_list
DROP TRIGGER IF EXISTS update_order_with_driver_trigger ON driver_waiting_list;
CREATE TRIGGER update_order_with_driver_trigger
  AFTER UPDATE OF driver_id ON driver_waiting_list
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_status_with_driver();