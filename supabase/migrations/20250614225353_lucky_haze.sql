/*
  # Fix OTP Verification Functions
  
  1. Changes
    - Drop existing OTP functions first to avoid parameter name conflicts
    - Create new verify_otp and send_otp functions with proper implementation
    - Ensure proper error handling and customer creation
  
  2. Security
    - Maintain SECURITY DEFINER attribute for proper access control
    - Grant appropriate permissions
*/

-- First drop existing functions to avoid parameter name conflicts
DROP FUNCTION IF EXISTS verify_otp(text, text);
DROP FUNCTION IF EXISTS send_otp(text);

-- Create the verify_otp function
CREATE OR REPLACE FUNCTION verify_otp(p_phone text, p_otp text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    stored_otp_record RECORD;
    customer_record RECORD;
    result jsonb;
BEGIN
    -- Find the OTP record
    SELECT * INTO stored_otp_record
    FROM stored_otps
    WHERE phone = p_phone 
    AND otp_code = p_otp
    AND is_used = false
    AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    -- Check if OTP exists and is valid
    IF stored_otp_record IS NULL THEN
        -- Try to find any OTP for this phone to give more specific error
        SELECT * INTO stored_otp_record
        FROM stored_otps
        WHERE phone = p_phone
        ORDER BY created_at DESC
        LIMIT 1;
        
        IF stored_otp_record IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'لم يتم العثور على رمز التحقق'
            );
        ELSIF stored_otp_record.is_used = true THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'تم استخدام رمز التحقق مسبقاً'
            );
        ELSIF stored_otp_record.expires_at <= now() THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'انتهت صلاحية رمز التحقق'
            );
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'message', 'رمز التحقق غير صحيح'
            );
        END IF;
    END IF;

    -- Mark OTP as used
    UPDATE stored_otps
    SET is_used = true
    WHERE id = stored_otp_record.id;

    -- Check if customer exists
    SELECT * INTO customer_record
    FROM customers
    WHERE phone = p_phone;

    -- If customer doesn't exist, create one
    IF customer_record IS NULL THEN
        INSERT INTO customers (name, phone, created_at)
        VALUES ('مستخدم جديد', p_phone, now())
        RETURNING * INTO customer_record;
    END IF;

    -- Return success with customer info
    RETURN jsonb_build_object(
        'success', true,
        'message', 'تم التحقق بنجاح',
        'customer', jsonb_build_object(
            'id', customer_record.id,
            'name', customer_record.name,
            'phone', customer_record.phone
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'حدث خطأ أثناء التحقق من رمز التحقق'
        );
END;
$$;

-- Create the send_otp function
CREATE OR REPLACE FUNCTION send_otp(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    otp_code text;
    result jsonb;
    is_test_number boolean;
BEGIN
    -- Check if this is a test number
    is_test_number := (p_phone = '0595284308');
    
    -- Generate 6-digit OTP
    otp_code := LPAD(floor(random() * 1000000)::text, 6, '0');
    
    -- For test numbers, use a fixed OTP
    IF is_test_number THEN
        otp_code := '123456';
    END IF;
    
    -- Store OTP in database
    INSERT INTO stored_otps (phone, otp_code, created_at, expires_at, is_used)
    VALUES (p_phone, otp_code, now(), now() + interval '10 minutes', false);
    
    -- Log the OTP generation
    INSERT INTO system_logs (
        event_type,
        message,
        details
    ) VALUES (
        'otp_generated',
        'OTP generated via send_otp function',
        jsonb_build_object(
            'phone', p_phone,
            'otp', otp_code,
            'is_test_number', is_test_number,
            'timestamp', now()
        )
    );
    
    -- Return success (in real implementation, this would trigger SMS sending)
    RETURN jsonb_build_object(
        'success', true,
        'message', 'تم إرسال رمز التحقق',
        'otp', otp_code  -- Remove this in production
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'فشل في إرسال رمز التحقق'
        );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION verify_otp(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION send_otp(text) TO anon, authenticated;