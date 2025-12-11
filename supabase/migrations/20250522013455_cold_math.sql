/*
  # Add Rating Average Update Trigger

  1. New Functions
    - `update_rating_average` - Updates the average rating for vendors and drivers
  
  2. Changes
    - Adds a trigger to automatically update rating averages when a new rating is added
    - Ensures ratings are properly reflected in the vendor and driver profiles
*/

-- Create function to update rating average
CREATE OR REPLACE FUNCTION update_rating_average()
RETURNS TRIGGER AS $$
DECLARE
  new_rating numeric;
  new_count integer;
BEGIN
  -- Update rating based on entity type
  IF NEW.to_type = 'store' THEN
    -- Calculate new average rating for vendor
    SELECT 
      AVG(rating)::numeric(3,2), 
      COUNT(*)
    INTO 
      new_rating, 
      new_count
    FROM ratings
    WHERE to_type = 'store' AND to_id = NEW.to_id;
    
    -- Update vendor rating
    UPDATE vendors
    SET 
      rating = new_rating,
      rating_count = new_count
    WHERE id = NEW.to_id;
    
  ELSIF NEW.to_type = 'driver' THEN
    -- Calculate new average rating for driver
    SELECT 
      AVG(rating)::numeric(3,2), 
      COUNT(*)
    INTO 
      new_rating, 
      new_count
    FROM ratings
    WHERE to_type = 'driver' AND to_id = NEW.to_id;
    
    -- Update driver rating
    UPDATE drivers
    SET 
      rating = new_rating,
      rating_count = new_count
    WHERE id = NEW.to_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update rating average after insert
DROP TRIGGER IF EXISTS update_rating_after_insert ON ratings;
CREATE TRIGGER update_rating_after_insert
  AFTER INSERT ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_rating_average();