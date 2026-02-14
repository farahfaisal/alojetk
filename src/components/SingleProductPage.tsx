import React, { useState, useEffect, useCallback } from 'react';
import { Check, ShoppingCart, Star, Plus, Minus, X, ChevronLeft, Clock, ChevronDown, Heart, Share2, Store, Info, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import AddToCartPopup from './AddToCartPopup';
import ProductVariantsDisplay from './ProductVariantsDisplay';
import { checkCartVendorConflict } from '../lib/storage';
import FloatingCart from './FloatingCart';
import ProductAddedPopup from './ProductAddedPopup';
import { checkVendorWorkingStatus } from '../lib/store-hours';

interface ProductVariant {
  id: number | string;
  name: string;
  price: number;
  image_url?: string;
  sku?: string;
  discount_price?: number | null;
  wholesale_price?: number | null;
}

interface ProductAddon {
  id: number | string;
  name: string;
  price: number;
  is_required: boolean;
  is_default: boolean;
  type?: string;
}

interface Product {
  id: number | string;
  name: string;
  description?: string;
  details?: {
    ingredients?: string[];
    allergens?: string[];
    calories?: number;
  };
  preparation_time?: number;
  price: number;
  image_url?: string;
  vendor: {
    id: number | string;
    store_name: string;
    logo_url?: string;
    rating?: number;
    rating_count?: number;
    status?: string;
  };
  category?: {
    id: number;
    name: string;
  };
  variants?: ProductVariant[];
  addons?: ProductAddon[];
  is_variant_product?: boolean;
  variants_data?: string | any[];
  status: string;
  regular_price?: number;
  sale_price?: number;
  gallery_urls?: string[];
}

interface SingleProductPageProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (productId: number | string, quantity: number, addons?: any[]) => void;
}

const usePreventBodyScroll = () => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
};

