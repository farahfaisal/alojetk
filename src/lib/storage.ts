import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';

// Cart storage utilities
export function checkCartVendorConflict(newVendorId: number): { hasConflict: boolean; existingVendorName: string | null } {
  // Multi-vendor carts are now allowed, so always return no conflict
  return { hasConflict: false, existingVendorName: null };
}

export function clearCart(): void {
  localStorage.removeItem('cartItems');
  // Dispatch storage event to update cart count in other components
  window.dispatchEvent(new Event('storage'));
}

// Local storage utilities for managing user data

// Address storage
export interface SavedAddress {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  isDefault: boolean;
  detailedAddress?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  serviceAreaId?: string;
  serviceAreaName?: string;
}

// Database address interface
interface DatabaseAddress {
  id: string;
  customer_id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  is_default: boolean;
  detailed_address?: string;
  latitude?: number;
  longitude?: number;
  service_area_id?: string;
  service_areas?: {
    id: string;
    name: string;
  };
}

// Convert database address to SavedAddress format
function convertDatabaseAddress(dbAddress: DatabaseAddress): SavedAddress {
  return {
    id: dbAddress.id,
    name: dbAddress.name,
    address: dbAddress.address,
    city: dbAddress.city,
    phone: dbAddress.phone,
    isDefault: dbAddress.is_default,
    detailedAddress: dbAddress.detailed_address,
    coordinates: dbAddress.latitude && dbAddress.longitude ? {
      lat: dbAddress.latitude,
      lng: dbAddress.longitude
    } : undefined,
    serviceAreaId: dbAddress.service_area_id,
    serviceAreaName: dbAddress.service_areas?.name
  };
}

// Order interface
export interface OrderSummary {
  id: string;
  date: string;
  total: number;
  status: 'pending' | 'processing' | 'delivered' | 'cancelled';
  items: Array<{
    id: number;
    name: string;
    quantity: number;
    price: number;
  }>;
  vendor: {
    id: number;
    name: string;
  };
  shipping?: {
    address: string;
    city: string;
  };
  payment_method?: string;
}

