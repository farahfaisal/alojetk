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
      className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-gray-800 z-50 w-full shadow-lg"
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
            onClick={() => onViewModeChange('restaurants')}
            className={`flex flex-col items-center gap-1 py-1 transition-all duration-300 group ${
              viewMode === 'restaurants' ? 'text-[#1759cb]' : 'text-gray-400 hover:text-[#1759cb]'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                viewMode === 'restaurants'
                  ? 'bg-[#1759cb] text-white shadow-md'
                  : 'bg-[#2a2a2a] text-gray-400 group-hover:bg-[#1759cb]/10 group-hover:text-[#1759cb]'
              }`}
            >
              <Home className="w-6 h-6" />
            </div>
            <span
              className={`text-[10px] font-bold transition-colors duration-300 ${
                viewMode === 'restaurants' ? 'text-[#1759cb]' : 'text-gray-400 group-hover:text-[#1759cb]'
              }`}
            >
              مطاعم
            </span>
          </button>

          {/* زر السوبر ماركت */}
          <button
            onClick={() => onViewModeChange('supermarket')}
            className={`flex flex-col items-center gap-1 py-1 transition-all duration-300 group ${
              viewMode === 'supermarket' ? 'text-[#1759cb]' : 'text-gray-400 hover:text-[#1759cb]'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                viewMode === 'supermarket'
                  ? 'bg-[#1759cb] text-white shadow-md'
                  : 'bg-[#2a2a2a] text-gray-400 group-hover:bg-[#1759cb]/10 group-hover:text-[#1759cb]'
              }`}
            >
              <Store className="w-6 h-6" />
            </div>
            <span
              className={`text-[10px] font-bold transition-colors duration-300 ${
                viewMode === 'supermarket' ? 'text-[#1759cb]' : 'text-gray-400 group-hover:text-[#1759cb]'
              }`}
            >
              ماركت
            </span>
          </button>

          {/* زر السلة */}
          <button
            onClick={onOpenCart}
            className={`flex flex-col items-center gap-1 py-1 transition-all duration-300 group relative ${
              isCartOpen ? 'text-[#1759cb]' : 'text-gray-400 hover:text-[#1759cb]'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 relative ${
                isCartOpen || cartItemsCount > 0
                  ? 'bg-[#1759cb] text-white shadow-md'
                  : 'bg-[#2a2a2a] text-gray-400 group-hover:bg-[#1759cb]/10 group-hover:text-[#1759cb]'
              }`}
            >
              <ShoppingCart className="w-6 h-6" />
              {cartItemsCount > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#1759cb] text-white rounded-full flex items-center justify-center text-[9px] font-bold shadow-md">
                  {cartItemsCount > 99 ? '99+' : cartItemsCount}
                </div>
              )}
            </div>
            <span
              className={`text-[10px] font-bold transition-colors duration-300 ${
                isCartOpen || cartItemsCount > 0 ? 'text-[#1759cb]' : 'text-gray-400 group-hover:text-[#1759cb]'
              }`}
            >
              السلة
            </span>
          </button>

          {/* زر حسابي */}
          <button
            onClick={onOpenAccount}
            className={`flex flex-col items-center gap-1 py-1 transition-all duration-300 group ${
              isAccountOpen ? 'text-[#1759cb]' : 'text-gray-400 hover:text-[#1759cb]'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                isAccountOpen
                  ? 'bg-[#1759cb] text-white shadow-md'
                  : 'bg-[#2a2a2a] text-gray-400 group-hover:bg-[#1759cb]/10 group-hover:text-[#1759cb]'
              }`}
            >
              <User className="w-6 h-6" />
            </div>
            <span
              className={`text-[10px] font-bold transition-colors duration-300 ${
                isAccountOpen ? 'text-[#1759cb]' : 'text-gray-400 group-hover:text-[#1759cb]'
              }`}
            >
              حسابي
            </span>
          </button>

          {/* زر الطلبات */}
          <button
            onClick={onOpenOrders}
            className={`flex flex-col items-center gap-1 py-1 transition-all duration-300 group ${
              isOrdersOpen ? 'text-[#1759cb]' : 'text-gray-400 hover:text-[#1759cb]'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                isOrdersOpen
                  ? 'bg-[#1759cb] text-white shadow-md'
                  : 'bg-[#2a2a2a] text-gray-400 group-hover:bg-[#1759cb]/10 group-hover:text-[#1759cb]'
              }`}
            >
              <Package className="w-6 h-6" />
            </div>
            <span
              className={`text-[10px] font-bold transition-colors duration-300 ${
                isOrdersOpen ? 'text-[#1759cb]' : 'text-gray-400 group-hover:text-[#1759cb]'
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
