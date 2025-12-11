import { supabase } from './supabase';

export interface PointsAccount {
  id: string;
  customer_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
  last_activity: string;
}

export interface PointsTransaction {
  id: string;
  account_id: string;
  amount: number;
  type: 'earn' | 'spend' | 'expire' | 'adjust';
  description: string;
  reference_id?: string;
  created_at: string;
}

export interface PointsReward {
  id: string;
  name: string;
  description: string;
  points_cost: number;
  reward_type: 'free_delivery' | 'order_discount' | 'delivery_discount' | 'product_discount' | 'gift';
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  min_order_amount?: number;
  max_discount?: number;
  usage_limit?: number;
  used_count?: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'inactive';
}

export interface PointsRedemption {
  id: string;
  account_id: string;
  reward_id: string;
  order_id?: string;
  points_spent: number;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  code: string;
  expires_at: string;
  used_at?: string;
  created_at: string;
}

// Get customer's current points balance
export async function getCustomerPoints(customerId: string): Promise<number> {
  try {
    const account = await getUserPointsAccount(customerId);
    return account?.balance || 0;
  } catch (error) {
    console.error('Error getting customer points:', error);
    return 0;
  }
}

// Get user's points account
export async function getUserPointsAccount(customerId: string): Promise<PointsAccount | null> {
  try {
    // Check if customerId is valid before making the query
    if (!customerId || customerId.trim() === '') {
      console.warn('Invalid customer ID provided to getUserPointsAccount');
      return null;
    }

    // First, ensure the customer has a points account
    let { data, error } = await supabase
      .from('points_accounts')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching points account:', error);
      return null;
    }
    
    // If no points account exists, create one
    if (!data) {
      console.log('Creating new points account for customer:', customerId);
      const { data: newAccount, error: createError } = await supabase
        .from('points_accounts')
        .insert({
          customer_id: customerId,
          balance: 0,
          total_earned: 0,
          total_spent: 0
        })
        .select()
        .single();
        
      if (createError) {
        console.error('Error creating points account:', createError);
        return null;
      }
      
      return newAccount;
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching points account:', error);
    return null;
  }
}

// Get user's points transactions
export async function getUserPointsTransactions(accountId: string): Promise<PointsTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('points_transactions')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching points transactions:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching points transactions:', error);
    return [];
  }
}

// Get available rewards
export async function getAvailableRewards(): Promise<PointsReward[]> {
  try {
    const { data, error } = await supabase
      .from('points_rewards')
      .select('*')
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString().split('T')[0])
      .order('points_cost', { ascending: true });
    
    if (error) {
      console.error('Error fetching available rewards:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching available rewards:', error);
    return [];
  }
}

// Redeem points for a reward
export async function redeemPointsForReward(
  accountId: string, 
  rewardId: string, 
  userId: string
): Promise<{ success: boolean; message: string; redemptionCode?: string }> {
  try {
    console.log('Redeeming reward with params:', { rewardId, userId });
    
    // Call the RPC function with both required parameters
    const { data, error } = await supabase.rpc('redeem_reward', {
      p_reward_id: rewardId,
      p_user_id: userId
    });
    
    if (error) {
      console.error('RPC error:', error);
      throw error;
    }
    
    console.log('Redemption result:', data);
    
    if (data && data.success) {
      return {
        success: true,
        message: 'تم استبدال النقاط بنجاح',
        redemptionCode: data.redemption_code
      };
    } else {
      return {
        success: false,
        message: data?.message || 'فشل في استبدال النقاط'
      };
    }
  } catch (error) {
    console.error('Error redeeming points:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'حدث خطأ أثناء استبدال النقاط'
    };
  }
}

// Get user's redemptions
export async function getUserRedemptions(accountId: string): Promise<PointsRedemption[]> {
  try {
    const { data, error } = await supabase
      .from('points_redemptions')
      .select(`
        *,
        reward:reward_id (
          name,
          description,
          reward_type,
          discount_type,
          discount_value
        )
      `)
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching redemptions:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching redemptions:', error);
    return [];
  }
}

// Get user's referral points
export async function getUserReferralPoints(userId: string): Promise<number> {
  try {
    // First get the customer ID from the user ID
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', userId)
      .single();
      
    if (customerError) {
      console.error('Error fetching customer:', customerError);
      return 0;
    }
    
    if (!customerData) return 0;
    
    // Then get the points account
    const { data: accountData, error: accountError } = await supabase
      .from('points_accounts')
      .select('balance')
      .eq('customer_id', customerData.id)
      .single();
      
    if (accountError) {
      console.error('Error fetching points account:', accountError);
      return 0;
    }
    
    return accountData?.balance || 0;
  } catch (error) {
    console.error('Error fetching referral points:', error);
    return 0;
  }
}

