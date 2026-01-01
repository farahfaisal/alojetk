import React from 'react';
import { Home, User, Store, ShoppingCart, Package, Menu } from 'lucide-react';

interface BottomNavProps {
  onOpenCart: () => void;
  onOpenAccount: () => void;
  onOpenOrders: () => void;
  onOpenMenu: () => void;
  viewMode: 'restaurants' | 'supermarket' | 'all';
  onViewModeChange: (mode: 'restaurants' | 'supermarket' | 'all') => void;
  cartItemsCount?: number;
  isHidden?: boolean;
}

const BottomNav: React.FC<BottomNavProps> = ({
  onOpenCart,
  onOpenAccount,
  onOpenOrders,
  onOpenMenu,
  viewMode,
  onViewModeChange,
  cartItemsCount = 0,
  isHidden = false
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
            onClick={() => onViewModeChange('restaurants')}
            className={`flex flex-col items-center gap-1 py-1 transition-all duration-300 group ${
              viewMode === 'restaurants' ? 'text-brand' : 'text-gray-500 hover:text-brand'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                viewMode === 'restaurants'
                  ? 'bg-brand text-white shadow-md'
                  : 'bg-gray-100 text-gray-500 group-hover:bg-brand/10 group-hover:text-brand'
              }`}
            >
              <Home className="w-6 h-6" />
            </div>
            <span
              className={`text-[10px] font-bold transition-colors duration-300 ${
                viewMode === 'restaurants' ? 'text-brand' : 'text-gray-500 group-hover:text-brand'
              }`}
            >
              مطاعم
            </span>
          </button>

          {/* زر السوبر ماركت */}
          <button
            onClick={() => onViewModeChange('supermarket')}
            className={`flex flex-col items-center gap-1 py-1 transition-all duration-300 group ${
              viewMode === 'supermarket' ? 'text-brand' : 'text-gray-500 hover:text-brand'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                viewMode === 'supermarket'
                  ? 'bg-brand text-white shadow-md'
                  : 'bg-gray-100 text-gray-500 group-hover:bg-brand/10 group-hover:text-brand'
              }`}
            >
              <Store className="w-6 h-6" />
            </div>
            <span
              className={`text-[10px] font-bold transition-colors duration-300 ${
                viewMode === 'supermarket' ? 'text-brand' : 'text-gray-500 group-hover:text-brand'
              }`}
            >
              ماركت
            </span>
          </button>

          {/* زر السلة */}
          <button
            onClick={onOpenCart}
            className="flex flex-col items-center gap-1 py-1 text-gray-500 hover:text-brand transition-all duration-300 group relative"
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 relative ${
                cartItemsCount > 0
                  ? 'bg-brand text-white shadow-md'
                  : 'bg-gray-100 text-gray-500 group-hover:bg-brand/10 group-hover:text-brand'
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
                cartItemsCount > 0 ? 'text-brand' : 'text-gray-500 group-hover:text-brand'
              }`}
            >
              السلة
            </span>
          </button>

          {/* زر حسابي */}
          <button
            onClick={onOpenAccount}
            className="flex flex-col items-center gap-1 py-1 text-gray-500 hover:text-brand transition-all duration-300 group"
          >
            <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center transition-all duration-300 group-hover:bg-brand/10 group-hover:text-brand">
              <User className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-gray-500 group-hover:text-brand transition-colors duration-300">
              حسابي
            </span>
          </button>

          {/* زر الطلبات */}
          <button
            onClick={onOpenOrders}
            className="flex flex-col items-center gap-1 py-1 text-gray-500 hover:text-brand transition-all duration-300 group"
          >
            <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center transition-all duration-300 group-hover:bg-brand/10 group-hover:text-brand">
              <Package className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-gray-500 group-hover:text-brand transition-colors duration-300">
              طلباتي
            </span>
          </button>

          {/* زر القائمة */}
          <button
            onClick={onOpenMenu}
            className="flex flex-col items-center gap-1 py-1 text-gray-500 hover:text-brand transition-all duration-300 group"
          >
            <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center transition-all duration-300 group-hover:bg-brand/10 group-hover:text-brand">
              <Menu className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-gray-500 group-hover:text-brand transition-colors duration-300">
              القائمة
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