// Get user profile data
export function getUserProfile() {
  try {
    const userData = localStorage.getItem('auth_user');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

// Update user profile data
export async function updateUserProfile(data: { name?: string; email?: string; phone?: string }) {
  try {
    const userData = getUserProfile();
    if (!userData) return false;
    
    // Update local storage
    const updatedUser = { ...userData, ...data };
    localStorage.setItem('auth_user', JSON.stringify(updatedUser));
    
    // Update in database if customer_id exists
    if (userData.customer_id) {
      const { error } = await supabase
        .from('customers')
        .update({
          name: data.name || userData.name,
          email: data.email || userData.email,
          phone: data.phone || userData.phone
        })
        .eq('id', userData.customer_id);
        
      if (error) throw error;
    }
    
    // Dispatch event to update UI
    window.dispatchEvent(new Event('auth-change'));
    
    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    return false;
  }
}

// Get all saved addresses for the current user
export async function getSavedAddresses(): Promise<SavedAddress[]> {
  try {
    const userData = getUserProfile();
    if (!userData?.customer_id) {
      console.log('No customer_id found, returning empty addresses');
      return [];
    }

    const { data, error } = await supabase
      .from('customer_addresses')
      .select(`
        *,
        service_areas (
          id,
          name
        )
      `)
      .eq('customer_id', userData.customer_id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching addresses:', error);
      return [];
    }

    return data.map(convertDatabaseAddress);
  } catch (error) {
    console.error('Error retrieving saved addresses:', error);
    return [];
  }
}

// Synchronous version for backward compatibility (returns empty array, triggers async fetch)
export function getSavedAddressesSync(): SavedAddress[] {
  console.warn('getSavedAddressesSync is deprecated, use getSavedAddresses() instead');
  return [];
}

// Save a new address
export async function saveAddress(address: Omit<SavedAddress, 'id'>): Promise<SavedAddress> {
  try {
    const userData = getUserProfile();
    if (!userData?.customer_id) {
      throw new Error('يجب تسجيل الدخول لحفظ العنوان');
    }

    const { data, error } = await supabase
      .from('customer_addresses')
      .insert({
        customer_id: userData.customer_id,
        name: address.name,
        address: address.address,
        city: address.city,
        phone: address.phone,
        is_default: address.isDefault,
        detailed_address: address.detailedAddress,
        latitude: address.coordinates?.lat,
        longitude: address.coordinates?.lng,
        service_area_id: address.serviceAreaId || null
      })
      .select(`
        *,
        service_areas (
          id,
          name
        )
      `)
      .single();

    if (error) {
      console.error('Error saving address:', error);
      throw new Error('فشل حفظ العنوان');
    }

    return convertDatabaseAddress(data);
  } catch (error) {
    console.error('Error saving address:', error);
    throw new Error('فشل حفظ العنوان');
  }
}

// Update an existing address
export async function updateAddress(address: SavedAddress): Promise<SavedAddress> {
  try {
    console.log("🟡 Starting updateAddress with ID:", address.id);

    const userData = getUserProfile();
    if (!userData?.customer_id) {
      throw new Error('يجب تسجيل الدخول لتحديث العنوان');
    }

    const { data, error } = await supabase
      .from('customer_addresses')
      .update({
        name: address.name,
        address: address.address,
        city: address.city,
        phone: address.phone,
        is_default: address.isDefault,
        detailed_address: address.detailedAddress,
        latitude: address.coordinates?.lat,
        longitude: address.coordinates?.lng,
        service_area_id: address.serviceAreaId || null
      })
      .eq('id', address.id)
      .eq('customer_id', userData.customer_id)
      .select(`
        *,
        service_areas (
          id,
          name
        )
      `)
      .single();

    if (error) {
      console.error('Error updating address:', error);
      throw new Error('فشل تحديث العنوان');
    }

    if (!data) {
      throw new Error('العنوان غير موجود');
    }

    console.log("🟡 Address updated successfully");
    return convertDatabaseAddress(data);
  } catch (error) {
    console.error('Error updating address:', error);
    throw new Error(`فشل تحديث العنوان: ${error instanceof Error ? error.message : 'خطأ غير معروف'} (ID: ${address.id})`);
  }
}

// Delete an address
export async function deleteAddress(addressId: string): Promise<boolean> {
  try {
    const userData = getUserProfile();
    if (!userData?.customer_id) {
      throw new Error('يجب تسجيل الدخول لحذف العنوان');
    }

    // Check if this is the default address
    const { data: addressToDelete } = await supabase
      .from('customer_addresses')
      .select('is_default')
      .eq('id', addressId)
      .eq('customer_id', userData.customer_id)
      .maybeSingle();

    const { error } = await supabase
      .from('customer_addresses')
      .delete()
      .eq('id', addressId)
      .eq('customer_id', userData.customer_id);

    if (error) {
      console.error('Error deleting address:', error);
      return false;
    }

    // If we deleted the default address, set the first remaining address as default
    if (addressToDelete?.is_default) {
      const { data: remainingAddresses } = await supabase
        .from('customer_addresses')
        .select('id')
        .eq('customer_id', userData.customer_id)
        .limit(1)
        .maybeSingle();

      if (remainingAddresses) {
        await supabase
          .from('customer_addresses')
          .update({ is_default: true })
          .eq('id', remainingAddresses.id);
      }
    }

    return true;
  } catch (error) {
    console.error('Error deleting address:', error);
    return false;
  }
}

// Get the default address
export async function getDefaultAddress(): Promise<SavedAddress | null> {
  try {
    const userData = getUserProfile();
    if (!userData?.customer_id) {
      return null;
    }

    const { data, error } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', userData.customer_id)
      .eq('is_default', true)
      .maybeSingle();

    if (error) {
      console.error('Error getting default address:', error);
      return null;
    }

    if (data) {
      return convertDatabaseAddress(data);
    }

    // If no default address, return the first address
    const { data: firstAddress } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', userData.customer_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return firstAddress ? convertDatabaseAddress(firstAddress) : null;
  } catch (error) {
    console.error('Error getting default address:', error);
    return null;
  }
}

// Set an address as default
export async function setDefaultAddress(addressId: string): Promise<boolean> {
  try {
    const userData = getUserProfile();
    if (!userData?.customer_id) {
      return false;
    }

    // The trigger will automatically set other addresses to non-default
    const { error } = await supabase
      .from('customer_addresses')
      .update({ is_default: true })
      .eq('id', addressId)
      .eq('customer_id', userData.customer_id);

    if (error) {
      console.error('Error setting default address:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error setting default address:', error);
    return false;
  }
}

// Order Management
export async function saveOrderToHistory(order: OrderSummary): Promise<void> {
  try {
    // Create order in database
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: order.id,
        vendor_id: order.vendor.id,
        status: order.status,
        total: order.total,
        subtotal: order.total, // You might want to calculate this differently
        delivery_fee: 0, // Add delivery fee calculation
        payment_method: order.payment_method || 'cash',
        notes: '',
        address: order.shipping?.address,
        latitude: null, // Add coordinates if available
        longitude: null
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Create order items
    const orderItems = order.items.map(item => ({
      order_id: orderData.id,
      product_id: item.id,
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity,
      notes: ''
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

  } catch (error) {
    console.error('Error saving order:', error);
    throw error;
  }
}

export async function getOrderHistory(): Promise<OrderSummary[]> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get all order IDs
    const orderIds = data.map(order => order.id);
    
    // For now, return mock data since we're not creating order_items
    // This avoids the relationship error while still showing orders
    
    return data.map(order => {
      return {
        id: order.id,
        date: order.created_at,
        total: order.total,
        status: order.status,
        items: [], // Empty array since we're not creating order_items
        vendor: {
          id: order.vendor_id,
          name: 'المتجر' // Default name since we're not fetching vendor data
        },
        shipping: order.address ? {
          address: order.address,
          city: 'فلسطين'
        } : undefined,
        payment_method: order.payment_method
      };
    });
  } catch (error) {
    console.error('Error getting orders:', error);
    throw error;
  }
}

// Get order by ID
export async function getOrderById(orderId: string): Promise<OrderSummary | null> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        vendor:vendor_id (
          id,
          store_name
        ),
        items:order_items (
          id,
          quantity,
          price,
          product:product_id (
            name
          )
        )
      `)
      .eq('id', orderId)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      date: data.created_at,
      total: data.total,
      status: data.status,
      items: data.items.map((item: any) => ({
        id: item.product_id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.price
      })),
      vendor: {
        id: data.vendor.id,
        name: data.vendor.store_name
      },
      shipping: data.address ? {
        address: data.address,
        city: ''
      } : undefined,
      payment_method: data.payment_method
    };
  } catch (error) {
    console.error('Error getting order:', error);
    return null;
  }
}

// Update order status
export async function updateOrderStatus(orderId: string, status: OrderSummary['status']): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating order status:', error);
    return false;
  }
}

// Session management
export function saveSessionData(key: string, data: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving session data for key ${key}:`, error);
  }
}

export function getSessionData<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error(`Error retrieving session data for key ${key}:`, error);
    return defaultValue;
  }
}

export function clearSessionData(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error clearing session data for key ${key}:`, error);
  }
}