// Get user's referral transactions
export async function getUserReferralTransactions(userId: string): Promise<PointsTransaction[]> {
  try {
    // First get the customer ID from the user ID
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', userId)
      .single();
      
    if (customerError) {
      console.error('Error fetching customer:', customerError);
      return [];
    }
    
    if (!customerData) return [];
    
    // Then get the points account
    const { data: accountData, error: accountError } = await supabase
      .from('points_accounts')
      .select('id')
      .eq('customer_id', customerData.id)
      .single();
      
    if (accountError) {
      console.error('Error fetching points account:', accountError);
      return [];
    }
    
    if (!accountData) return [];
    
    // Then get the transactions
    const { data: transactionsData, error: transactionsError } = await supabase
      .from('points_transactions')
      .select('*')
      .eq('account_id', accountData.id)
      .order('created_at', { ascending: false });
      
    if (transactionsError) {
      console.error('Error fetching points transactions:', transactionsError);
      return [];
    }
    
    return transactionsData || [];
  } catch (error) {
    console.error('Error fetching referral transactions:', error);
    return [];
  }
}

// Get points system settings from app_settings
export async function getPointsSystemSettings() {
  try {
    // First try to get from points_settings table
    const { data: pointsSettings, error: pointsError } = await supabase
      .from('points_settings')
      .select('*')
      .eq('status', 'active')
      .single();
      
    if (!pointsError && pointsSettings) {
      return {
        point_value: pointsSettings.point_value || 1,
        min_points_to_redeem: pointsSettings.min_points_to_redeem || 10,
        max_points_per_order: pointsSettings.max_points_per_order || null,
        points_expiry_days: pointsSettings.points_expiry_days || null,
        earn_rate: pointsSettings.earn_rate || 10,
        referral_points: pointsSettings.referral_points || 100,
        review_points: pointsSettings.review_points || 10,
        signup_bonus: pointsSettings.signup_bonus || 50
      };
    }
    
    // Fallback to app_settings if points_settings doesn't exist
    const { data: appSettings, error: appError } = await supabase
      .from('app_settings')
      .select('settings')
      .single();
      
    if (appError) {
      console.error('Error fetching points settings:', appError);
      return {
        point_value: 1, // Default: 1 point = 1 shekel
        min_points_to_redeem: 10,
        max_points_per_order: null,
        points_expiry_days: null,
        earn_rate: 10,
        referral_points: 100,
        review_points: 10,
        signup_bonus: 50
      };
    }
    
    const pointsSystemSettings = appSettings?.settings?.points_system || {};
    
    return {
      point_value: pointsSystemSettings.point_value || 1,
      min_points_to_redeem: pointsSystemSettings.min_points_to_redeem || 10,
      max_points_per_order: pointsSystemSettings.max_points_per_order || null,
      points_expiry_days: pointsSystemSettings.points_expiry_days || null,
      earn_rate: pointsSystemSettings.earn_rate || 10,
      referral_points: pointsSystemSettings.referral_points || 100,
      review_points: pointsSystemSettings.review_points || 10,
      signup_bonus: pointsSystemSettings.signup_bonus || 50
    };
  } catch (error) {
    console.error('Error fetching points system settings:', error);
    return {
      point_value: 1,
      min_points_to_redeem: 10,
      max_points_per_order: null,
      points_expiry_days: null,
      earn_rate: 10,
      referral_points: 100,
      review_points: 10,
      signup_bonus: 50
    };
  }
}

// Update points settings (admin only)
export async function updatePointsSettings(settings: {
  point_value?: number;
  min_points_to_redeem?: number;
  max_points_per_order?: number;
  points_expiry_days?: number;
  earn_rate?: number;
  referral_points?: number;
  review_points?: number;
  signup_bonus?: number;
}) {
  try {
    const { data, error } = await supabase
      .from('points_settings')
      .update({
        ...settings,
        updated_at: new Date().toISOString()
      })
      .eq('status', 'active')
      .select()
      .single();
      
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating points settings:', error);
    return { success: false, error: error.message };
  }
}

// Calculate points earned for an order
export function calculatePointsEarned(orderTotal: number, earnRate: number = 10): number {
  // earnRate = amount in shekels needed to earn 1 point
  // Example: earnRate = 10 means 1 point per 10 shekels
  return Math.floor(orderTotal / earnRate);
}

// Calculate discount value from points
export function calculatePointsDiscount(points: number, pointValue: number = 1): number {
  return points * pointValue;
}