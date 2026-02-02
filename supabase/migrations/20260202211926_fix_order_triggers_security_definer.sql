/*
  # إصلاح صلاحيات triggers جدول orders

  1. التغييرات
    - إضافة SECURITY DEFINER لجميع دوال triggers التي تعمل على جدول orders
    - هذا يسمح للدوال بالقراءة من الجداول الأخرى بغض النظر عن سياسات RLS

  2. الأمان
    - الدوال تحتاج SECURITY DEFINER لقراءة بيانات من جداول أخرى
    - لا تشكل خطرًا أمنيًا لأنها تقوم بعمليات داخلية فقط
*/

-- إضافة SECURITY DEFINER لدالة set_city_from_address
CREATE OR REPLACE FUNCTION public.set_city_from_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.address IS NOT NULL AND (NEW.city IS NULL OR NEW.city = '') THEN
    NEW.city := extract_city_from_address(NEW.address);
  END IF;
  RETURN NEW;
END;
$function$;

-- إضافة SECURITY DEFINER لدالة set_default_coordinates
CREATE OR REPLACE FUNCTION public.set_default_coordinates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  city_name text;
  coords record;
BEGIN
  -- If coordinates are already set, don't change them
  IF NEW.geocoded_latitude IS NOT NULL AND NEW.geocoded_longitude IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get city (either already set or extract from address)
  IF NEW.city IS NOT NULL AND NEW.city != '' THEN
    city_name := NEW.city;
  ELSIF NEW.address IS NOT NULL THEN
    city_name := extract_city_from_address(NEW.address);
  ELSE
    city_name := 'جنين'; -- Default to Jenin if no city or address
  END IF;

  -- Get default coordinates for the city
  SELECT * FROM get_default_city_coordinates(city_name) INTO coords;
  
  -- Set the coordinates
  NEW.geocoded_latitude := coords.latitude;
  NEW.geocoded_longitude := coords.longitude;
  
  RETURN NEW;
END;
$function$;

-- إضافة SECURITY DEFINER لدالة set_preparation_times
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

        -- Calculate preparation_end based on preparation_time
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

-- إضافة SECURITY DEFINER لدالة calculate_order_total
CREATE OR REPLACE FUNCTION public.calculate_order_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- حساب total = subtotal + delivery_fee - points_discount - coupon_discount
  NEW.total := COALESCE(NEW.subtotal, 0) 
    + COALESCE(NEW.delivery_fee, 0) 
    - COALESCE(NEW.points_discount, 0)
    - COALESCE(NEW.coupon_discount, 0);

  -- التأكد من أن المجموع لا يكون سالباً
  IF NEW.total < 0 THEN
    NEW.total := 0;
  END IF;

  RETURN NEW;
END;
$function$;

-- إضافة SECURITY DEFINER لدالة grant_referral_rewards
CREATE OR REPLACE FUNCTION public.grant_referral_rewards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_referrer_id uuid;
  v_order_number integer;
  v_referral_settings jsonb;
  v_reward_amount numeric;
  v_orders_threshold integer;
BEGIN
  -- الحصول على إعدادات الإحالة
  SELECT settings INTO v_referral_settings
  FROM app_settings
  WHERE id = 1;

  -- التحقق من تفعيل نظام الإحالة
  IF NOT COALESCE((v_referral_settings->'referrals'->>'enabled')::boolean, false) THEN
    RETURN NEW;
  END IF;

  -- الحصول على مبلغ المكافأة وعدد الطلبات المطلوبة
  v_reward_amount := COALESCE((v_referral_settings->'referrals'->>'rewardAmount')::numeric, 0);
  v_orders_threshold := COALESCE((v_referral_settings->'referrals'->>'ordersThreshold')::integer, 1);

  -- الحصول على معرف المحيل من جدول العملاء
  SELECT referred_by INTO v_referrer_id
  FROM customers
  WHERE id = NEW.customer_id;

  -- إذا لم يكن هناك محيل، لا نفعل شيء
  IF v_referrer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- حساب عدد الطلبات المكتملة للعميل
  SELECT COUNT(*) INTO v_order_number
  FROM orders
  WHERE customer_id = NEW.customer_id
    AND status = 'completed';

  -- إذا كان هذا هو الطلب المطلوب للمكافأة
  IF v_order_number = v_orders_threshold THEN
    -- منح المكافأة للمحيل
    INSERT INTO wallet_transactions (
      customer_id,
      amount,
      type,
      description,
      created_at
    ) VALUES (
      v_referrer_id,
      v_reward_amount,
      'referral_reward',
      'مكافأة إحالة صديق',
      now()
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- إضافة SECURITY DEFINER لدالة handle_order_status_update
CREATE OR REPLACE FUNCTION public.handle_order_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_points_to_award integer;
  v_points_settings jsonb;
  v_earn_rate numeric;
BEGIN
  -- منح النقاط عند اكتمال الطلب
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- الحصول على إعدادات النقاط
    SELECT settings INTO v_points_settings
    FROM app_settings
    WHERE id = 1;

    -- التحقق من تفعيل نظام النقاط
    IF COALESCE((v_points_settings->'points'->>'enabled')::boolean, false) THEN
      -- حساب النقاط (1 نقطة لكل دينار)
      v_earn_rate := COALESCE((v_points_settings->'points'->>'earnRate')::numeric, 1);
      v_points_to_award := floor(NEW.total * v_earn_rate);

      -- إضافة النقاط
      IF v_points_to_award > 0 THEN
        INSERT INTO points_transactions (
          customer_id,
          points,
          type,
          description,
          order_id,
          created_at
        ) VALUES (
          NEW.customer_id,
          v_points_to_award,
          'earned',
          'نقاط من الطلب #' || NEW.order_number,
          NEW.id,
          now()
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
