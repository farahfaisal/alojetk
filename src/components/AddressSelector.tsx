import React, { useState, useEffect } from 'react';
import { MapPin, Plus, CreditCard as Edit, Trash, Check, Navigation, X, Loader2 } from 'lucide-react';
import { getSavedAddresses, SavedAddress, setDefaultAddress, deleteAddress } from '../lib/storage';

interface AddressSelectorProps {
  onSelectAddress?: (address: SavedAddress) => void;
  onAddNewAddress: () => void;
  selectedAddressId?: string;
}

const AddressSelector: React.FC<AddressSelectorProps> = ({
  onSelectAddress,
  onAddNewAddress,
  selectedAddressId
}) => {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAddresses = async () => {
      setLoading(true);
      const savedAddresses = await getSavedAddresses();
      setAddresses(savedAddresses);

      // If there's a default address and no selected address, select the default
      if (!selectedAddressId && savedAddresses.length > 0) {
        const defaultAddress = savedAddresses.find(addr => addr.isDefault) || savedAddresses[0];
        if (onSelectAddress) {
          onSelectAddress(defaultAddress);
        }
      }
      setLoading(false);
    };
    loadAddresses();
  }, [onSelectAddress, selectedAddressId]);

  const handleSetDefault = async (addressId: string) => {
    const success = await setDefaultAddress(addressId);
    if (success) {
      // Refresh addresses
      const savedAddresses = await getSavedAddresses();
      setAddresses(savedAddresses);

      // Select this address
      const address = addresses.find(addr => addr.id === addressId);
      if (address) {
        if (onSelectAddress) {
          onSelectAddress(address);
        }
      }
    }
  };

  const handleDeleteAddress = async (addressId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (window.confirm('هل أنت متأكد من حذف هذا العنوان؟')) {
      const success = await deleteAddress(addressId);
      if (success) {
        // Refresh addresses
        const updatedAddresses = await getSavedAddresses();
        setAddresses(updatedAddresses);

        // If we deleted the selected address, select the new default
        if (selectedAddressId === addressId && updatedAddresses.length > 0) {
          const newDefault = updatedAddresses.find(addr => addr.isDefault) || updatedAddresses[0];
          onSelectAddress(newDefault);
        }
      }
    }
  };

  const handleSelectAddress = (address: SavedAddress) => {
    if (onSelectAddress) {
      onSelectAddress(address);
    }
  };

  if (loading) {
    return (
      <div className="border border-gray-300 rounded-lg p-3 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-brand animate-spin mr-2" />
        <span className="text-gray-600">جاري تحميل العناوين...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-6 rounded-2xl bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="text-base text-gray-800 font-bold mb-3 flex items-center gap-2">
        <MapPin className="w-5 h-5 text-brand" />
        اختر موقع التوصيل
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {addresses.length > 0 ? (
          addresses.map((address) => (
            <div
              key={address.id}
              className={`p-4 rounded-xl cursor-pointer transition-all ${
                selectedAddressId === address.id
                  ? 'bg-white border-2 border-brand shadow-lg'
                  : 'bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 hover:shadow-md'
              }`}
              onClick={() => handleSelectAddress(address)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-brand flex-shrink-0" />
                    <span className="font-bold text-gray-900">
                      {address.label || `بدون عنوان - ${address.phone}`}
                    </span>
                    {address.isDefault && (
                      <span className="bg-brand text-white text-xs px-2 py-0.5 rounded-full">
                        افتراضي
                      </span>
                    )}
                    {selectedAddressId === address.id && (
                      <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        محدد
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-700 mt-2">{address.address}, {address.city}</div>
                  <div className="text-sm text-gray-600 mt-1">{address.phone}</div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {!address.isDefault && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefault(address.id);
                      }}
                      className="p-2 text-gray-500 hover:text-brand hover:bg-brand/10 rounded-lg transition-colors"
                      title="تعيين كافتراضي"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDeleteAddress(address.id, e)}
                    className="p-2 text-gray-500 hover:text-[#b91c1c] hover:bg-[#b91c1c]/10 rounded-lg transition-colors"
                    title="حذف"
                  >
                    <Trash className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500 bg-white rounded-xl border-2 border-dashed border-gray-300">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="font-medium mb-2">لا توجد عناوين محفوظة</p>
            <p className="text-sm mb-4">أضف عنوان التوصيل الأول</p>
          </div>
        )}
      </div>

      <button
        onClick={onAddNewAddress}
        className="w-full py-3.5 bg-brand text-white rounded-xl hover:bg-brand-dark transition-all flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-xl hover:scale-[1.02]"
      >
        <Plus className="w-5 h-5" />
        إضافة عنوان جديد
      </button>
    </div>
  );
};

export default AddressSelector;