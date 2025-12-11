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
export function getSavedAddresses(): SavedAddress[] {
  try {
    const addresses = localStorage.getItem('saved_addresses');
    return addresses ? JSON.parse(addresses) : [];
  } catch (error) {
    console.error('Error retrieving saved addresses:', error);
    return [];
  }
}

// Save a new address
export function saveAddress(address: Omit<SavedAddress, 'id'>): SavedAddress {
  try {
    const addresses = getSavedAddresses();
    
    // Generate a unique ID
    const newAddress: SavedAddress = {
      ...address,
      id: `addr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    };
    
    // If this is the first address or marked as default, make it the default
    if (addresses.length === 0 || newAddress.isDefault) {
      // Set all other addresses to non-default
      addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }
    
    // Add the new address
    addresses.push(newAddress);
    
    // Save to localStorage
    localStorage.setItem('saved_addresses', JSON.stringify(addresses));
    
    return newAddress;
  } catch (error) {
    console.error('Error saving address:', error);
    throw new Error('فشل حفظ العنوان');
  }
}

// Update an existing address
export function updateAddress(address: SavedAddress): SavedAddress {
  try {
    console.log("🟡 Starting updateAddress with ID:", address.id);
    const addresses = getSavedAddresses();
    const index = addresses.findIndex(addr => addr.id === address.id);
    
    if (index === -1) {
      console.error("Address not found with ID:", address.id);
      throw new Error('العنوان غير موجود. الرجاء المحاولة مرة أخرى أو إنشاء عنوان جديد.');
    }
    
    // If setting this address as default, update other addresses
    if (address.isDefault) {
      addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }
    
    // Update the address
    addresses[index] = address;
    console.log("🟡 Address updated successfully at index:", index);
    
    // Save to localStorage
    localStorage.setItem('saved_addresses', JSON.stringify(addresses));
    
    return address;
  } catch (error) {
    console.error('Error updating address:', error);
    throw new Error(`فشل تحديث العنوان: ${error instanceof Error ? error.message : 'خطأ غير معروف'} (ID: ${address.id})`);
  }
}

// Delete an address
export function deleteAddress(addressId: string): boolean {
  try {
    const addresses = getSavedAddresses();
    const filteredAddresses = addresses.filter(addr => addr.id !== addressId);
    
    if (filteredAddresses.length === addresses.length) {
      return false; // No address was deleted
    }
    
    // If we deleted the default address and there are other addresses, make the first one default
    const wasDefault = addresses.find(addr => addr.id === addressId)?.isDefault;
    if (wasDefault && filteredAddresses.length > 0) {
      filteredAddresses[0].isDefault = true;
    }
    
    // Save to localStorage
    localStorage.setItem('saved_addresses', JSON.stringify(filteredAddresses));
    
    return true;
  } catch (error) {
    console.error('Error deleting address:', error);
    return false;
  }
}

// Get the default address
export function getDefaultAddress(): SavedAddress | null {
  try {
    const addresses = getSavedAddresses();
    return addresses.find(addr => addr.isDefault) || (addresses.length > 0 ? addresses[0] : null);
  } catch (error) {
    console.error('Error getting default address:', error);
    return null;
  }
}

// Set an address as default
export function setDefaultAddress(addressId: string): boolean {
  try {
    const addresses = getSavedAddresses();
    const index = addresses.findIndex(addr => addr.id === addressId);
    
    if (index === -1) {
      return false;
    }
    
    // Set all addresses to non-default
    addresses.forEach(addr => {
      addr.isDefault = false;
    });
    
    // Set the selected address as default
    addresses[index].isDefault = true;
    
    // Save to localStorage
    localStorage.setItem('saved_addresses', JSON.stringify(addresses));
    
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