/*
  # إضافة نظام المكافآت التلقائي للإحالات

  1. الوظائف
    - دالة لمنح مكافآت الإحالة عند أول طلب
    - trigger يتم تفعيله عند إنشاء طلب جديد
    
  2. المنطق
    - عند إنشاء أول طلب للمستخدم المُحال
    - يتم منح المكافآت للمُحيل والمُحال
    - تحديث حالة الإحالة إلى 'rewarded'
    
  3. المكافآت
    - إضافة نقاط للمُحيل
    - إضافة نقاط للمُحال
    - تحديث عداد الإحالات
*/

-- دالة لمنح مكافآت الإحالة عند أول طلب
CREATE OR REPLACE FUNCTION grant_referral_rewards()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  referral_record RECORD;
  order_count INTEGER;
BEGIN
  -- التحقق من أن هذا هو أول طلب للعميل
  SELECT COUNT(*) INTO order_count
  FROM orders
  WHERE customer_id = NEW.customer_id
    AND status != 'cancelled';
  
  -- إذا كان هذا هو أول طلب فقط
  IF order_count = 1 THEN
    -- البحث عن سجل الإحالة المعلق
    SELECT * INTO referral_record
    FROM referrals
    WHERE referred_id = NEW.customer_id
      AND status = 'pending'
    LIMIT 1;
    
    IF FOUND THEN
      -- منح النقاط للمُحيل
      INSERT INTO points_transactions (
        customer_id,
        amount,
        balance_after,
        description,
        transaction_type,
        reference_type,
        reference_id
      )
      SELECT 
        referral_record.referrer_id,
        referral_record.referrer_reward_points,
        COALESCE((
          SELECT balance
          FROM points_accounts
          WHERE customer_id = referral_record.referrer_id
        ), 0) + referral_record.referrer_reward_points,
        'مكافأة إحالة صديق',
        'earned',
        'referral',
        referral_record.id;
      
      -- تحديث رصيد المُحيل
      INSERT INTO points_accounts (customer_id, balance, lifetime_earned)
      VALUES (
        referral_record.referrer_id,
        referral_record.referrer_reward_points,
        referral_record.referrer_reward_points
      )
      ON CONFLICT (customer_id)
      DO UPDATE SET
        balance = points_accounts.balance + referral_record.referrer_reward_points,
        lifetime_earned = points_accounts.lifetime_earned + referral_record.referrer_reward_points,
        updated_at = now();
      
      -- منح النقاط للمُحال
      INSERT INTO points_transactions (
        customer_id,
        amount,
        balance_after,
        description,
        transaction_type,
        reference_type,
        reference_id
      )
      SELECT 
        referral_record.referred_id,
        referral_record.referred_reward_points,
        COALESCE((
          SELECT balance
          FROM points_accounts
          WHERE customer_id = referral_record.referred_id
        ), 0) + referral_record.referred_reward_points,
        'مكافأة التسجيل عبر رابط إحالة',
        'earned',
        'referral',
        referral_record.id;
      
      -- تحديث رصيد المُحال
      INSERT INTO points_accounts (customer_id, balance, lifetime_earned)
      VALUES (
        referral_record.referred_id,
        referral_record.referred_reward_points,
        referral_record.referred_reward_points
      )
      ON CONFLICT (customer_id)
      DO UPDATE SET
        balance = points_accounts.balance + referral_record.referred_reward_points,
        lifetime_earned = points_accounts.lifetime_earned + referral_record.referred_reward_points,
        updated_at = now();
      
      -- تحديث حالة الإحالة
      UPDATE referrals
      SET 
        status = 'rewarded',
        completed_at = now(),
        rewarded_at = now()
      WHERE id = referral_record.id;
      
      -- تحديث عداد الإحالات للمُحيل
      UPDATE customers
      SET referral_count = COALESCE(referral_count, 0) + 1
      WHERE id = referral_record.referrer_id;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء trigger لمنح المكافآت عند إنشاء طلب جديد
DROP TRIGGER IF EXISTS grant_referral_rewards_trigger ON orders;
CREATE TRIGGER grant_referral_rewards_trigger
  AFTER INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.status != 'cancelled')
  EXECUTE FUNCTION grant_referral_rewards();