import React from 'react';
import { X } from 'lucide-react';
import AddressForm from './AddressForm';
import { SavedAddress, getSavedAddresses } from '../lib/storage';

interface NewAddressPageProps {
  onClose: () => void;
  onSave: (address: SavedAddress) => void;
  initialAddress?: SavedAddress;
  preselectedCity?: string;
}

const NewAddressPage: React.FC<NewAddressPageProps> = ({
  onClose,
  onSave,
  initialAddress,
  preselectedCity
}) => {
  const handleSave = (address: SavedAddress) => {
    onSave(address);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-gray-50 flex flex-col"
      style={{ zIndex: 99999 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto p-4">
          <AddressForm
            onSave={handleSave}
            onCancel={onClose}
            initialAddress={initialAddress}
            isModal={true}
            preselectedCity={preselectedCity}
          />
        </div>
      </div>
    </div>
  );
};

export default NewAddressPage;