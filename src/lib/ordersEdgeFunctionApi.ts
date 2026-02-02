import { supabase } from './supabase';

interface OrderItem {
  product_id?: string;
  name: string;
  price: number;
  quantity: number;
  variant_id?: string;
  variant_name?: string;
  addons?: any[];
  vendor_id: string;
  vendor_name: string;
  is_custom?: boolean;
  custom_details?: string;
  preparation_time?: number;
}

interface CreateOrderParams {
  customer_id?: string;
  vendor_id: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  city: string;
  items: OrderItem[];
  delivery_fee: number;
  subtotal: number;
  total: number;
  payment_method: string;
  notes?: string;
  geocoded_latitude?: number;
  geocoded_longitude?: number;
  scheduled_delivery_time?: string;
  delivery_method?: string;
  is_multi_vendor?: boolean;
  order_group_id?: string;
  total_vendors?: number;
  vendor_order_index?: number;
  points_discount?: number;
  coupon_discount?: number;
  service_area_id?: string;
  vendor_name?: string;
}

export async function createOrder(params: CreateOrderParams) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const apiUrl = `${supabaseUrl}/functions/v1/create-order`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create order');
    }

    const data = await response.json();
    return { data: data.order, error: null };
  } catch (error: any) {
    console.error('Error calling create-order edge function:', error);
    return { data: null, error };
  }
}
