import React, { useState, useEffect } from 'react';
import { ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FloatingCartProps {
  onOpenCart: () => void;
  showOnlyInProductPage?: boolean;
}

const FloatingCart: React.FC<FloatingCartProps> = ({ onOpenCart, showOnlyInProductPage = false }) => {
  const [cartItemsCount, setCartItemsCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateCartCount = () => {
      const storedCartItems = localStorage.getItem('cartItems');
      if (storedCartItems) {
        try {
          const items = JSON.parse(storedCartItems);
          const count = Object.keys(items).length;
          setCartItemsCount(count);
          setIsVisible(count > 0);
        } catch (e) {
          console.error('Error parsing cart items:', e);
          setCartItemsCount(0);
          setIsVisible(false);
        }
      } else {
        setCartItemsCount(0);
        setIsVisible(false);
      }
    };

    updateCartCount();

    // Listen for storage events to update cart count
    window.addEventListener('storage', updateCartCount);

    // Also listen for custom cart-item-added and cartUpdated events
    window.addEventListener('cart-item-added', updateCartCount);
    window.addEventListener('cartUpdated', updateCartCount);

    return () => {
      window.removeEventListener('storage', updateCartCount);
      window.removeEventListener('cart-item-added', updateCartCount);
      window.removeEventListener('cartUpdated', updateCartCount);
    };
  }, []);

  // Don't show if cart is empty
  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={onOpenCart}
          className="fixed right-4 bg-brand text-white py-3 px-4 rounded-full shadow-lg flex items-center gap-2 z-20"
          style={{
            bottom: 'calc(6rem + max(env(safe-area-inset-bottom), 8px))'
          }}
        >
          <div className="relative">
            <ShoppingCart className="w-5 h-5" />
            {cartItemsCount > 0 && (
              <div className="absolute -top-2 -right-2 w-5 h-5 bg-[#b91c1c] text-white rounded-full flex items-center justify-center text-xs font-bold">
                {cartItemsCount > 99 ? '99+' : cartItemsCount}
              </div>
            )}
          </div>
          <span className="font-medium">السلة ({cartItemsCount})</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
};

export default FloatingCart;