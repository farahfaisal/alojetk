import { supabase } from './supabase';

/**
 * واجهة حالة الشحن
 */
export interface ShippingStatus {
  status_key: string;
  ar_title: string;
  en_title: string;
  ar_description: string;
  en_description: string;
  order_sequence: number;
  icon_name: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * معلومات الحالة المبسطة
 */
export interface StatusInfo {
  status_key: string;
  ar_title: string;
  en_title: string;
  ar_description: string;
  en_description: string;
  icon_name: string;
  color: string;
  order_sequence: number;
}

/**
 * الحصول على جميع حالات الشحن النشطة
 */
export async function getAllShippingStatuses(): Promise<ShippingStatus[]> {
  const { data, error } = await supabase
    .from('shipping_statuses')
    .select('*')
    .eq('is_active', true)
    .order('order_sequence', { ascending: true });

  if (error) {
    console.error('Error fetching shipping statuses:', error);
    return [];
  }

  return data || [];
}

/**
 * الحصول على معلومات حالة معينة
 */
export async function getStatusInfo(statusKey: string): Promise<StatusInfo | null> {
  const { data, error } = await supabase.rpc('get_status_info', {
    p_status_key: statusKey
  });

  if (error) {
    console.error('Error fetching status info:', error);
    return null;
  }

  return data;
}

/**
 * الحصول على الحالة التالية
 */
export async function getNextStatus(currentStatus: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_next_status', {
    p_current_status: currentStatus
  });

  if (error) {
    console.error('Error fetching next status:', error);
    return null;
  }

  return data;
}

/**
 * map الألوان إلى Tailwind classes
 */
export function getColorClasses(color: string): {
  bg: string;
  text: string;
  border: string;
} {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    gray: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-300'
    },
    green: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-300'
    },
    blue: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-300'
    },
    cyan: {
      bg: 'bg-cyan-100',
      text: 'text-cyan-800',
      border: 'border-cyan-300'
    },
    orange: {
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      border: 'border-orange-300'
    },
    purple: {
      bg: 'bg-purple-100',
      text: 'text-purple-800',
      border: 'border-purple-300'
    },
    red: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-300'
    }
  };

  return colorMap[color] || colorMap.gray;
}

/**
 * الحصول على اسم الأيقونة من lucide-react
 */
export function getIconName(iconName: string): string {
  return iconName || 'Package';
}

/**
 * حالات الشحن الافتراضية (fallback)
 */
export const DEFAULT_STATUSES: Record<string, StatusInfo> = {
  pending: {
    status_key: 'pending',
    ar_title: 'في انتظار الموافقة',
    en_title: 'Pending Approval',
    ar_description: 'الطلب معلق وفي انتظار موافقة المتجر',
    en_description: 'Order is pending store approval',
    order_sequence: 1,
    icon_name: 'Clock',
    color: 'gray'
  },
  accepted: {
    status_key: 'accepted',
    ar_title: 'تم قبول الطلب',
    en_title: 'Order Accepted',
    ar_description: 'المتجر قبل طلبك وسيبدأ التحضير قريباً',
    en_description: 'Store accepted your order and will start preparing soon',
    order_sequence: 2,
    icon_name: 'CheckCircle',
    color: 'green'
  },
  processing: {
    status_key: 'processing',
    ar_title: 'جاري التحضير',
    en_title: 'Processing',
    ar_description: 'المتجر يحضر طلبك الآن',
    en_description: 'Store is preparing your order now',
    order_sequence: 3,
    icon_name: 'Package',
    color: 'blue'
  },
  ready: {
    status_key: 'ready',
    ar_title: 'جاهز للتوصيل',
    en_title: 'Ready for Delivery',
    ar_description: 'طلبك جاهز وفي انتظار السائق',
    en_description: 'Your order is ready and waiting for driver',
    order_sequence: 4,
    icon_name: 'PackageCheck',
    color: 'cyan'
  },
  shipping: {
    status_key: 'shipping',
    ar_title: 'في الطريق',
    en_title: 'On The Way',
    ar_description: 'السائق انطلق وهو قادم إليك',
    en_description: 'Driver has started and is coming to you',
    order_sequence: 5,
    icon_name: 'Truck',
    color: 'orange'
  },
  delivering: {
    status_key: 'delivering',
    ar_title: 'قيد التوصيل',
    en_title: 'Out for Delivery',
    ar_description: 'طلبك في طريقه إليك',
    en_description: 'Your order is on its way to you',
    order_sequence: 6,
    icon_name: 'Navigation',
    color: 'purple'
  },
  completed: {
    status_key: 'completed',
    ar_title: 'تم التوصيل',
    en_title: 'Delivered',
    ar_description: 'تم توصيل طلبك بنجاح',
    en_description: 'Your order has been delivered successfully',
    order_sequence: 7,
    icon_name: 'CheckCircle2',
    color: 'green'
  },
  cancelled: {
    status_key: 'cancelled',
    ar_title: 'ملغي',
    en_title: 'Cancelled',
    ar_description: 'تم إلغاء الطلب',
    en_description: 'Order has been cancelled',
    order_sequence: 99,
    icon_name: 'XCircle',
    color: 'red'
  },
  rejected: {
    status_key: 'rejected',
    ar_title: 'مرفوض',
    en_title: 'Rejected',
    ar_description: 'المتجر رفض الطلب',
    en_description: 'Store rejected the order',
    order_sequence: 98,
    icon_name: 'AlertCircle',
    color: 'red'
  }
};

/**
 * الحصول على معلومات الحالة (مع fallback)
 */
export function getStatusInfoSync(statusKey: string): StatusInfo {
  return DEFAULT_STATUSES[statusKey] || DEFAULT_STATUSES.pending;
}
