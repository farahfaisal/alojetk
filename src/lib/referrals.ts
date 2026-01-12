import { supabase } from './supabase';

export interface ReferralStats {
  referral_count: number;
  total_earned: number;
}

export interface ReferralRecord {
  id: string;
  referred_id: string;
  status: string;
  referrer_reward_points: number;
  created_at: string;
  customer_name: string;
}

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  try {
    const { data: customer } = await supabase
      .from('customers')
      .select('referral_count')
      .eq('id', userId)
      .maybeSingle();

    const { data: rewards } = await supabase
      .from('referrals')
      .select('referrer_reward_points')
      .eq('referrer_id', userId)
      .eq('status', 'rewarded');

    const totalEarned = rewards?.reduce((sum, r) => sum + r.referrer_reward_points, 0) || 0;

    return {
      referral_count: customer?.referral_count || 0,
      total_earned: totalEarned
    };
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    return { referral_count: 0, total_earned: 0 };
  }
}

export async function getReferralRecords(userId: string): Promise<ReferralRecord[]> {
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select(`
        id,
        referred_id,
        status,
        referrer_reward_points,
        created_at,
        referred:customers!referrals_referred_id_fkey(name)
      `)
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data?.map((r: any) => ({
      ...r,
      customer_name: r.referred?.name || 'مستخدم جديد'
    })) || [];
  } catch (error) {
    console.error('Error fetching referral records:', error);
    return [];
  }
}

export async function findReferrerByCode(referralCode: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id')
      .eq('referral_code', referralCode)
      .maybeSingle();

    if (error || !data) {
      console.error('Error finding referrer:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('Error finding referrer:', error);
    return null;
  }
}

export async function createReferral(
  referrerId: string,
  referredId: string,
  referralCode: string
): Promise<boolean> {
  try {
    const { data: settings } = await supabase
      .from('referral_settings')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    const referrerPoints = settings?.referrer_points || 50;
    const referredPoints = settings?.referred_points || 50;

    const { error } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrerId,
        referred_id: referredId,
        used_referral_code: referralCode,
        status: 'pending',
        referrer_reward_points: referrerPoints,
        referred_reward_points: referredPoints
      });

    if (error) {
      console.error('Error creating referral:', error);
      return false;
    }

    await supabase
      .from('customers')
      .update({ referred_by: referrerId })
      .eq('id', referredId);

    return true;
  } catch (error) {
    console.error('Error creating referral:', error);
    return false;
  }
}

export async function grantReferralRewards(referralId: string): Promise<boolean> {
  try {
    const { data: referral, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('id', referralId)
      .maybeSingle();

    if (error || !referral || referral.status === 'rewarded') {
      return false;
    }

    await supabase.rpc('add_points', {
      p_customer_id: referral.referrer_id,
      p_amount: referral.referrer_reward_points,
      p_description: 'مكافأة إحالة صديق',
      p_transaction_type: 'earned'
    });

    await supabase.rpc('add_points', {
      p_customer_id: referral.referred_id,
      p_amount: referral.referred_reward_points,
      p_description: 'مكافأة التسجيل عبر رابط إحالة',
      p_transaction_type: 'earned'
    });

    await supabase
      .from('referrals')
      .update({
        status: 'rewarded',
        rewarded_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      .eq('id', referralId);

    await supabase.rpc('increment', {
      row_id: referral.referrer_id,
      table_name: 'customers',
      column_name: 'referral_count',
      x: 1
    });

    return true;
  } catch (error) {
    console.error('Error granting referral rewards:', error);
    return false;
  }
}