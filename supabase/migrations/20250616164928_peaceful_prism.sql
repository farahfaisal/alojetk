/*
  # Fix OTP Functions
  
  1. Changes
    - Drop existing functions first to avoid return type errors
    - Create new send_otp and verify_otp functions with proper implementation
    - Ensure proper error handling and customer verification
  
  2. Security
    - Maintain SECURITY DEFINER attribute for proper access control
    - Grant appropriate permissions
*/

-- First drop existing functions to avoid return type errors
DROP FUNCTION IF EXISTS send_otp(text);
DROP FUNCTION IF EXISTS verify_otp(text, text);

-- Function to send OTP
CREATE OR REPLACE FUNCTION send_otp(p_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_otp text;
    v_expires_at timestamptz;
BEGIN
    -- Generate 6-digit OTP
    v_otp := LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');
    v_expires_at := now() + interval '10 minutes';
    
    -- For test phone number, use fixed OTP
    IF p_phone = '0595284308' THEN
        v_otp := '123456';
    END IF;
    
    -- Store OTP in stored_otps table
    INSERT INTO stored_otps (phone, otp_code, expires_at)
    VALUES (p_phone, v_otp, v_expires_at)
    ON CONFLICT (phone) 
    DO UPDATE SET 
        otp_code = EXCLUDED.otp_code,
        expires_at = EXCLUDED.expires_at,
        is_used = false,
        created_at = now();
    
    -- For test phone, return the OTP in response
    IF p_phone = '0595284308' THEN
        RETURN json_build_object(
            'success', true,
            'message', 'تم إرسال رمز التحقق بنجاح',
            'otp', v_otp
        );
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', 'تم إرسال رمز التحقق بنجاح'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', 'فشل في إرسال رمز التحقق: ' || SQLERRM
        );
END;
$$;

-- Function to verify OTP
CREATE OR REPLACE FUNCTION verify_otp(p_phone text, p_otp text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stored_otp record;
    v_customer record;
    v_customer_id uuid;
BEGIN
    -- Check if OTP exists and is valid
    SELECT * INTO v_stored_otp
    FROM stored_otps
    WHERE phone = p_phone 
    AND otp_code = p_otp 
    AND expires_at > now() 
    AND is_used = false;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', 'رمز التحقق غير صحيح أو منتهي الصلاحية'
        );
    END IF;
    
    -- Mark OTP as used
    UPDATE stored_otps 
    SET is_used = true 
    WHERE id = v_stored_otp.id;
    
    -- Check if customer exists
    SELECT * INTO v_customer
    FROM customers
    WHERE phone = p_phone;
    
    IF FOUND THEN
        -- Existing customer
        RETURN json_build_object(
            'success', true,
            'message', 'تم التحقق بنجاح',
            'user', json_build_object(
                'id', v_customer.id,
                'name', v_customer.name,
                'phone', v_customer.phone,
                'email', v_customer.email
            ),
            'existing_user', true
        );
    ELSE
        -- New customer - return success but no user data
        RETURN json_build_object(
            'success', true,
            'message', 'تم التحقق بنجاح',
            'user', null,
            'existing_user', false
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', 'حدث خطأ أثناء التحقق: ' || SQLERRM
        );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION send_otp(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_otp(text, text) TO anon, authenticated;