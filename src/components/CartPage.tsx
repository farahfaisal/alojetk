import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, X, MapPin, CreditCard, Wallet, DollarSign, Clock, Truck, AlertCircle, Check, ChevronLeft, Store, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { calculateDistance, calculateDeliveryFee } from '../lib/delivery';
import { getCustomerWalletBalance, checkWalletBalance } from '../lib/wallet';
import AddressSelector from './AddressSelector';
import AddressForm from './AddressForm';
import { SavedAddress, getSavedAddresses } from '../lib/storage';
import CheckoutPage from './CheckoutPage';

interface CartItem {
  id: string;
  product_id: string | null;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
  vendor_id: string;
  vendor_name: string;
  addons?: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  variant_id?: string;
  variant_name?: string;
  preparation_time?: number;
  is_custom?: boolean;
  custom_details?: string;
}

interface CartPageProps {
  onClose: () => void;
  selectedCity?: string;
}

const CartPage: React.FC<CartPageProps> = ({ onClose, selectedCity }) => {
  const { user, isAuthenticated } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState(7);
  const [totalDeliveryFee, setTotalDeliveryFee] = useState(7);
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [showAddressSelector, setShowAddressSelector] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet'>('cash');
  const [walletBalance, setWalletBalance] = useState(0);
  const [notes, setNotes] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [vendorInfo, setVendorInfo] = useState<any>(null);
  const [vendorsInfo, setVendorsInfo] = useState<{[vendorId: string]: any}>({});
  const [estimatedTime, setEstimatedTime] = useState('30-45');

  // Calculate multi-vendor delivery fee
  useEffect(() => {
    const calculateMultiVendorDeliveryFee = async () => {
      const vendorCount = new Set(cartItems.map(item => item.vendor_id)).size;

      if (vendorCount <= 1) {
        setTotalDeliveryFee(deliveryFee);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('calculate_multi_vendor_delivery_fee', {
          base_delivery_fee: deliveryFee,
          vendor_count: vendorCount
        });

        if (error) throw error;
        setTotalDeliveryFee(data || deliveryFee);
      } catch (error) {
        console.error('Error calculating multi-vendor delivery fee:', error);
        // Fallback to base fee + 5 per additional vendor
        setTotalDeliveryFee(deliveryFee + ((vendorCount - 1) * 5));
      }
    };

    if (cartItems.length > 0) {
      calculateMultiVendorDeliveryFee();
    }
  }, [cartItems, deliveryFee]);

  // Load cart items from localStorage
  useEffect(() => {
    const loadCartItems = () => {
      try {
        const storedItems = localStorage.getItem('cartItems');
        if (storedItems) {
          const parsedItems = JSON.parse(storedItems);
          const itemsArray = Object.values(parsedItems) as CartItem[];
          setCartItems(itemsArray);

          // Load vendor info if items exist
          if (itemsArray.length > 0) {
            loadVendorInfo(itemsArray[0].vendor_id);
            // Load all vendors info
            loadAllVendorsInfo(itemsArray);
          }
        }
      } catch (error) {
        console.error('Error loading cart items:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCartItems();

    // Listen for storage changes
    window.addEventListener('storage', loadCartItems);
    return () => window.removeEventListener('storage', loadCartItems);
  }, []);

  // Load vendor information
  const loadVendorInfo = async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .single();

      if (error) throw error;
      setVendorInfo(data);

      // Set preparation time from vendor data
      if (data?.preparation_time) {
        const prepTime = data.preparation_time;
        setEstimatedTime(`${prepTime}-${prepTime + 15}`);
      }
    } catch (error) {
      console.error('Error loading vendor info:', error);
    }
  };

  // Load all vendors information
  const loadAllVendorsInfo = async (items: CartItem[]) => {
    try {
      const vendorIds = [...new Set(items.map(item => item.vendor_id))];

      const { data, error } = await supabase
        .from('vendors')
        .select('id, store_name, logo_url')
        .in('id', vendorIds);

      if (error) throw error;

      const vendorsMap: {[vendorId: string]: any} = {};
      data?.forEach(vendor => {
        vendorsMap[vendor.id] = vendor;
      });

      setVendorsInfo(vendorsMap);
    } catch (error) {
      console.error('Error loading vendors info:', error);
    }
  };

  // Load user's wallet balance
  useEffect(() => {
    const loadWalletBalance = async () => {
      const customerId = user?.customer_id || user?.id;
      if (customerId) {
        try {
          const balance = await getCustomerWalletBalance(customerId);
          setWalletBalance(balance);
        } catch (error) {
          console.error('Error loading wallet balance:', error);
        }
      }
    };

    if (isAuthenticated) {
      loadWalletBalance();
    }
  }, [user, isAuthenticated]);

  // Load default address
  useEffect(() => {
    const addresses = getSavedAddresses();
    const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0];
    if (defaultAddress) {
      setSelectedAddress(defaultAddress);
    }
  }, []);

  // Calculate delivery fee based on distance and service area
  useEffect(() => {
    const calculateDelivery = async () => {
      if (!vendorInfo) return;

      try {
        let fee = 7;
        let deliveryTime = 15;
        const prepTime = vendorInfo.preparation_time || 30;

        const selectedServiceArea = localStorage.getItem('selectedServiceArea');
        const selectedCity = localStorage.getItem('selectedCity');
        const areaName = selectedServiceArea || (selectedCity ? JSON.parse(selectedCity) : null);

        if (areaName) {
          const { data: serviceArea } = await supabase
            .from('service_areas')
            .select('id, delivery_price')
            .eq('name', areaName)
            .maybeSingle();

          if (serviceArea) {
            const { data: vendorServiceArea } = await supabase
              .from('vendor_service_areas')
              .select('custom_delivery_price')
              .eq('vendor_id', vendorInfo.id)
              .eq('service_area_id', serviceArea.id)
              .maybeSingle();

            if (vendorServiceArea?.custom_delivery_price) {
              fee = vendorServiceArea.custom_delivery_price;
            } else if (serviceArea.delivery_price) {
              fee = serviceArea.delivery_price;
            }
          }
        }

        if (selectedAddress) {
          const userLocation = selectedAddress.coordinates || { lat: 32.4594, lng: 35.2956 };
          const vendorLocation = {
            lat: vendorInfo.latitude || 32.4594,
            lng: vendorInfo.longitude || 35.2956
          };

          const distance = calculateDistance(userLocation, vendorLocation);
          deliveryTime = Math.ceil(distance * 3);

          if (vendorInfo.delivery_type === 'distance' && vendorInfo.price_per_km) {
            fee = Math.max(fee, Math.ceil(distance * vendorInfo.price_per_km));
          } else if (vendorInfo.delivery_fee_per_km) {
            fee = Math.max(fee, vendorInfo.delivery_fee_per_km);
          }
        }

        const totalMinTime = prepTime + deliveryTime;
        const totalMaxTime = totalMinTime + 15;

        setDeliveryFee(fee);
        setEstimatedTime(`${totalMinTime}-${totalMaxTime}`);
      } catch (error) {
        console.error('Error calculating delivery:', error);
        setDeliveryFee(7);
      }
    };

    calculateDelivery();
  }, [selectedAddress, vendorInfo]);

  const updateCartItem = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeCartItem(itemId);
      return;
    }

    try {
      const storedItems = localStorage.getItem('cartItems');
      if (storedItems) {
        const parsedItems = JSON.parse(storedItems);
        if (parsedItems[itemId]) {
          parsedItems[itemId].quantity = quantity;
          localStorage.setItem('cartItems', JSON.stringify(parsedItems));

          // Update local state
          const itemsArray = Object.values(parsedItems) as CartItem[];
          setCartItems(itemsArray);

          // Dispatch storage event
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new CustomEvent('cartUpdated'));
        }
      }
    } catch (error) {
      console.error('Error updating cart item:', error);
    }
  };

  const removeCartItem = (itemId: string) => {
    try {
      const storedItems = localStorage.getItem('cartItems');
      if (storedItems) {
        const parsedItems = JSON.parse(storedItems);
        delete parsedItems[itemId];

        // If cart is empty after deletion, remove the key entirely
        if (Object.keys(parsedItems).length === 0) {
          localStorage.removeItem('cartItems');
        } else {
          localStorage.setItem('cartItems', JSON.stringify(parsedItems));
        }

        // Update local state
        const itemsArray = Object.values(parsedItems) as CartItem[];
        setCartItems(itemsArray);

        // Dispatch storage event
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('cartUpdated'));
      }
    } catch (error) {
      console.error('Error removing cart item:', error);
    }
  };

  const clearCart = () => {
    localStorage.removeItem('cartItems');
    setCartItems([]);
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('cartUpdated'));
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => {
      const itemPrice = item.price || 0;
      const itemTotal = itemPrice * item.quantity;
      const addonsTotal = (item.addons || []).reduce((sum, addon) => {
        const addonPrice = addon.price || 0;
        const addonQuantity = addon.quantity || 1;
        return sum + (addonPrice * addonQuantity);
      }, 0);

      return total + itemTotal + addonsTotal;
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + totalDeliveryFee;
  };

  const groupItemsByVendor = () => {
    const grouped: { [vendorId: string]: CartItem[] } = {};
    cartItems.forEach(item => {
      if (!grouped[item.vendor_id]) {
        grouped[item.vendor_id] = [];
      }
      grouped[item.vendor_id].push(item);
    });
    return grouped;
  };

  const handleAddressSelect = (address: SavedAddress) => {
    setSelectedAddress(address);
    setShowAddressSelector(false);
  };

  const handleAddressSave = (address: SavedAddress) => {
    setSelectedAddress(address);
    setShowAddressForm(false);
  };

  const handleProceedToCheckout = () => {
    if (!isAuthenticated || !user) {
      // Show login prompt
      window.dispatchEvent(new CustomEvent('show-login-prompt'));
      return;
    }

    if (!selectedAddress) {
      setShowAddressSelector(true);
      return;
    }

    setShowCheckout(true);
  };

  const canPayWithWallet = () => {
    return paymentMethod === 'wallet' && walletBalance >= calculateTotal();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-transparent border-brand rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل السلة...</p>
        </div>
      </div>
    );
  }

  if (showCheckout) {
    return (
      <CheckoutPage
        cartItems={cartItems}
        selectedAddress={selectedAddress}
        paymentMethod={paymentMethod}
        deliveryFee={deliveryFee}
        notes={notes}
        selectedCity={selectedCity}
        onClose={onClose}
        onBack={() => setShowCheckout(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col" style={{
      paddingTop: 'max(env(safe-area-inset-top), 0px)'
    }}>
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto p-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="font-medium">رجوع</span>
          </button>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-brand" />
            سلة التسوق ({cartItems.length})
          </h2>
          {cartItems.length > 0 && (
            <button
              onClick={clearCart}
              className="text-red-700 hover:text-red-800 text-sm"
            >
              إفراغ السلة
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto p-4">
          {cartItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">السلة فارغة</h3>
              <p className="text-gray-500 mb-6">لم تقم بإضافة أي منتجات بعد</p>
              <button
                onClick={onClose}
                className="bg-brand text-white px-6 py-3 rounded-lg hover:bg-brand-light transition-colors"
              >
                ابدأ التسوق
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Cart Items Grouped by Vendor */}
              {Object.entries(groupItemsByVendor()).map(([vendorId, items]) => {
                const vendorName = items[0].vendor_name;
                const vendorData = vendorsInfo[vendorId];
                const vendorLogo = vendorData?.logo_url;

                return (
                  <div key={vendorId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    {/* Vendor Header */}
                    <div className="bg-gray-50 p-4 border-b">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white border border-gray-200">
                          {vendorLogo ? (
                            <img
                              src={vendorLogo}
                              alt={vendorName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Store className="w-5 h-5 text-brand m-2.5" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{vendorName}</h3>
                          <p className="text-xs text-gray-500">{items.length} منتج</p>
                        </div>
                      </div>
                    </div>

                    {/* Vendor Items */}
                    <div className="divide-y">
                      {items.map((item) => (
                        <div key={item.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-8 h-8 text-gray-400 m-4" />
                              )}
                            </div>

                            <div className="flex-1">
                              <div>
                                <h4 className="font-bold text-gray-900">{item.name} {item.quantity}*</h4>
                              </div>
                              {item.variant_name && (
                                <p className="text-sm text-gray-600">النوع: {item.variant_name}</p>
                              )}

                              {/* Custom Order Details */}
                              {item.is_custom && item.custom_details && (
                                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                  <p className="text-xs text-amber-800 font-medium mb-1">تفاصيل الطلب:</p>
                                  <p className="text-xs text-amber-900">{item.custom_details}</p>
                                  <p className="text-xs text-amber-600 mt-1">سعر مبدئي: 0 شيكل (سيحدد المتجر السعر النهائي)</p>
                                </div>
                              )}

                              {/* Quantity and Price */}
                              <div className="mt-2 space-y-1">
                                {!item.is_custom ? (
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-gray-600">الكمية:</span>
                                      <button
                                        onClick={() => updateCartItem(item.id, item.quantity - 1)}
                                        className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </button>
                                      <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                                      <button
                                        onClick={() => updateCartItem(item.id, item.quantity + 1)}
                                        className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <div className="text-brand text-lg font-bold">
                                      {((item.price || 0) * item.quantity).toFixed(2)} ₪
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-amber-700 font-medium">الكمية: 1</span>
                                    <span className="text-amber-600 text-lg font-bold">يحدد لاحقاً</span>
                                  </div>
                                )}

                                {/* Addons */}
                                {item.addons && item.addons.length > 0 && (
                                  <div className="space-y-2 pt-2 border-t border-gray-200">
                                    {item.addons.map((addon) => (
                                      <div key={addon.id}>
                                        <div className="text-xs text-gray-500 mb-0.5">• {addon.name}</div>
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-600">الكمية:</span>
                                            <span className="text-sm font-bold">{addon.quantity}</span>
                                          </div>
                                          <span className="text-gray-900 font-semibold text-sm">+{(addon.price * addon.quantity).toFixed(2)} ₪</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Total with Addons */}
                                {!item.is_custom && item.addons && item.addons.length > 0 && (
                                  <div className="flex items-center justify-between pt-2 border-t-2 border-gray-300">
                                    <span className="text-sm font-bold text-gray-700">المجموع الكلي:</span>
                                    <span className="text-brand text-lg font-bold">
                                      {(((item.price || 0) * item.quantity) + (item.addons?.reduce((sum, addon) => sum + ((addon.price || 0) * addon.quantity), 0) || 0)).toFixed(2)} ₪
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="flex justify-end mt-2">
                                <button
                                  onClick={() => removeCartItem(item.id)}
                                  className="text-red-700 hover:text-red-800 text-sm flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  حذف
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Order Summary */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-3">ملخص الطلب</h3>

                {cartItems.some(item => item.is_custom) && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-800">
                        <p className="font-medium">يحتوي طلبك على منتجات خاصة</p>
                        <p className="text-xs mt-1">سيتم تحديد السعر النهائي من قبل المتجر</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">المجموع الفرعي</span>
                    <span className="font-medium">{calculateSubtotal().toFixed(2)} شيكل</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 flex items-center gap-1">
                      <Truck className="w-4 h-4" />
                      رسوم التوصيل
                      {(() => {
                        const vendorCount = new Set(cartItems.map(item => item.vendor_id)).size;
                        if (vendorCount > 1) {
                          return ` (${vendorCount} متاجر)`;
                        }
                        return '';
                      })()}
                    </span>
                    <span className="font-medium">{totalDeliveryFee.toFixed(2)} شيكل</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-bold text-gray-900">المجموع الكلي</span>
                    <span className="font-bold text-brand text-lg">{calculateTotal().toFixed(2)} شيكل</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>وقت التوصيل المتوقع: {estimatedTime} دقيقة</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Button */}
      {cartItems.length > 0 && (
        <div className="bg-white border-t p-4 sticky bottom-0">
          <div className="max-w-md mx-auto">
            <button
              onClick={handleProceedToCheckout}
              disabled={paymentMethod === 'wallet' && walletBalance < calculateTotal()}
              className="w-full bg-brand text-white py-4 rounded-xl hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bold text-lg"
            >
              <Check className="w-6 h-6" />
              إتمام الطلب • {calculateTotal().toFixed(2)} شيكل
            </button>
            
            {!isAuthenticated && (
              <p className="text-center text-sm text-gray-500 mt-2">
                يجب تسجيل الدخول لإتمام الطلب
              </p>
            )}
          </div>
        </div>
      )}

      {/* Address Selector Modal */}
      {showAddressSelector && (
        <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">اختر عنوان التوصيل</h3>
              <button
                onClick={() => setShowAddressSelector(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4">
              <AddressSelector
                onSelectAddress={handleAddressSelect}
                onAddNewAddress={() => {
                  setShowAddressSelector(false);
                  setShowAddressForm(true);
                }}
                selectedAddressId={selectedAddress?.id}
              />
            </div>
          </div>
        </div>
      )}

      {/* Address Form Modal */}
      {showAddressForm && (
        <AddressForm
          onSave={handleAddressSave}
          onCancel={() => setShowAddressForm(false)}
          isModal={true}
        />
      )}
    </div>
  );
};

export default CartPage;