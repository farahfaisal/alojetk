/*
  # إصلاح نظام خصم النقاط

  1. تحديث الدوال
    - تحديث دالة `update_points_balance` لمعالجة الخصم بشكل صحيح
    - إضافة دالة `deduct_points_for_order` لخصم النقاط عند إنشاء الطلب
    
  2. المحفزات
    - إضافة محفز لخصم النقاط تلقائياً عند إنشاء طلب يستخدم النقاط
    
  3. التحقق من الرصيد
    - التأكد من كفاية رصيد النقاط قبل الخصم
*/

-- دالة لخصم النقاط عند إنشاء الطلب
CREATE OR REPLACE FUNCTION deduct_points_for_order()
RETURNS TRIGGER AS $$
BEGIN
  -- إذا كان الطلب يستخدم نقاط
  IF NEW.points_applied > 0 THEN
    -- البحث عن حساب النقاط للعميل
    DECLARE
      points_account_id UUID;
      current_balance INTEGER;
    BEGIN
      SELECT id, balance INTO points_account_id, current_balance
      FROM points_accounts
      WHERE customer_id = NEW.customer_id;
      
      -- إذا لم يتم العثور على حساب النقاط، أنشئ واحد
      IF points_account_id IS NULL THEN
        INSERT INTO points_accounts (customer_id, balance, total_earned, total_spent)
        VALUES (NEW.customer_id, 0, 0, 0)
        RETURNING id INTO points_account_id;
        current_balance := 0;
      END IF;
      
      -- تحقق من كفاية الرصيد
      IF current_balance < NEW.points_applied THEN
        RAISE EXCEPTION 'رصيد النقاط غير كافي. الرصيد الحالي: % نقطة', current_balance;
      END IF;
      
      -- إنشاء معاملة خصم النقاط
      INSERT INTO points_transactions (
        account_id,
        order_id,
        amount,
        type,
        description,
        reference_id
      ) VALUES (
        points_account_id,
        NEW.id,
        -NEW.points_applied,
        'spend',
        'استخدام النقاط في الطلب #' || COALESCE(NEW.order_number, NEW.id::text),
        NEW.id
      );
      
      -- تسجيل العملية في السجل
      INSERT INTO system_logs (event_type, message, details)
      VALUES (
        'info',
        'تم خصم النقاط من الطلب',
        jsonb_build_object(
          'order_id', NEW.id,
          'customer_id', NEW.customer_id,
          'points_deducted', NEW.points_applied,
          'previous_balance', current_balance
        )
      );
      
    EXCEPTION
      WHEN OTHERS THEN
        -- تسجيل الخطأ
        INSERT INTO system_logs (event_type, message, details)
        VALUES (
          'error',
          'فشل في خصم النقاط',
          jsonb_build_object(
            'order_id', NEW.id,
            'customer_id', NEW.customer_id,
            'points_to_deduct', NEW.points_applied,
            'error', SQLERRM
          )
        );
        
        -- إعادة رفع الخطأ
        RAISE;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء المحفز لخصم النقاط
DROP TRIGGER IF EXISTS deduct_points_on_order_creation ON orders;
CREATE TRIGGER deduct_points_on_order_creation
  AFTER INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.points_applied > 0)
  EXECUTE FUNCTION deduct_points_for_order();

-- تحديث دالة تحديث رصيد النقاط لمعالجة الخصم بشكل أفضل
CREATE OR REPLACE FUNCTION update_points_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- تحديث رصيد النقاط في حساب النقاط
  UPDATE points_accounts
  SET 
    balance = balance + NEW.amount,
    total_earned = CASE 
      WHEN NEW.amount > 0 THEN total_earned + NEW.amount 
      ELSE total_earned 
    END,
    total_spent = CASE 
      WHEN NEW.amount < 0 THEN total_spent + ABS(NEW.amount) 
      ELSE total_spent 
    END,
    last_activity = NOW()
  WHERE id = NEW.account_id;
  
  -- تسجيل العملية
  INSERT INTO system_logs (event_type, message, details)
  VALUES (
    'info',
    'تم تحديث رصيد النقاط',
    jsonb_build_object(
      'account_id', NEW.account_id,
      'transaction_id', NEW.id,
      'amount', NEW.amount,
      'type', NEW.type,
      'description', NEW.description
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- التأكد من وجود المحفز لتحديث رصيد النقاط
DROP TRIGGER IF EXISTS update_points_balance_trigger ON points_transactions;
CREATE TRIGGER update_points_balance_trigger
  AFTER INSERT ON points_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_points_balance();

-- دالة للتحقق من رصيد النقاط
CREATE OR REPLACE FUNCTION check_points_balance(customer_id_param UUID, points_needed INTEGER)
RETURNS JSONB AS $$
DECLARE
  account_balance INTEGER := 0;
  account_id_var UUID;
BEGIN
  -- البحث عن حساب النقاط
  SELECT id, balance INTO account_id_var, account_balance
  FROM points_accounts
  WHERE customer_id = customer_id_param;
  
  -- إذا لم يتم العثور على حساب، أنشئ واحد
  IF account_id_var IS NULL THEN
    INSERT INTO points_accounts (customer_id, balance, total_earned, total_spent)
    VALUES (customer_id_param, 0, 0, 0)
    RETURNING id INTO account_id_var;
    account_balance := 0;
  END IF;
  
  RETURN jsonb_build_object(
    'account_id', account_id_var,
    'current_balance', account_balance,
    'sufficient', account_balance >= points_needed,
    'shortage', GREATEST(0, points_needed - account_balance)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- منح الأذونات للدالة الجديدة
GRANT EXECUTE ON FUNCTION check_points_balance(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION check_points_balance(UUID, INTEGER) TO anon;