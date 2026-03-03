import { supabase } from './supabase';
import { showPaymentNotification, arePaymentNotificationsEnabled } from './firebase';

export interface CustomerWallet {
  id: string;
  customer_id: string;
  balance: number;
  total_deposits: number;
  total_withdrawals: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  order_id?: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'payment' | 'refund' | 'bonus' | 'penalty';
  payment_type: 'cash' | 'electronic' | 'bank_transfer' | 'credit_card' | 'admin_adjustment';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description: string;
  reference_id?: string;
  metadata?: any;
  created_at: string;
}

// الحصول على محفظة العميل
export async function getCustomerWallet(customerId: string): Promise<CustomerWallet | null> {
  try {
    if (!customerId || customerId.trim() === '') {
      console.warn('Invalid customer ID provided to getCustomerWallet');
      return null;
    }

    const { data, error } = await supabase
      .from('customer_wallets')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching customer wallet:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching customer wallet:', error);
    return null;
  }
}

// الحصول على معاملات محفظة العميل
export async function getCustomerWalletTransactions(
  customerId: string,
  limit: number = 50
): Promise<WalletTransaction[]> {
  try {
    if (!customerId || customerId.trim() === '') {
      console.warn('Invalid customer ID provided to getCustomerWalletTransactions');
      return [];
    }

    console.log('💳 جلب معاملات المحفظة للعميل:', customerId);

    // أولاً، احصل على محفظة العميل
    const { data: wallet, error: walletError } = await supabase
      .from('customer_wallets')
      .select('id')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (walletError) {
      console.error('Error fetching customer wallet:', walletError);
      throw walletError;
    }

    if (!wallet) {
      console.log('⚠️ لا توجد محفظة للعميل');
      return [];
    }

    console.log('💳 معرف المحفظة:', wallet.id);

    // ثم احصل على المعاملات
    const { data, error } = await supabase
      .from('customer_wallet_transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching wallet transactions:', error);
      throw error;
    }

    console.log('💳 عدد المعاملات:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    return [];
  }
}

// إضافة أموال إلى محفظة العميل
export async function addMoneyToWallet(
  customerId: string,
  amount: number,
  description: string,
  paymentType: string = 'electronic',
  referenceId?: string
): Promise<{ success: boolean; message: string; transactionId?: string }> {
  try {
    // أولاً، تأكد من وجود محفظة للعميل
    const wallet = await ensureCustomerWallet(customerId);
    if (!wallet) {
      // Show payment failure notification
      if (arePaymentNotificationsEnabled()) {
        showPaymentNotification('failed', amount, orderId);
      }
      
      return {
        success: false,
        message: 'فشل في إنشاء محفظة العميل'
      };
    }

    // إنشاء معاملة إيداع بحالة معلقة
    const { data: transaction, error } = await supabase
      .from('customer_wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        amount: amount,
        type: 'deposit',
        payment_type: paymentType,
        status: 'pending', // حالة معلقة حتى موافقة المدير
        description: description,
        reference_id: referenceId,
        metadata: {
          requires_approval: true,
          requested_at: new Date().toISOString()
        }
      })
      .select()
      .single();
    
    if (error) {
      console.error('RPC error:', error);
      throw error;
    }
    
    return {
      success: true,
      message: 'تم إرسال طلب الإيداع بنجاح. سيتم مراجعته من قبل المدير خلال 24-48 ساعة.',
      transactionId: transaction.id
    };
  } catch (error) {
    console.error('Error adding money to wallet:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'حدث خطأ أثناء إضافة المبلغ'
    };
  }
}

// الدفع من محفظة العميل
export async function payFromWallet(
  customerId: string,
  orderId: string,
  amount: number,
  description: string = 'دفع طلب'
): Promise<{ success: boolean; message: string; remainingBalance?: number }> {
  try {
    const { data, error } = await supabase.rpc('pay_from_customer_wallet', {
      p_customer_id: customerId,
      p_order_id: orderId,
      p_amount: amount,
      p_description: description
    });
    
    if (error) {
      console.error('RPC error:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error paying from wallet:', error);
    
    // Show payment failure notification
    if (arePaymentNotificationsEnabled()) {
      showPaymentNotification('failed', amount, orderId);
    }
    
    return {
      success: false,
      message: error instanceof Error ? error.message : 'حدث خطأ أثناء الدفع من المحفظة'
    };
  }
}

// الحصول على رصيد محفظة العميل
export async function getCustomerWalletBalance(customerId: string): Promise<number> {
  try {
    if (!customerId || customerId.trim() === '') {
      console.warn('Invalid customer ID provided to getCustomerWalletBalance');
      return 0;
    }

    const { data, error } = await supabase.rpc('get_customer_wallet_balance', {
      p_customer_id: customerId
    });
    
    if (error) {
      console.error('Error fetching wallet balance:', error);
      return 0;
    }
    
    return data || 0;
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    return 0;
  }
}

// التحقق من كفاية الرصيد
export async function checkWalletBalance(
  customerId: string,
  requiredAmount: number
): Promise<{ sufficient: boolean; currentBalance: number }> {
  try {
    const currentBalance = await getCustomerWalletBalance(customerId);
    
    return {
      sufficient: currentBalance >= requiredAmount,
      currentBalance
    };
  } catch (error) {
    console.error('Error checking wallet balance:', error);
    return {
      sufficient: false,
      currentBalance: 0
    };
  }
}

// إنشاء محفظة للعميل إذا لم تكن موجودة
export async function ensureCustomerWallet(customerId: string): Promise<CustomerWallet | null> {
  try {
    // محاولة الحصول على المحفظة الموجودة
    let wallet = await getCustomerWallet(customerId);
    
    // إنشاء محفظة جديدة إذا لم تكن موجودة
    if (!wallet) {
      const { data, error } = await supabase
        .from('customer_wallets')
        .insert({ customer_id: customerId })
        .select()
        .single();
        
      if (error) {
        console.error('Error creating customer wallet:', error);
        throw error;
      }
      
      wallet = data;
    }
    
    return wallet;
  } catch (error) {
    console.error('Error ensuring customer wallet:', error);
    return null;
  }
}

// تنسيق نوع المعاملة للعرض
export function formatTransactionType(type: string): string {
  switch (type) {
    case 'deposit':
      return 'إيداع';
    case 'payment':
      return 'دفع';
    case 'refund':
      return 'استرداد';
    case 'bonus':
      return 'مكافأة';
    case 'penalty':
      return 'خصم';
    default:
      return type;
  }
}

// تنسيق طريقة الدفع للعرض
export function formatPaymentType(paymentType: string): string {
  switch (paymentType) {
    case 'cash':
      return 'نقدي';
    case 'electronic':
      return 'إلكتروني';
    case 'bank_transfer':
      return 'تحويل بنكي';
    case 'credit_card':
      return 'بطاقة ائتمان';
    case 'admin_adjustment':
      return 'تعديل إداري';
    case 'wallet':
      return 'محفظة';
    default:
      return paymentType;
  }
}

// تنسيق حالة المعاملة للعرض
export function formatTransactionStatus(status: string): string {
  switch (status) {
    case 'pending':
      return 'قيد الانتظار';
    case 'approved':
      return 'موافق عليها';
    case 'completed':
      return 'مكتملة';
    case 'failed':
      return 'فاشلة';
    case 'cancelled':
      return 'ملغية';
    case 'rejected':
      return 'مرفوضة';
    default:
      return status;
  }
}