import React from 'react';
import { Home, User, Store, ShoppingCart, Package } from 'lucide-react';

interface BottomNavProps {
  onOpenCart: () => void;
  onOpenAccount: () => void;
  onOpenOrders: () => void;
  viewMode: 'restaurants' | 'supermarket' | 'all';
  onViewModeChange: (mode: 'restaurants' | 'supermarket' | 'all') => void;
  cartItemsCount?: number;
  isHidden?: boolean;
  onOpenMenu?: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({
  onOpenCart,
  onOpenAccount,
  onOpenOrders,
  viewMode,
  onViewModeChange,
  cartItemsCount = 0,
  isHidden = false
}) => {
  // Show parcel and orders only in restaurants view
  const showParcelAndOrders = viewMode === 'restaurants';

  if (isHidden) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 w-full shadow-lg"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom), 6px)',
        paddingTop: '6px',
        minHeight: 'calc(56px + max(env(safe-area-inset-bottom), 6px))',
      }}
    >
      <div className="w-full">
        <div className="flex items-center justify-around px-2">
          {/* زر الطلبات - يظهر فقط في صفحة المطاعم */}
          {showParcelAndOrders && (
            <button
              onClick={onOpenOrders}
              className="flex flex-col items-center gap-1.5 py-1 transition-all duration-200"
            >
              <div className={`w-6 h-6 flex items-center justify-center transition-colors duration-200 ${
                false ? 'text-brand' : 'text-gray-400'
              }`}>
                <Package className="w-6 h-6 stroke-[1.5]" />
              </div>
              <span className={`text-[11px] font-medium transition-colors duration-200 ${
                false ? 'text-brand' : 'text-gray-500'
              }`}>
                طلباتي
              </span>
            </button>
          )}

          {/* زر حسابي */}
          <button
            onClick={onOpenAccount}
            className="flex flex-col items-center gap-1.5 py-1 transition-all duration-200"
          >
            <div className="w-6 h-6 flex items-center justify-center text-gray-400 transition-colors duration-200">
              <User className="w-6 h-6 stroke-[1.5]" />
            </div>
            <span className="text-[11px] font-medium text-gray-500 transition-colors duration-200">
              حسابي
            </span>
          </button>

          {/* زر السلة */}
          <button
            onClick={onOpenCart}
            className="flex flex-col items-center gap-1.5 py-1 transition-all duration-200 relative"
          >
            <div className="w-6 h-6 flex items-center justify-center text-gray-400 transition-colors duration-200 relative">
              <ShoppingCart className="w-6 h-6 stroke-[1.5]" />
              {cartItemsCount > 0 && (
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-600 text-white rounded-full flex items-center justify-center text-[9px] font-bold">
                  {cartItemsCount > 9 ? '9+' : cartItemsCount}
                </div>
              )}
            </div>
            <span className="text-[11px] font-medium text-gray-500 transition-colors duration-200">
              السلة
            </span>
          </button>

          {/* زر السوبر ماركت */}
          <button
            onClick={() => onViewModeChange('supermarket')}
            className="flex flex-col items-center gap-1.5 py-1 transition-all duration-200"
          >
            <div className={`w-6 h-6 flex items-center justify-center transition-colors duration-200 ${
              viewMode === 'supermarket' ? 'text-brand' : 'text-gray-400'
            }`}>
              <Store className="w-6 h-6 stroke-[1.5]" />
            </div>
            <span className={`text-[11px] font-medium transition-colors duration-200 ${
              viewMode === 'supermarket' ? 'text-brand' : 'text-gray-500'
            }`}>
              ماركت
            </span>
          </button>

          {/* زر المطاعم */}
          <button
            onClick={() => onViewModeChange('restaurants')}
            className="flex flex-col items-center gap-1.5 py-1 transition-all duration-200 relative"
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                viewMode === 'restaurants'
                  ? 'bg-brand text-white shadow-lg'
                  : 'text-gray-400'
              }`}
            >
              <Home className={`stroke-[1.5] ${viewMode === 'restaurants' ? 'w-5 h-5' : 'w-6 h-6'}`} />
            </div>
            <span
              className={`text-[11px] font-medium transition-colors duration-200 ${
                viewMode === 'restaurants' ? 'text-brand' : 'text-gray-500'
              }`}
            >
              مطاعم
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