const SingleProductPage: React.FC<SingleProductPageProps> = ({ product, onClose, onAddToCart }) => {
  const { isAuthenticated } = useAuth();
  usePreventBodyScroll();

  // Notify that product page is open
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('product-page-opened'));
    return () => {
      window.dispatchEvent(new CustomEvent('product-page-closed'));
    };
  }, []);

  const [quantity, setQuantity] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState<{[key: number | string]: number | string}>({});
  const [selectedAddons, setSelectedAddons] = useState<{[key: number]: boolean}>({});
  const [addonQuantities, setAddonQuantities] = useState<{[key: number]: number}>({});
  const [isFavorite, setIsFavorite] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showSelectionPopup, setShowSelectionPopup] = useState(false);
  const [selectionStep, setSelectionStep] = useState<'variants' | 'required' | 'optional' | 'none'>('none');
  const [showMultiVendorWarning, setShowMultiVendorWarning] = useState(false);
  const [existingVendorName, setExistingVendorName] = useState<string | null>(null);
  const [showAddToCartPopup, setShowAddToCartPopup] = useState(false);
  const [variants, setVariants] = useState<any[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<number | string | null>(null);
  const [addToCartError, setAddToCartError] = useState<string | null>(null);
  const [pendingCartItem, setPendingCartItem] = useState<any | null>(null);
  const [isVendorAvailable, setIsVendorAvailable] = useState(true);
  const [showAddedNotification, setShowAddedNotification] = useState(false);
  const [justAddedToCart, setJustAddedToCart] = useState(false);
  const [cartItemsCount, setCartItemsCount] = useState(0);
  const [showProductAddedPopup, setShowProductAddedPopup] = useState(false);
  const [mergedAddons, setMergedAddons] = useState<ProductAddon[]>([]);

  useEffect(() => {
    // Check if vendor is available based on working hours and status
    if (product.vendor) {
      const workingStatus = checkVendorWorkingStatus({
        working_hours: product.vendor.working_hours,
        vacation_mode: product.vendor.vacation_mode,
        status: product.vendor.status
      });
      setIsVendorAvailable(workingStatus.is_open);
    }
  }, [product.vendor]);

  // Get cart items count
  useEffect(() => {
    const updateCartCount = () => {
      const storedCartItems = localStorage.getItem('cartItems');
      if (storedCartItems) {
        try {
          const items = JSON.parse(storedCartItems);
          setCartItemsCount(Object.keys(items).length);
        } catch (e) {
          console.error('Error parsing cart items:', e);
        }
      }
    };

    updateCartCount();

    window.addEventListener('storage', updateCartCount);
    return () => window.removeEventListener('storage', updateCartCount);
  }, []);

  // Listen for close-all-screens event
  useEffect(() => {
    const handleCloseAllScreens = () => {
      onClose();
    };
    
    window.addEventListener('close-all-screens', handleCloseAllScreens);
    
    return () => {
      window.removeEventListener('close-all-screens', handleCloseAllScreens);
    };
  }, [onClose]);

  useEffect(() => {
    // Process variants from the product
    if (product.is_variant_product) {
      try {
        let productVariants: any[] = [];

        // Handle variants from variants_data property
        if (product.variants_data) {
          // Parse variants_data if it's a string
          const variantsData = typeof product.variants_data === 'string'
            ? JSON.parse(product.variants_data)
            : product.variants_data;

          if (Array.isArray(variantsData) && variantsData.length > 0) {
            productVariants = variantsData;
          }
        }
        // Or use the direct variants array if available
        else if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
          productVariants = product.variants;
        }

        // Set the variants in state
        if (productVariants.length > 0) {
          // Ensure each variant has an id (use name as fallback if id is missing)
          const variantsWithIds = productVariants.map((variant, index) => ({
            ...variant,
            id: variant.id || `variant-${index}-${variant.name}`,
            price: typeof variant.price === 'string' ? parseFloat(variant.price) : variant.price
          }));

          setVariants(variantsWithIds);

          // Auto-select the first variant if there's only one
          if (variantsWithIds.length === 1) {
            setSelectedVariantId(variantsWithIds[0].id);
          }
        }
      } catch (error) {
        console.error('خطأ في تحليل بيانات الأنواع:', error);
        setAddToCartError('حدث خطأ في تحميل خيارات المنتج');
      }
    }

    // Initialize selected addons - merge from addons array and addons_data
    let productAddons = product.addons || [];

    // If product has addons_data, merge it (only if table addons are empty)
    if ((product as any).addons_data && Array.isArray((product as any).addons_data)) {
      // Only use addons_data if there are no table addons
      if (productAddons.length === 0) {
        const addonsFromData = (product as any).addons_data.map((addon: any, index: number) => ({
          id: addon.id || `addon-${product.id}-${index}`,
          name: addon.name,
          price: parseFloat(addon.price) || 0,
          is_required: addon.is_required || false,
          is_default: addon.is_default || false,
          type: addon.type || 'optional',
          image_url: addon.image_url || null
        }));
        productAddons = addonsFromData;
      }
    }

    // Store merged addons in state
    setMergedAddons(productAddons);

    if (productAddons.length > 0) {
      const initialAddons: {[key: number]: boolean} = {};

      // Select default addons
      productAddons.forEach(addon => {
        if (addon.is_default) {
          initialAddons[addon.id] = true;
        }
      });

      setSelectedAddons(initialAddons);
    }
  }, [product]);

  // Auto-start with first step when variants or addons are loaded
  useEffect(() => {
    if (variants.length > 0) {
      setSelectionStep('variants');
    } else if (mergedAddons && mergedAddons.length > 0) {
      const requiredAddons = mergedAddons.filter(addon => addon.is_required);
      const optionalAddons = mergedAddons.filter(addon => !addon.is_required);

      if (requiredAddons.length > 0) {
        setSelectionStep('required');
      } else if (optionalAddons.length > 0) {
        setSelectionStep('optional');
      }
    }
  }, [variants, mergedAddons]);

  const checkMultiVendor = () => {
    // Check if there are items from a different vendor in the cart
    const { hasConflict, existingVendorName } = checkCartVendorConflict(product.vendor.id);
    
    if (hasConflict) {
      setExistingVendorName(existingVendorName || 'متجر آخر');
      return true;
    }
    
    return false;
  };

  const prepareCartItem = () => {
    // Get selected addons with their individual quantities
    const selectedAddonsList = mergedAddons
      .filter(addon => selectedAddons[addon.id])
      .map(addon => ({
        ...addon,
        quantity: addonQuantities[addon.id] || 1
      }));

    // Get selected variants information
    const selectedVariantsList = variants.map(variant => {
      if (!variant.options || !Array.isArray(variant.options)) {
        return {
          variant_id: variant.id,
          variant_name: variant.name,
          option_id: null,
          option_name: null
        };
      }
      
      const selectedOptionId = selectedVariants[variant.id];
      const selectedOption = variant.options.find(opt => opt && opt.id === selectedOptionId);
      
      return {
        variant_id: variant.id,
        variant_name: variant.name,
        option_id: selectedOptionId,
        option_name: selectedOption?.name
      };
    });

    // Create cart item object
    // Use discount price if available, otherwise use regular price
    const finalPrice = product.discount_price && product.discount_price > 0
      ? product.discount_price
      : product.price;

    return {
      id: product.id,
      name: product.name,
      price: finalPrice,
      quantity: quantity,
      image: product.image_url,
      vendor_id: product.vendor.id,
      vendor_name: product.vendor.store_name,
      addons: selectedAddonsList,
      variants: selectedVariantsList,
      preparation_time: product.preparation_time
    };
  };

  const handleOpenSelectionPopup = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Check if vendor is available
    if (!isVendorAvailable) {
      setAddToCartError('المتجر غير متاح حالياً، لا يمكن إضافة المنتج للسلة');
      return;
    }
    
    try {
      // If product is a variant product, always show variants selection first
      if (product.is_variant_product && variants.length > 0) {
        setSelectionStep('variants');
        setShowSelectionPopup(true);
        return;
      }
      
      // If product has no variants and no addons, add directly to cart
      if ((!product.variants || !product.variants.length) && (!mergedAddons || !mergedAddons.length)) {
        handleAddToCart(e);
        return;
      }

      // If product has variants, start with them
      if (product.variants && product.variants.length > 0) {
        setSelectionStep('variants');
      } else if (mergedAddons?.some(addon => addon.is_required)) {
        // If no variants but has required addons
        setSelectionStep('required');
      } else {
        // Otherwise show optional addons if they exist
        setSelectionStep('optional');
      }
      
      setShowSelectionPopup(true);
    } catch (error) {
      console.error('Error opening selection popup:', error);
    }
  };

  const handleVariantSelect = (variantId: number | string, optionId: number | string) => {
    setSelectedVariants(prev => ({
      ...prev,
      [variantId]: optionId
    }));
  };

  const handleAddonToggle = (addonId: number) => {
    // Don't allow toggling required addons
    const addon = mergedAddons.find(a => a.id === addonId);
    if (addon?.is_required) return;
    
    setSelectedAddons(prev => ({
      ...prev,
      [addonId]: !prev[addonId]
    }));
  };

  const handleAddToCart = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    // Check if vendor is available
    if (!isVendorAvailable) {
      setAddToCartError('المتجر غير متاح حالياً، لا يمكن إضافة المنتج للسلة');
      return;
    }
    
    try {
      // Check for multi-vendor conflict
      if (checkMultiVendor()) {
        setShowMultiVendorWarning(true);
        setPendingCartItem(prepareCartItem());
        return false;
      }
      
      // Check if variant is selected when product has variants
      if (product.is_variant_product && variants.length > 0) {
        if (!selectedVariantId) {
          setAddToCartError('الرجاء اختيار نوع المنتج');
          return;
        }
      }
      
      // Get selected addons with their individual quantities
      const selectedAddonsList = mergedAddons
        .filter(addon => selectedAddons[addon.id])
        .map(addon => ({
          id: addon.id,
          name: addon.name,
          price: addon.price,
          quantity: addonQuantities[addon.id] || 1,
          is_required: addon.is_required || false,
          is_default: addon.is_default || false,
          type: addon.type || (addon.is_required ? 'regular' : 'optional')
        }));

      console.log('🔧 Selected addons for direct add:', selectedAddonsList);
      console.log('🔧 Selected variant ID:', selectedVariantId);

      // Prepare variant info for cart
      let variantInfo = null;
      if (product.is_variant_product && selectedVariantId) {
        const selectedVariant = variants.find(v => v.id === selectedVariantId);
        if (selectedVariant) {
          variantInfo = {
            variant_id: selectedVariant.id,
            variant_name: selectedVariant.name,
            variant_price: selectedVariant.price
          };
        }
      }

      // Call the parent component's onAddToCart function with variant info
      if (variantInfo) {
        onAddToCart(product.id, quantity, [
          ...selectedAddonsList,
          { ...variantInfo, isVariant: true }
        ]);
      } else {
        onAddToCart(product.id, quantity, selectedAddonsList);
      }

      // Dispatch custom event for cart notification
      window.dispatchEvent(new CustomEvent('cart-item-added', { 
        detail: { productName: product.name }
      }));
      
      // Show the added notification
      setShowAddedNotification(true);
      setJustAddedToCart(true);
      
      // Hide the notification after 2 seconds
      setTimeout(() => {
        setShowAddedNotification(false);
      }, 2000);
      
      // Show the product added popup
      setShowProductAddedPopup(true);
      
      // Dispatch storage event to update cart count
      window.dispatchEvent(new Event('storage'));
    } catch (error) {
      console.error('Error adding item to cart:', error);
    }
  };

  const handleShare = async () => {
    const shareText = `🍽️ أفضل الوجبات من الو جيتك\n\n${product.name}\n${product.description || ''}\n\n💰 السعر: ₪${product.discount_price || product.price}\n\nاطلب الآن من ${product.vendor.store_name}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${product.name} - الو جيتك`,
          text: shareText,
          url: window.location.href
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error);
        }
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(`${shareText}\n\n${window.location.href}`);
        alert('تم نسخ رابط المنتج إلى الحافظة!');
      } catch (error) {
        console.error('Error copying to clipboard:', error);
      }
    }
  };

  // Group addons by type
  const groupedAddons = {
    default: mergedAddons.filter(addon => !addon.is_required && addon.is_default),
    optional: mergedAddons.filter(addon => !addon.is_required && !addon.is_default),
    required: mergedAddons.filter(addon => addon.is_required),
  };
  
  const handleNextStep = () => {
    if (selectionStep === 'variants') {
      // Check if all required variants are selected
      const requiredVariants = variants?.filter(variant => variant.is_required) || [];
      const allRequiredVariantsSelected = requiredVariants.length === 0 || 
        requiredVariants.every(variant => selectedVariants[variant.id]);
      
      if (!allRequiredVariantsSelected) {
        // Show error alert that all required variants must be selected
        alert('يرجى اختيار جميع الأنواع المطلوبة قبل المتابعة');
        return;
      }
      
      // Move to required addons if they exist
      if (mergedAddons.some(addon => addon.is_required)) {
        setSelectionStep('required');
      } else if (mergedAddons.some(addon => !addon.is_required)) {
        setSelectionStep('optional');
      } else {
        handleAddToCart();
        setShowSelectionPopup(false);
      }
    } else if (selectionStep === 'required' && groupedAddons.optional.length > 0) {
      setSelectionStep('optional');
    } else {
      handleAddToCart();
      setShowSelectionPopup(false);
    }
  };

  // Get the currently selected variant option for display
  const getSelectedVariantOption = (variantId: number | string) => {
    const variant = variants.find(v => v && v.id === variantId);
    if (!variant || !variant.options || !Array.isArray(variant.options)) return null;
    
    const selectedOptionId = selectedVariants[variantId];
    return variant.options.find(opt => opt && opt.id === selectedOptionId);
  };

  // Clear pending item and close multi-vendor warning
  const handleCancelMultiVendor = () => {
    setShowMultiVendorWarning(false);
    setPendingCartItem(null);
  };

  // Clear cart and add new item
  const handleClearCartAndAddNew = () => {
    if (!pendingCartItem) return;
    
    // Clear cart
    localStorage.removeItem('cartItems');
    
    // Add new item
    const cart = {
      [pendingCartItem.id]: pendingCartItem
    };
    
    localStorage.setItem('cartItems', JSON.stringify(cart));
    
    // Reset state
    setShowMultiVendorWarning(false);
    setPendingCartItem(null);
    
    // Show the product added popup
    setShowProductAddedPopup(true);
    
    // Dispatch storage event to update cart count
    window.dispatchEvent(new Event('storage'));
    
    // Dispatch cart-item-added event
    window.dispatchEvent(new CustomEvent('cart-item-added', { 
      detail: { productName: product.name }
    }));
  };

  // Function to handle direct variant selection
  const handleDirectVariantSelect = (variant: any) => {
    if (variant) {
      // Check if vendor is available
      if (!isVendorAvailable) {
        setAddToCartError('المتجر غير متاح حالياً، لا يمكن إضافة المنتج للسلة');
        return;
      }

      // Calculate final variant price considering product discount
      let finalVariantPrice = variant.price;
      if (product.discount_price && product.discount_price > 0 && product.price > 0) {
        // Apply the same discount percentage to variant price
        const discountPercentage = (product.price - product.discount_price) / product.price;
        finalVariantPrice = variant.price * (1 - discountPercentage);
      }

      // Add the selected variant to cart
      const cartItem = {
        id: `${product.id}_${variant.id}`,
        product_id: product.id, // Store the actual product UUID
        name: `${product.name} - ${variant.name}`,
        price: finalVariantPrice,
        quantity: quantity,
        image: variant.image_url || product.image_url,
        vendor_id: product.vendor.id,
        vendor_name: product.vendor.store_name,
        variant_id: variant.id,
        variant_name: variant.name,
        preparation_time: product.preparation_time
      };
      
      // Check for multi-vendor conflict
      if (checkMultiVendor()) {
        setShowMultiVendorWarning(true);
        setPendingCartItem(cartItem);
        return;
      }
      
      // Add to cart
      const storedCartItems = localStorage.getItem('cartItems');
      let cart = storedCartItems ? JSON.parse(storedCartItems) : {};
      
      cart[cartItem.id] = cartItem;
      
      localStorage.setItem('cartItems', JSON.stringify(cart));
      
      // Show the added notification
      setShowAddedNotification(true);
      setJustAddedToCart(true);
      
      // Hide the notification after 2 seconds
      setTimeout(() => {
        setShowAddedNotification(false);
      }, 2000);
      
      // Show the product added popup
      setShowProductAddedPopup(true);
      
      // Dispatch storage event to update cart count
      window.dispatchEvent(new Event('storage'));
      
      // Dispatch cart-item-added event
      window.dispatchEvent(new CustomEvent('cart-item-added', { 
        detail: { productName: `${product.name} - ${variant.name}` }
      }));
    }
  };

  // Handle variant selection from modal
  const handleVariantSelectFromModal = (variant: any, quantity: number, addons?: ProductAddon[]) => {
    if (variant) {
      // Check if vendor is available
      if (!isVendorAvailable) {
        setAddToCartError('المتجر غير متاح حالياً، لا يمكن إضافة المنتج للسلة');
        return;
      }

      // Calculate final variant price considering product discount
      let finalVariantPrice = variant.price;
      if (product.discount_price && product.discount_price > 0 && product.price > 0) {
        // Apply the same discount percentage to variant price
        const discountPercentage = (product.price - product.discount_price) / product.price;
        finalVariantPrice = variant.price * (1 - discountPercentage);
      }

      // Create cart item with the selected variant
      const cartItem = {
        id: `${product.id}_${variant.id}`,
        product_id: product.id,
        name: `${product.name} - ${variant.name}`,
        price: finalVariantPrice,
        quantity: quantity,
        image: variant.image_url || product.image_url,
        vendor_id: product.vendor.id,
        vendor_name: product.vendor.store_name,
        variant_id: variant.id,
        variant_name: variant.name,
        addons: addons || [],
        preparation_time: product.preparation_time
      };
      
      // Check for multi-vendor conflict
      if (checkMultiVendor()) {
        setShowMultiVendorWarning(true);
        setPendingCartItem(cartItem);
        return;
      }
      
      // Add to cart
      const storedCartItems = localStorage.getItem('cartItems');
      let cart = storedCartItems ? JSON.parse(storedCartItems) : {};
      
      cart[cartItem.id] = cartItem;
      
      localStorage.setItem('cartItems', JSON.stringify(cart));
      
      // Show the added notification
      setShowAddedNotification(true);
      setJustAddedToCart(true);
      
      // Hide the notification after 2 seconds
      setTimeout(() => {
        setShowAddedNotification(false);
      }, 2000);
      
      // Show the product added popup
      setShowProductAddedPopup(true);
      
      // Dispatch storage event to update cart count
      window.dispatchEvent(new Event('storage'));
      
      // Dispatch cart-item-added event
      window.dispatchEvent(new CustomEvent('cart-item-added', { 
        detail: { productName: `${product.name} - ${variant.name}` }
      }));
    }
  };

  // Function to open cart
  const handleOpenCart = () => {
    // Close this product page first
    onClose();
    
    // Then open the cart
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-cart'));
    }, 100);
  };

  // Function to handle continuing shopping
  const handleContinueShopping = () => {
    setShowProductAddedPopup(false);
  };

  // Calculate total price including addons
  const calculateTotal = () => {
    // Use discount price if available, otherwise use regular price
    let productPrice = product.discount_price && product.discount_price > 0
      ? product.discount_price
      : product.price;

    // Ensure price is a number for calculations
    productPrice = typeof productPrice === 'string'
      ? parseFloat(productPrice)
      : productPrice;
    
    // Add variant price adjustments
    let variantAdjustment = 0;
    if (variants && variants.length > 0) {
      variants.forEach(variant => {
        if (!variant || !variant.options || !Array.isArray(variant.options)) {
          return;
        }
        const selectedOptionId = selectedVariants[variant.id];
        if (selectedOptionId) {
          const option = variant.options.find(opt => opt && opt.id === selectedOptionId);
          if (option && option.price_adjustment) {
            variantAdjustment += option.price_adjustment;
          }
        }
      });
    }
      
    const basePrice = productPrice * quantity;
    const addonsPrice = mergedAddons
      .filter(addon => selectedAddons[addon.id])
      .reduce((sum, addon) => {
        // Use the addon's individual quantity from state
        const addonQuantity = addonQuantities[addon.id] || 1;
        return sum + (addon.price * addonQuantity);
      }, 0) * quantity;

    return basePrice + addonsPrice + (variantAdjustment * quantity);
  };

  // Helper function to get addon images
  const getAddonImage = (addonName: string): string => {
    const addonImages: { [key: string]: string } = {
      'خضار': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=100&h=100&fit=crop',
      'جبنة جاودا': 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=100&h=100&fit=crop',
      'بطاطا': 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=100&h=100&fit=crop',
      'صوص': 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=100&h=100&fit=crop',
      'سلطة': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=100&h=100&fit=crop',
      'مايونيز': 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=100&h=100&fit=crop',
      'كاتشب': 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=100&h=100&fit=crop'
    };
    
    // Find matching image or return default
    for (const [key, image] of Object.entries(addonImages)) {
      if (addonName.includes(key)) {
        return image;
      }
    }
    
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-start justify-center p-0"
      data-product-page="true"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '-100%' }}
        animate={{ y: 0 }}
        exit={{ y: '-100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-transparent w-full max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-hide"
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 20px)',
          paddingBottom: '20px'
        }}
      >
        {/* Close / Back Button */}
        <div className="flex justify-start p-4">
          {selectionStep !== 'none' ? (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                // Go back to previous step
                if (selectionStep === 'optional') {
                  if (groupedAddons.required.length > 0) {
                    setSelectionStep('required');
                  } else if (product.is_variant_product && variants.length > 0) {
                    setSelectionStep('variants');
                  } else {
                    setSelectionStep('none');
                  }
                } else if (selectionStep === 'required') {
                  if (product.is_variant_product && variants.length > 0) {
                    setSelectionStep('variants');
                  } else {
                    setSelectionStep('none');
                  }
                } else if (selectionStep === 'variants') {
                  setSelectionStep('none');
                }
              }}
              className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl"
            >
              <ChevronLeft className="w-6 h-6 text-gray-800" />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl"
            >
              <X className="w-6 h-6 text-gray-800" />
            </motion.button>
          )}
        </div>

        {/* Product Image - Rounded Card */}
        <div className="mx-4 mb-4">
          <div className="relative w-full aspect-video rounded-3xl overflow-hidden shadow-2xl">
            <img
              src={product.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800"}
              alt={product.name}
              className="w-full h-full object-cover"
            />

            {/* Vendor status overlay */}
            {!isVendorAvailable && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="bg-white px-4 py-2 rounded-xl text-red-800 font-bold">
                  المتجر غير متاح حالياً
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Red Card with Product Info */}
        <div className="mx-4 bg-[#B91C1C] rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-white m-1 rounded-[22px] p-6">
            {/* Quantity Selector at Top - Show in all steps */}
            <div className="flex items-center justify-center mb-4">
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">الكمية</span>
                <div className="flex items-center bg-white rounded-xl border-2 border-gray-200 shadow-sm">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-12 h-12 flex items-center justify-center text-gray-900 hover:bg-gray-50 rounded-r-xl font-bold text-xl"
                    disabled={!isVendorAvailable}
                  >
                    +
                  </motion.button>
                  <div className="w-16 h-12 flex items-center justify-center border-x border-gray-200">
                    <span className="text-xl font-bold text-gray-900">{quantity}</span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-12 h-12 flex items-center justify-center text-gray-900 hover:bg-gray-50 rounded-l-xl font-bold text-xl"
                    disabled={!isVendorAvailable}
                  >
                    −
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Product Name and Description */}
            <div className="text-center mb-4">
              <div className="flex items-start justify-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-gray-900 flex-1">{product.name}</h2>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleShare}
                  className="w-10 h-10 bg-gradient-to-br from-[#B91C1C] to-[#991B1B] rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
                  aria-label="مشاركة المنتج"
                >
                  <Share2 className="w-5 h-5 text-white" />
                </motion.button>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">
                {product.description || 'وصف المنتج'}
              </p>

              {/* Base Price Display */}
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="text-sm text-gray-600 font-medium">السعر الأساسي:</span>
                <span className="text-2xl font-bold text-[#B91C1C]">
                  ₪{(product.discount_price && product.discount_price > 0 ? product.discount_price : product.price).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Error messages */}
            {addToCartError && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg mb-4 text-sm">
                {addToCartError}
              </div>
            )}

            {!isVendorAvailable && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg mb-4 flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p>المتجر غير متاح حالياً</p>
              </div>
            )}

            {/* Step 1: Variants Selection */}
            {selectionStep === 'variants' && product.is_variant_product && variants && variants.length > 0 && (
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 mb-3">اختر النوع - خيار واحد فقط:</h3>
                <div className="space-y-2">
                  {variants.map((variant) => (
                    <label
                      key={variant.id}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedVariantId === variant.id
                          ? 'border-[#B91C1C] bg-red-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="variant-selection"
                        value={variant.id}
                        checked={selectedVariantId === variant.id}
                        onChange={() => {
                          setSelectedVariantId(variant.id);
                          setAddToCartError(null);
                        }}
                        className="hidden"
                      />
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedVariantId === variant.id
                            ? 'bg-[#B91C1C] border-[#B91C1C]'
                            : 'border-gray-300'
                        }`}>
                          {selectedVariantId === variant.id && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{variant.name}</div>
                          {variant.description && (
                            <div className="text-sm text-gray-600 mt-0.5">{variant.description}</div>
                          )}
                        </div>
                      </div>
                      <div className="font-bold text-[#B91C1C]">₪{variant.price}</div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Required Addons (المكونات) */}
            {selectionStep === 'required' && groupedAddons.required.length > 0 && (
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                  المكونات:
                </h3>
                <div className="space-y-2">
                  {groupedAddons.required.map((addon) => (
                    <div key={addon.id} className="space-y-2">
                      <div
                        className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedAddons[addon.id]
                            ? 'border-[#B91C1C] bg-red-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        onClick={() => {
                          setSelectedAddons(prev => ({
                            ...prev,
                            [addon.id]: !prev[addon.id]
                          }));
                          if (!selectedAddons[addon.id]) {
                            setAddonQuantities(prev => ({
                              ...prev,
                              [addon.id]: 1
                            }));
                          }
                          setAddToCartError(null);
                        }}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            selectedAddons[addon.id]
                              ? 'bg-[#B91C1C] border-[#B91C1C]'
                              : 'border-gray-300'
                          }`}>
                            {selectedAddons[addon.id] && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                          {addon.image_url && (
                            <img
                              src={addon.image_url}
                              alt={addon.name}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          )}
                          <div className="font-semibold text-gray-900">{addon.name}</div>
                        </div>
                        <div className="font-bold text-[#B91C1C] flex-shrink-0">₪{addon.price}</div>
                      </div>
                      {selectedAddons[addon.id] && (
                        <div className="flex items-center justify-center gap-2 px-4">
                          <span className="text-sm text-gray-600">الكمية:</span>
                          <div className="flex items-center bg-white rounded-lg border border-gray-200">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddonQuantities(prev => ({
                                  ...prev,
                                  [addon.id]: (prev[addon.id] || 1) + 1
                                }));
                              }}
                              className="w-8 h-8 flex items-center justify-center text-gray-900 hover:bg-gray-50 rounded-r-lg font-bold"
                            >
                              +
                            </button>
                            <div className="w-12 h-8 flex items-center justify-center border-x border-gray-200">
                              <span className="text-sm font-bold text-gray-900">{addonQuantities[addon.id] || 1}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddonQuantities(prev => ({
                                  ...prev,
                                  [addon.id]: Math.max(1, (prev[addon.id] || 1) - 1)
                                }));
                              }}
                              className="w-8 h-8 flex items-center justify-center text-gray-900 hover:bg-gray-50 rounded-l-lg font-bold"
                            >
                              −
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Optional Addons */}
            {selectionStep === 'optional' && groupedAddons.optional.length > 0 && (
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 mb-2">الإضافات الاختيارية:</h3>
                <div className="space-y-2">
                  {groupedAddons.optional.map((addon) => (
                    <div key={addon.id} className="space-y-2">
                      <label
                        className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedAddons[addon.id]
                            ? 'border-[#B91C1C] bg-red-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        onClick={() => {
                          setSelectedAddons(prev => {
                            const newState = {
                              ...prev,
                              [addon.id]: !prev[addon.id]
                            };
                            if (!newState[addon.id]) {
                              setAddonQuantities(prevQty => ({
                                ...prevQty,
                                [addon.id]: 1
                              }));
                            } else if (!addonQuantities[addon.id]) {
                              setAddonQuantities(prevQty => ({
                                ...prevQty,
                                [addon.id]: 1
                              }));
                            }
                            return newState;
                          });
                        }}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            selectedAddons[addon.id]
                              ? 'bg-[#B91C1C] border-[#B91C1C]'
                              : 'border-gray-300'
                          }`}>
                            {selectedAddons[addon.id] && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                          {addon.image_url && (
                            <img
                              src={addon.image_url}
                              alt={addon.name}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          )}
                          <div className="font-semibold text-gray-900">{addon.name}</div>
                        </div>
                        <div className="font-bold text-[#B91C1C] flex-shrink-0">₪{addon.price}</div>
                      </label>
                      {selectedAddons[addon.id] && (
                        <div className="flex items-center justify-center gap-2 px-4">
                          <span className="text-sm text-gray-600">الكمية:</span>
                          <div className="flex items-center bg-white rounded-lg border border-gray-200">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddonQuantities(prev => ({
                                  ...prev,
                                  [addon.id]: (prev[addon.id] || 1) + 1
                                }));
                              }}
                              className="w-8 h-8 flex items-center justify-center text-gray-900 hover:bg-gray-50 rounded-r-lg font-bold"
                            >
                              +
                            </button>
                            <div className="w-12 h-8 flex items-center justify-center border-x border-gray-200">
                              <span className="text-sm font-bold text-gray-900">{addonQuantities[addon.id] || 1}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddonQuantities(prev => ({
                                  ...prev,
                                  [addon.id]: Math.max(1, (prev[addon.id] || 1) - 1)
                                }));
                              }}
                              className="w-8 h-8 flex items-center justify-center text-gray-900 hover:bg-gray-50 rounded-l-lg font-bold"
                            >
                              −
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Message */}
            {addToCartError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
                {addToCartError}
              </div>
            )}

            {/* Action Button - Changes based on step */}
            {selectionStep === 'none' ? (
              // Start Button
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => {
                  e.preventDefault();
                  // Determine first step
                  if (product.is_variant_product && variants.length > 0) {
                    setSelectionStep('variants');
                  } else if (groupedAddons.required.length > 0) {
                    setSelectionStep('required');
                  } else if (groupedAddons.optional.length > 0) {
                    setSelectionStep('optional');
                  } else {
                    handleAddToCart(e);
                  }
                }}
                disabled={!isVendorAvailable}
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-lg ${
                  isVendorAvailable
                    ? 'bg-[#B91C1C] text-white hover:bg-[#991B1B] transition-colors'
                    : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                }`}
              >
                <span className="flex items-center gap-3">
                  أضف للسلة
                  <motion.div
                    animate={{ x: [-3, 0, -3] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    ←
                  </motion.div>
                </span>
              </motion.button>
            ) : selectionStep === 'variants' ? (
              // Next Button for Variants
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => {
                  e.preventDefault();
                  if (!selectedVariantId) {
                    setAddToCartError('الرجاء اختيار نوع المنتج');
                    return;
                  }
                  // Move to next step
                  if (groupedAddons.required.length > 0) {
                    setSelectionStep('required');
                  } else if (groupedAddons.optional.length > 0) {
                    setSelectionStep('optional');
                  } else {
                    handleAddToCart(e);
                  }
                }}
                disabled={!selectedVariantId}
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-lg ${
                  selectedVariantId
                    ? 'bg-[#B91C1C] text-white hover:bg-[#991B1B] transition-colors'
                    : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                }`}
              >
                <span className="flex items-center gap-3">
                  التالي
                  <motion.div
                    animate={{ x: [-3, 0, -3] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    ←
                  </motion.div>
                </span>
              </motion.button>
            ) : selectionStep === 'required' ? (
              // Next Button for Required Addons
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => {
                  e.preventDefault();
                  // Move to next step (components are now optional)
                  if (groupedAddons.optional.length > 0) {
                    setSelectionStep('optional');
                  } else {
                    handleAddToCart(e);
                  }
                }}
                className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-lg bg-[#B91C1C] text-white hover:bg-[#991B1B] transition-colors"
              >
                <span className="flex items-center gap-3">
                  التالي
                  <motion.div
                    animate={{ x: [-3, 0, -3] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    ←
                  </motion.div>
                </span>
              </motion.button>
            ) : (
              // Add to Cart Button for Optional Addons
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => {
                  e.preventDefault();
                  handleAddToCart(e);
                }}
                className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-lg bg-[#B91C1C] text-white hover:bg-[#991B1B] transition-colors"
              >
                <span className="flex items-center gap-3">
                  {justAddedToCart ? (
                    <>
                      <Check className="w-6 h-6" />
                      تم الإضافة
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5" />
                      أضف للسلة
                    </>
                  )}
                </span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Bottom spacing */}
        <div className="h-6"></div>
      </motion.div>

      {/* Floating Cart Button */}
      <FloatingCart onOpenCart={handleOpenCart} showOnlyInProductPage={true} />

      {/* Product Variants Modal */}
      <ProductVariantsDisplay
        isOpen={showSelectionPopup}
        onClose={() => setShowSelectionPopup(false)}
        variants={variants}
        onAddToCart={handleVariantSelectFromModal}
        productName={product.name}
        productBasePrice={product.price}
        addons={mergedAddons}
      />

      {/* Confirmation Modal */}
      {showMultiVendorWarning && pendingCartItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-3">تغيير المتجر</h3>
            <p className="mb-4">
              السلة الحالية تحتوي على منتجات من "{existingVendorName}". هل تريد إفراغ السلة وإضافة المنتج من "{product.vendor.store_name}"؟
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelMultiVendor}
                className="flex-1 py-2 px-4 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleClearCartAndAddNew}
                className="flex-1 py-2 px-4 text-white bg-brand hover:bg-brand-light rounded-md transition-colors"
              >
                إفراغ وإضافة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Cart Popup */}
      <AddToCartPopup
        visible={showAddToCartPopup}
        onClose={() => setShowAddToCartPopup(false)}
        productName={product.name}
        onViewCart={() => {
          setShowAddToCartPopup(false);
          onClose();
          window.dispatchEvent(new CustomEvent('open-cart'));
        }}
      />

      {/* Product Added Popup */}
      <ProductAddedPopup
        isOpen={showProductAddedPopup}
        onClose={() => setShowProductAddedPopup(false)}
        productName={product.name}
        onViewCart={handleOpenCart}
        onContinueShopping={handleContinueShopping}
      />
    </motion.div>
  );
};

export default SingleProductPage;