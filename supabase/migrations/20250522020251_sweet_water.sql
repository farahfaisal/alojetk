/*
  # Add function to handle delivery completion

  1. New Functions
    - `record_delivery_completion` - Records when a delivery is completed
  
  2. Changes
    - Creates a trigger function to update order status when delivery is completed
    - Adds a trigger to the driver_waiting_list table
    - Updates order status and creates history entry
*/

-- Create function to record delivery completion
CREATE OR REPLACE FUNCTION record_delivery_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status has been changed to 'delivered'
  IF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
    -- Update the order status
    UPDATE orders
    SET 
      status = 'completed',
      updated_at = now()
    WHERE id = NEW.order_id;
    
    -- Create a status history entry
    INSERT INTO order_status_history (
      order_id,
      status,
      note,
      created_by
    ) VALUES (
      NEW.order_id,
      'completed',
      'تم توصيل الطلب بنجاح',
      COALESCE(NEW.driver_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );
    
    -- Add points for the customer if applicable
    -- This would typically be handled by another function or trigger
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on driver_waiting_list
DROP TRIGGER IF EXISTS record_delivery_completion_trigger ON driver_waiting_list;
CREATE TRIGGER record_delivery_completion_trigger
  AFTER UPDATE OF status ON driver_waiting_list
  FOR EACH ROW
  WHEN (NEW.status = 'delivered')
  EXECUTE FUNCTION record_delivery_completion();

-- Add comment to explain the function
COMMENT ON FUNCTION record_delivery_completion() IS 'When a driver marks a delivery as completed, this function records the status in the history table, updates the order status, and can trigger other events like payment processing';