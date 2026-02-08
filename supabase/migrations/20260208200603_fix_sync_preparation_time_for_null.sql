/*
  # Fix sync_preparation_time_to_waiting_list to handle NULL actual_preparation_time

  1. Changes
    - Updates sync_preparation_time_to_waiting_list to safely check actual_preparation_time
    - Uses COALESCE to fall back to preparation_time when actual_preparation_time is NULL
    - Prevents errors when accessing the field

  2. Purpose
    - Ensures the sync function works correctly when actual_preparation_time is NULL
    - Maintains compatibility with the new NULL default
*/

-- Update sync_preparation_time_to_waiting_list function
CREATE OR REPLACE FUNCTION public.sync_preparation_time_to_waiting_list()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- If actual_preparation_time is explicitly set (not NULL)
    IF NEW.actual_preparation_time IS NOT NULL THEN
        -- Check if it was changed
        IF OLD.actual_preparation_time IS NULL OR NEW.actual_preparation_time != OLD.actual_preparation_time THEN
            -- Update the record in driver_waiting_list if it exists
            UPDATE driver_waiting_list
            SET preparation_time = NEW.actual_preparation_time
            WHERE order_id = NEW.id;

            RAISE NOTICE 'تم تحديث وقت التحضير الفعلي في قائمة الانتظار: الطلب %, الوقت %', NEW.id, NEW.actual_preparation_time;
        END IF;
    END IF;

    -- If status changed to waiting-for-driver
    IF NEW.status = 'waiting-for-driver' AND (OLD.status IS NULL OR OLD.status != 'waiting-for-driver') THEN
        -- Update preparation_time in driver_waiting_list
        -- Use actual_preparation_time if set, otherwise fall back to preparation_time
        UPDATE driver_waiting_list
        SET 
            preparation_time = COALESCE(NEW.actual_preparation_time, NEW.preparation_time, 20),
            status = 'pending'
        WHERE order_id = NEW.id;

        RAISE NOTICE 'تم تحديث الطلب لحالة waiting-for-driver: الطلب %, الوقت %', NEW.id, COALESCE(NEW.actual_preparation_time, NEW.preparation_time, 20);
    END IF;

    RETURN NEW;
END;
$function$;
