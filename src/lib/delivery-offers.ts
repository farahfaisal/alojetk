import { supabase } from './supabase';

export interface DeliveryOffer {
  id: string;
  title: string;
  description?: string;
  discount_type: 'percentage' | 'fixed' | 'free';
  discount_value: number;
  min_order_amount: number;
  max_discount?: number;
  vendor_id?: string;
  category_id?: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'inactive' | 'expired';
  usage_limit?: number;
  used_count: number;
  image_url?: string;
  background_color: string;
  text_color: string;
  created_at: string;
  updated_at: string;
  vendors?: {
    id: string;
    store_name: string;
    logo_url?: string;
  };
}

// جلب العروض النشطة
export async function getActiveDeliveryOffers(): Promise<DeliveryOffer[]> {
  try {
    const { data, error } = await supabase
      .from('delivery_offers')
      .select(`
        *,
        vendors (
          id,
          store_name,
          logo_url
        )
      `)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString().split('T')[0])
      .lte('start_date', new Date().toISOString().split('T')[0])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching delivery offers:', error);
    return [];
  }
}

// جلب عروض متجر معين
export async function getVendorDeliveryOffers(vendorId: string): Promise<DeliveryOffer[]> {
  try {
    const { data, error } = await supabase
      .from('delivery_offers')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString().split('T')[0])
      .lte('start_date', new Date().toISOString().split('T')[0])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching vendor delivery offers:', error);
    return [];
  }
}

// جلب عروض تصنيف معين
export async function getCategoryDeliveryOffers(categoryId: string): Promise<DeliveryOffer[]> {
  try {
    const { data, error } = await supabase
      .from('delivery_offers')
      .select('*')
      .eq('category_id', categoryId)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString().split('T')[0])
      .lte('start_date', new Date().toISOString().split('T')[0])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching category delivery offers:', error);
    return [];
  }
}

// حساب خصم التوصيل
export function calculateDeliveryDiscount(
  offer: DeliveryOffer,
  orderTotal: number,
  originalDeliveryFee: number
): number {
  // التحقق من الحد الأدنى للطلب
  if (orderTotal < offer.min_order_amount) {
    return 0;
  }

  switch (offer.discount_type) {
    case 'free':
      return originalDeliveryFee; // خصم كامل

    case 'percentage':
      const percentageDiscount = (originalDeliveryFee * offer.discount_value) / 100;
      return offer.max_discount 
        ? Math.min(percentageDiscount, offer.max_discount)
        : percentageDiscount;

    case 'fixed':
      return Math.min(offer.discount_value, originalDeliveryFee);

    default:
      return 0;
  }
}

// التحقق من صلاحية العرض
export function isOfferValid(offer: DeliveryOffer): boolean {
  const today = new Date().toISOString().split('T')[0];
  
  return (
    offer.status === 'active' &&
    offer.start_date <= today &&
    offer.end_date >= today &&
    (!offer.usage_limit || offer.used_count < offer.usage_limit)
  );
}

// تطبيق العرض على الطلب
export async function applyDeliveryOffer(
  offerId: string,
  orderId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // تحديث عدد الاستخدام
    const { error } = await supabase
      .from('delivery_offers')
      .update({ 
        used_count: supabase.sql`used_count + 1`,
        updated_at: new Date().toISOString()
      })
      .eq('id', offerId);

    if (error) throw error;

    return {
      success: true,
      message: 'تم تطبيق عرض التوصيل بنجاح'
    };
  } catch (error) {
    console.error('Error applying delivery offer:', error);
    return {
      success: false,
      message: 'فشل في تطبيق عرض التوصيل'
    };
  }
}

// تنسيق نص العرض للعرض
export function formatOfferText(offer: DeliveryOffer): string {
  switch (offer.discount_type) {
    case 'free':
      return `توصيل مجاني للطلبات أكثر من ${offer.min_order_amount} شيكل`;
    
    case 'percentage':
      return `خصم ${offer.discount_value}% على التوصيل${offer.min_order_amount > 0 ? ` للطلبات أكثر من ${offer.min_order_amount} شيكل` : ''}`;
    
    case 'fixed':
      return `توصيل بـ ${offer.discount_value} شيكل فقط${offer.min_order_amount > 0 ? ` للطلبات أكثر من ${offer.min_order_amount} شيكل` : ''}`;
    
    default:
      return offer.title;
  }
}