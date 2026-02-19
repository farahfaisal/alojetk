import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
}

interface CreateOrderRequest {
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const orderData: CreateOrderRequest = await req.json();

    console.log('📦 Creating order for customer:', orderData.customer_id, 'vendor:', orderData.vendor_id);

    // التحقق من وجود طلب مماثل تم إنشاؤه مؤخراً (خلال آخر 10 ثواني)
    // لتجنب التكرار في حالة الضغط المزدوج
    if (orderData.customer_id) {
      const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
      const { data: recentOrders } = await supabase
        .from('orders')
        .select('id, created_at, total')
        .eq('customer_id', orderData.customer_id)
        .eq('vendor_id', orderData.vendor_id)
        .eq('total', orderData.total)
        .gte('created_at', tenSecondsAgo)
        .order('created_at', { ascending: false })
        .limit(1);

      if (recentOrders && recentOrders.length > 0) {
        console.warn('⚠️ Duplicate order detected within 10 seconds, returning existing order');
        return new Response(
          JSON.stringify({ success: true, order: recentOrders[0] }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // إنشاء الطلب باستخدام service role (يتجاوز RLS)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: orderData.customer_id || null,
        vendor_id: orderData.vendor_id,
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone,
        address: orderData.address,
        city: orderData.city,
        subtotal: orderData.subtotal,
        delivery_fee: orderData.delivery_fee,
        total: orderData.total,
        payment_method: orderData.payment_method,
        notes: orderData.notes || null,
        geocoded_latitude: orderData.geocoded_latitude || null,
        geocoded_longitude: orderData.geocoded_longitude || null,
        scheduled_delivery_time: orderData.scheduled_delivery_time || null,
        delivery_method: orderData.delivery_method || 'delivery',
        is_multi_vendor: orderData.is_multi_vendor || false,
        order_group_id: orderData.order_group_id || null,
        total_vendors: orderData.total_vendors || 1,
        vendor_order_index: orderData.vendor_order_index || 1,
        points_discount: orderData.points_discount || 0,
        coupon_discount: orderData.coupon_discount || 0,
        service_area_id: orderData.service_area_id || null,
        vendor_name: orderData.vendor_name || '',
        status: 'pending',
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      throw orderError;
    }

    // إدراج عناصر الطلب
    const regularItems = [];
    const customItems = [];

    for (const item of orderData.items) {
      const addonsTotal = item.addons?.reduce((s, a) => s + a.price * a.quantity, 0) || 0;
      const itemPriceWithAddons = item.price + addonsTotal;

      if (item.is_custom) {
        customItems.push({
          order_id: order.id,
          vendor_id: item.vendor_id,
          custom_product_name: item.name || 'طلب خاص',
          description: item.custom_details || '',
          quantity: item.quantity || 1,
          price: item.price,
          total_price: itemPriceWithAddons * (item.quantity || 1),
          notes: item.custom_details || null,
        });
      } else {
        const isValidUUID = item.variant_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.variant_id);

        regularItems.push({
          order_id: order.id,
          product_id: item.product_id || null,
          quantity: item.quantity || 1,
          price: itemPriceWithAddons,
          vendor_id: item.vendor_id,
          vendor_name: item.vendor_name,
          name: item.name || 'منتج',
          product_name: item.name || 'منتج',
          notes: null,
          addons_data: item.addons || [],
          variant_id: isValidUUID ? item.variant_id : null,
          variant_name: item.variant_name || null,
        });
      }
    }

    // إدراج العناصر العادية
    if (regularItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(regularItems);

      if (itemsError) {
        console.error('Error inserting order items:', itemsError);
        throw itemsError;
      }
    }

    // إدراج العناصر المخصصة
    if (customItems.length > 0) {
      const { error: customItemsError } = await supabase
        .from('custom_order_items')
        .insert(customItems);

      if (customItemsError) {
        console.error('Error inserting custom order items:', customItemsError);
        throw customItemsError;
      }
    }

    return new Response(
      JSON.stringify({ success: true, order }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in create-order function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An error occurred while creating the order'
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
