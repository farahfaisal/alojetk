import React from 'react';
import { Home, User, Store, ShoppingCart, Package } from 'lucide-react';

interface BottomNavProps {
  onOpenCart: () => void;
  onOpenAccount: () => void;
  onOpenOrders: () => void;
  onOpenMenu: () => void;
  viewMode: 'restaurants' | 'supermarket' | 'all';
  onViewModeChange: (mode: 'restaurants' | 'supermarket' | 'all') => void;
  cartItemsCount?: number;
  isHidden?: boolean;
  isAccountOpen?: boolean;
  isOrdersOpen?: boolean;
  isCartOpen?: boolean;
}

const BottomNav: React.FC<BottomNavProps> = ({
  onOpenCart,
  onOpenAccount,
  onOpenOrders,
  viewMode,
  onViewModeChange,
  cartItemsCount = 0,
  isHidden = false,
  isAccountOpen = false,
  isOrdersOpen = false,
  isCartOpen = false
}) => {
  if (isHidden) return null;

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
          {/* زر المطاعم */}
          <button
            onClick={() => {
              if (viewMode !== 'restaurants') {
                onViewModeChange('restaurants');
              }
            }}
            className={`flex flex-col items-center gap-1 py-1 transition-all duration-300 group ${
              viewMode === 'restaurants' ? 'text-[#dc2626]' : 'text-gray-500 hover:text-[#dc2626]'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                viewMode === 'restaurants'
                  ? 'bg-[#dc2626] text-white shadow-md'
                  : 'bg-gray-100 text-gray-500 group-hover:bg-[#dc2626]/10 group-hover:text-[#dc2626]'
              }`}
            >
              <Home className="w-6 h-6" />
            </div>
            <span
              className={`text-[10px] font-bold transition-colors duration-300 ${
                viewMode === 'restaurants' ? 'text-[#dc2626]' : 'text-gray-500 group-hover:text-[#dc2626]'
              }`}
            >
              مطاعم
            </span>
          </button>

          {/* زر السوبر ماركت */}
          <button
            onClick={() => {
              if (viewMode !== 'supermarket') {
                onViewModeChange('supermarket');
              }
            }}
            className={`flex flex-col items-center gap-1 py-1 transition-all duration-300 group ${
              viewMode === 'supermarket' ? 'text-[#dc2626]' : 'text-gray-500 hover:text-[#dc2626]'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                viewMode === 'supermarket'
                  ? 'bg-[#dc2626] text-white shadow-md'
                  : 'bg-gray-100 text-gray-500 group-hover:bg-[#dc2626]/10 group-hover:text-[#dc2626]'
              }`}
            >
              <Store className="w-6 h-6" />
            </div>
            <span
              className={`text-[10px] font-bold transition-colors duration-300 ${
                viewMode === 'supermarket' ? 'text-[#dc2626]' : 'text-gray-500 group-hover:text-[#dc2626]'
              }`}
            >
              ماركت
            </span>
          </button>

          {/* زر السلة */}
          <button
            onClick={() => {
              if (!isCartOpen) {
                onOpenCart();
              }
            }}
            className={`flex flex-col items-center gap-1 py-1 transition-all duration-300 group relative ${
              isCartOpen ? 'text-[#dc2626]' : 'text-gray-500 hover:text-[#dc2626]'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 relative ${
                isCartOpen || cartItemsCount > 0
                  ? 'bg-[#dc2626] text-white shadow-md'
                  : 'bg-gray-100 text-gray-500 group-hover:bg-[#dc2626]/10 group-hover:text-[#dc2626]'
              }`}
            >
              <ShoppingCart className="w-6 h-6" />
              {cartItemsCount > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-[9px] font-bold shadow-md">
                  {cartItemsCount > 99 ? '99+' : cartItemsCount}
                </div>
              )}
            </div>
            <span
              className={`text-[10px] font-bold transition-colors duration-300 ${
                isCartOpen || cartItemsCount > 0 ? 'text-[#dc2626]' : 'text-gray-500 group-hover:text-[#dc2626]'
              }`}
            >
              السلة
            </span>
          </button>

          {/* زر حسابي */}
          <button
            onClick={() => {
              if (!isAccountOpen) {
                onOpenAccount();
              }
            }}
            className={`flex flex-col items-center gap-1 py-1 transition-all duration-300 group ${
              isAccountOpen ? 'text-[#dc2626]' : 'text-gray-500 hover:text-[#dc2626]'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                isAccountOpen
                  ? 'bg-[#dc2626] text-white shadow-md'
                  : 'bg-gray-100 text-gray-500 group-hover:bg-[#dc2626]/10 group-hover:text-[#dc2626]'
              }`}
            >
              <User className="w-6 h-6" />
            </div>
            <span
              className={`text-[10px] font-bold transition-colors duration-300 ${
                isAccountOpen ? 'text-[#dc2626]' : 'text-gray-500 group-hover:text-[#dc2626]'
              }`}
            >
              حسابي
            </span>
          </button>

          {/* زر الطلبات */}
          <button
            onClick={() => {
              if (!isOrdersOpen) {
                onOpenOrders();
              }
            }}
            className={`flex flex-col items-center gap-1 py-1 transition-all duration-300 group ${
              isOrdersOpen ? 'text-[#dc2626]' : 'text-gray-500 hover:text-[#dc2626]'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                isOrdersOpen
                  ? 'bg-[#dc2626] text-white shadow-md'
                  : 'bg-gray-100 text-gray-500 group-hover:bg-[#dc2626]/10 group-hover:text-[#dc2626]'
              }`}
            >
              <Package className="w-6 h-6" />
            </div>
            <span
              className={`text-[10px] font-bold transition-colors duration-300 ${
                isOrdersOpen ? 'text-[#dc2626]' : 'text-gray-500 group-hover:text-[#dc2626]'
              }`}
            >
              طلباتي
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
