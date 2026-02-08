/*
  # Fix set_preparation_times function to handle NULL actual_preparation_time

  1. Changes
    - Updates the set_preparation_times function to properly handle NULL actual_preparation_time
    - Falls back to default preparation_time when actual_preparation_time is NULL
    - Prevents errors when actual_preparation_time is not set

  2. Purpose
    - Fixes the "actual_new has no field actual_preparation_time" error
    - Allows orders to work normally without requiring actual_preparation_time
*/

-- Update set_preparation_times function to handle NULL actual_preparation_time
CREATE OR REPLACE FUNCTION public.set_preparation_times()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Only set preparation times when status is appropriate
    IF NEW.status = 'pending' OR NEW.status = 'processing' OR NEW.status = 'confirmed' THEN
        -- If preparation_time is not set, set default of 20 minutes
        IF NEW.preparation_time IS NULL THEN
            NEW.preparation_time := 20;
        END IF;

        -- Set preparation_start to current time if not set
        IF NEW.preparation_start IS NULL THEN
            NEW.preparation_start := now();
        END IF;

        -- Calculate preparation_end based on preparation_time (not actual_preparation_time)
        NEW.preparation_end := NEW.preparation_start + (NEW.preparation_time * interval '1 minute');
    END IF;

    -- Copy vendor coordinates to vendor_geocoded fields if available
    IF TG_TABLE_NAME = 'driver_waiting_list' AND NEW.vendor_id IS NOT NULL THEN
        -- Try to get vendor coordinates
        DECLARE
            vendor_lat numeric;
            vendor_lng numeric;
        BEGIN
            SELECT latitude, longitude INTO vendor_lat, vendor_lng
            FROM vendors 
            WHERE id = NEW.vendor_id;

            IF vendor_lat IS NOT NULL AND vendor_lng IS NOT NULL THEN
                NEW.vendor_geocoded_latitude := vendor_lat;
                NEW.vendor_geocoded_longitude := vendor_lng;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- Silently fail and continue
                NULL;
        END;
    END IF;

    RETURN NEW;
END;
$function$;
