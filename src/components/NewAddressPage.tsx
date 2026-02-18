import React from 'react';
import { X } from 'lucide-react';
import AddressForm from './AddressForm';
import { SavedAddress, getSavedAddresses } from '../lib/storage';

interface NewAddressPageProps {
  onClose: () => void;
  onSave: (address: SavedAddress) => void;
  initialAddress?: SavedAddress;
}

const NewAddressPage: React.FC<NewAddressPageProps> = ({ 
  onClose, 
  onSave,
  initialAddress
}) => {
  const handleSave = (address: SavedAddress) => {
    onSave(address);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-gray-50 z-[9999999] flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto p-4">
          <AddressForm
            onSave={handleSave}
            onCancel={onClose}
            initialAddress={initialAddress}
            isModal={true}
          />
        </div>
      </div>
    </div>
  );
};

export default NewAddressPage;