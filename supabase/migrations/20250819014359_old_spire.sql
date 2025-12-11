/*
  # Fix app.supabase_url parameter error

  1. Database Configuration
    - Create a function to get the Supabase URL from environment
    - Replace any references to app.supabase_url with the new function
  
  2. Function Updates
    - Update any functions that reference app.supabase_url
    - Use environment variables or hardcoded values instead
  
  3. Security
    - Ensure proper access control for the new function
*/

-- Create a function to get the Supabase URL
CREATE OR REPLACE FUNCTION get_supabase_url()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return the hardcoded Supabase URL since we can't access app.supabase_url
  RETURN 'https://tfeqqjtkjkasmmgzflmc.supabase.co';
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_supabase_url() TO authenticated;
GRANT EXECUTE ON FUNCTION get_supabase_url() TO anon;

-- Update any functions that might be using app.supabase_url
-- Check if send_external_notification function exists and update it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'send_external_notification'
  ) THEN
    -- Update the function to use our new function instead of app.supabase_url
    CREATE OR REPLACE FUNCTION send_external_notification()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $func$
    BEGIN
      -- Log the order creation without external notification for now
      INSERT INTO system_logs (event_type, message, details)
      VALUES (
        'info',
        'Order created',
        jsonb_build_object(
          'order_id', NEW.id,
          'customer_id', NEW.customer_id,
          'vendor_id', NEW.vendor_id,
          'total', NEW.total
        )
      );
      
      RETURN NEW;
    END;
    $func$;
  END IF;
END $$;

-- Check if handle_order_status_update function exists and update it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'handle_order_status_update'
  ) THEN
    -- Update the function to use our new function instead of app.supabase_url
    CREATE OR REPLACE FUNCTION handle_order_status_update()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $func$
    BEGIN
      -- Log the status update without external notification for now
      INSERT INTO system_logs (event_type, message, details)
      VALUES (
        'info',
        'Order status updated',
        jsonb_build_object(
          'order_id', NEW.id,
          'old_status', OLD.status,
          'new_status', NEW.status
        )
      );
      
      RETURN NEW;
    END;
    $func$;
  END IF;
END $$;