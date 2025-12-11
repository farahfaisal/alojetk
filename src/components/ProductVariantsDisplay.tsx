import React, { useState, useEffect } from 'react';
import { Check, ShoppingCart, Plus, Minus, X, AlertCircle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductVariant {
  id: string;
  name: string;
  price: number;
  stock?: number;
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
  quantity?: number;
}

interface ProductVariantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  variants: ProductVariant[];
  onSelectVariant?: (variant: ProductVariant) => void;
  onAddToCart?: (variant: ProductVariant, quantity: number, addons?: ProductAddon[]) => void;
  productName?: string;
  productBasePrice?: number;
  addons?: ProductAddon[];
}

type Step = 'variants' | 'addons' | 'optional' | 'review';

export default function ProductVariantsModal({
  isOpen,
  onClose,
  variants,
  onSelectVariant,
  onAddToCart,
  productName = "المنتج",
  productBasePrice = 0,
  addons = []
}: ProductVariantsModalProps) {
  const [step, setStep] = useState<Step>('variants');
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<{[key: number | string]: boolean}>({});
  const [addonQuantities, setAddonQuantities] = useState<{[key: number | string]: number}>({});
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const groupedAddons = {
    required: addons.filter(addon => addon.is_required),
    default: addons.filter(addon => !addon.is_required && addon.is_default),
    optional: addons.filter(addon => !addon.is_required && !addon.is_default)
  };

  useEffect(() => {
    if (isOpen) {
      setStep('variants');
      setSelectedVariant(null);
      setSelectedAddons({});
      setAddonQuantities({});
      setQuantity(1);
      setError(null);

      const defaultSelected: {[key: number | string]: boolean} = {};
      const defaultQuantities: {[key: number | string]: number} = {};

      addons.forEach(addon => {
        if (addon.is_required || addon.is_default) {
          defaultSelected[addon.id] = true;
          defaultQuantities[addon.id] = 1;
        }
      });

      setSelectedAddons(defaultSelected);
      setAddonQuantities(defaultQuantities);
    }
  }, [isOpen, addons]);

  const handleVariantSelect = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setError(null);
    if (onSelectVariant) {
      onSelectVariant(variant);
    }
  };

  const handleNextFromVariants = () => {
    if (!selectedVariant) {
      setError('يجب اختيار نوع من الأنواع المتاحة');
      return;
    }
    setError(null);
    setStep('addons');
  };

  const handleNextFromAddons = () => {
    setError(null);
    // Check if there are optional addons
    if (groupedAddons.optional.length > 0) {
      setStep('optional');
    } else {
      setStep('review');
    }
  };

  const handleNextFromOptional = () => {
    setError(null);
    setStep('review');
  };

  const handleBack = () => {
    if (step === 'addons') {
      setStep('variants');
    } else if (step === 'optional') {
      setStep('addons');
    } else if (step === 'review') {
      if (groupedAddons.optional.length > 0) {
        setStep('optional');
      } else {
        setStep('addons');
      }
    }
    setError(null);
  };

  const handleAddonToggle = (addonId: number | string) => {
    const addon = addons.find(a => a.id === addonId);
    if (addon?.is_required) {
      return;
    }

    setSelectedAddons(prev => {
      const newSelected = { ...prev };
      if (newSelected[addonId]) {
        delete newSelected[addonId];
        setAddonQuantities(prevQty => {
          const newQty = { ...prevQty };
          delete newQty[addonId];
          return newQty;
        });
      } else {
        newSelected[addonId] = true;
        setAddonQuantities(prevQty => ({
          ...prevQty,
          [addonId]: 1
        }));
      }
      return newSelected;
    });
  };

  const handleAddonQuantityChange = (addonId: number | string, change: number) => {
    setAddonQuantities(prev => {
      const currentQuantity = prev[addonId] || 1;
      const newQuantity = Math.max(1, currentQuantity + change);
      return {
        ...prev,
        [addonId]: newQuantity
      };
    });
  };

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 1) {
      setQuantity(newQuantity);
    }
  };

  const handleAddToCart = () => {
    if (!selectedVariant) {
      setError('يجب اختيار نوع من الأنواع المتاحة');
      return;
    }

    const selectedAddonsList = addons
      .filter(addon => selectedAddons[addon.id])
      .map(addon => ({
        ...addon,
        quantity: addonQuantities[addon.id] || 1
      }));

    if (onAddToCart) {
      onAddToCart(selectedVariant, quantity, selectedAddonsList);
    }

    onClose();
  };

  const calculateTotal = () => {
    if (!selectedVariant) return 0;

    let total = selectedVariant.price * quantity;

    addons.forEach(addon => {
      if (selectedAddons[addon.id]) {
        const addonQty = addonQuantities[addon.id] || 1;
        total += addon.price * addonQty * quantity;
      }
    });

    return total;
  };

  const totalPrice = calculateTotal();

  const getStepTitle = () => {
    switch (step) {
      case 'variants':
        return 'الخطوة 1: اختر النوع';
      case 'addons':
        return 'الخطوة 2: المكونات والإضافات الإجبارية';
      case 'optional':
        return 'الخطوة 3: الإضافات الاختيارية';
      case 'review':
        return groupedAddons.optional.length > 0 ? 'الخطوة 4: المراجعة والإضافة' : 'الخطوة 3: المراجعة والإضافة';
      default:
        return '';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Red Card Container matching SingleProductPage style */}
            <div className="bg-[#B91C1C] rounded-3xl shadow-2xl overflow-hidden">
              <div className="bg-white m-1 rounded-[22px] flex flex-col max-h-[83vh]">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 p-4 rounded-t-[22px] z-10">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={step === 'variants' ? onClose : handleBack}
                      className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      {step === 'variants' ? <X className="w-5 h-5 text-gray-700" /> : <ArrowRight className="w-5 h-5 text-gray-700" />}
                    </button>

                    <h3 className="text-lg font-bold text-gray-900 flex-1 text-center">
                      {getStepTitle()}
                    </h3>

                    <div className="w-10 h-10" />
                  </div>

                  {/* Progress Bar */}
                  <div className="flex items-center gap-2">
                    <div className={`flex-1 h-2 rounded-full ${step === 'variants' ? 'bg-brand' : 'bg-gray-200'}`} />
                    <div className={`flex-1 h-2 rounded-full ${step === 'addons' ? 'bg-brand' : step === 'optional' || step === 'review' ? 'bg-brand' : 'bg-gray-200'}`} />
                    {groupedAddons.optional.length > 0 && (
                      <div className={`flex-1 h-2 rounded-full ${step === 'optional' ? 'bg-brand' : step === 'review' ? 'bg-brand' : 'bg-gray-200'}`} />
                    )}
                    <div className={`flex-1 h-2 rounded-full ${step === 'review' ? 'bg-brand' : 'bg-gray-200'}`} />
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mx-4 mt-3 p-3 bg-red-50 border-2 border-red-200 rounded-xl flex items-center gap-2"
                  >
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-red-800 font-medium text-sm">{error}</p>
                  </motion.div>
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4" style={{ paddingBottom: 'calc(80px + max(env(safe-area-inset-bottom), 8px))' }}>
              <AnimatePresence mode="wait">
                {step === 'variants' && (
                  <motion.div
                    key="variants"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-2"
                  >
                    <div className="bg-blue-50 p-2 rounded-lg border border-blue-300">
                      <p className="text-blue-900 font-bold text-xs">اختر نوع واحد من الأنواع المتاحة</p>
                    </div>

                    {variants.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() => handleVariantSelect(variant)}
                        className={`w-full p-3 rounded-lg border-2 transition-all ${
                          selectedVariant?.id === variant.id
                            ? 'bg-green-50 border-green-500 shadow-lg'
                            : 'bg-white border-gray-200 hover:border-brand/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              selectedVariant?.id === variant.id
                                ? 'border-green-500 bg-green-500'
                                : 'border-gray-300'
                            }`}>
                              {selectedVariant?.id === variant.id && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="font-bold text-gray-900 text-sm">{variant.name}</span>
                          </div>
                          <span className="font-bold text-brand text-sm">{variant.price.toFixed(2)} شيكل</span>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}

                {step === 'addons' && (
                  <motion.div
                    key="addons"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-3"
                  >
                    <div className="bg-green-50 p-3 rounded-lg border-2 border-green-500">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-600">النوع المحدد</p>
                          <p className="font-bold text-gray-900">{selectedVariant?.name}</p>
                        </div>
                        <span className="font-bold text-brand">{selectedVariant?.price.toFixed(2)} شيكل</span>
                      </div>
                    </div>

                    {groupedAddons.required.length > 0 && (
                      <div className="bg-white rounded-lg p-3 border-2 border-red-200">
                        <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-red-600" />
                          الإضافات المطلوبة
                        </h4>
                        <p className="text-xs text-red-700 mb-3 bg-red-50 p-2 rounded">هذه الإضافات مطلوبة ولا يمكن إلغاؤها</p>

                        <div className={`space-y-2 ${groupedAddons.required.length > 4 ? 'max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100' : ''}`}>
                          {groupedAddons.required.map((addon) => (
                            <div key={addon.id} className="bg-red-50 p-3 rounded-lg border border-red-200">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <div className="w-6 h-6 rounded-full bg-red-600 border-2 border-red-600 flex items-center justify-center">
                                    <Check className="w-4 h-4 text-white" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-gray-900">{addon.name}</p>
                                    {addon.price > 0 && <p className="text-xs text-gray-600">+{addon.price} شيكل</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleAddonQuantityChange(addon.id, -1)}
                                    className="w-7 h-7 rounded-full bg-white border border-gray-300 flex items-center justify-center"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <span className="w-8 text-center font-bold">{addonQuantities[addon.id] || 1}</span>
                                  <button
                                    onClick={() => handleAddonQuantityChange(addon.id, 1)}
                                    className="w-7 h-7 rounded-full bg-white border border-gray-300 flex items-center justify-center"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {groupedAddons.default.length > 0 && (
                      <div className="bg-white rounded-lg p-3 border-2 border-green-200">
                        <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                          <Check className="w-5 h-5 text-green-600" />
                          المكونات
                        </h4>
                        <p className="text-xs text-gray-600 mb-3">محددة مسبقاً - يمكنك إلغاؤها أو تغيير الكمية</p>

                        <div className={`space-y-2 ${groupedAddons.default.length > 4 ? 'max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100' : ''}`}>
                          {groupedAddons.default.map((addon) => (
                            <div
                              key={addon.id}
                              onClick={() => handleAddonToggle(addon.id)}
                              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                selectedAddons[addon.id]
                                  ? 'bg-brand/10 border-brand'
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                    selectedAddons[addon.id]
                                      ? 'border-brand bg-brand'
                                      : 'border-gray-300'
                                  }`}>
                                    {selectedAddons[addon.id] && <Check className="w-4 h-4 text-white" />}
                                  </div>
                                  <div>
                                    <p className="font-bold text-gray-900">{addon.name}</p>
                                    {addon.price > 0 && <p className="text-xs text-gray-600">+{addon.price} شيكل</p>}
                                  </div>
                                </div>
                                {selectedAddons[addon.id] && (
                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => handleAddonQuantityChange(addon.id, -1)}
                                      className="w-7 h-7 rounded-full bg-white border border-gray-300 flex items-center justify-center"
                                    >
                                      <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="w-8 text-center font-bold">{addonQuantities[addon.id] || 1}</span>
                                    <button
                                      onClick={() => handleAddonQuantityChange(addon.id, 1)}
                                      className="w-7 h-7 rounded-full bg-white border border-gray-300 flex items-center justify-center"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </motion.div>
                )}

                {step === 'optional' && (
                  <motion.div
                    key="optional"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-3"
                  >
                    <div className="bg-blue-50 p-3 rounded-lg border-2 border-blue-300">
                      <p className="text-blue-900 font-bold text-sm">اختر الإضافات التي تريدها (اختياري)</p>
                    </div>

                    <div className="bg-white rounded-lg p-3 border-2 border-blue-200">
                      <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-blue-600" />
                        الإضافات الاختيارية
                      </h4>
                      <p className="text-xs text-gray-600 mb-3">اختياري - يمكنك اختيار ما تريد</p>

                      <div className={`space-y-2 ${groupedAddons.optional.length > 4 ? 'max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100' : ''}`}>
                        {groupedAddons.optional.map((addon) => (
                          <div
                            key={addon.id}
                            onClick={() => handleAddonToggle(addon.id)}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              selectedAddons[addon.id]
                                ? 'bg-brand/10 border-brand'
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1">
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                  selectedAddons[addon.id]
                                    ? 'border-brand bg-brand'
                                    : 'border-gray-300'
                                }`}>
                                  {selectedAddons[addon.id] && <Check className="w-4 h-4 text-white" />}
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900">{addon.name}</p>
                                  {addon.price > 0 && <p className="text-xs text-gray-600">+{addon.price} شيكل</p>}
                                </div>
                              </div>
                              {selectedAddons[addon.id] && (
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleAddonQuantityChange(addon.id, -1)}
                                    className="w-7 h-7 rounded-full bg-white border border-gray-300 flex items-center justify-center"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <span className="w-8 text-center font-bold">{addonQuantities[addon.id] || 1}</span>
                                  <button
                                    onClick={() => handleAddonQuantityChange(addon.id, 1)}
                                    className="w-7 h-7 rounded-full bg-white border border-gray-300 flex items-center justify-center"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 'review' && (
                  <motion.div
                    key="review"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-3"
                  >
                    <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-300">
                      <p className="text-blue-900 font-bold text-sm mb-2">راجع طلبك قبل الإضافة للسلة</p>
                    </div>

                    <div className="bg-white rounded-lg p-3 border-2 border-green-500">
                      <h4 className="text-xs text-gray-600 mb-1">النوع المحدد</h4>
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-gray-900">{selectedVariant?.name}</p>
                        <span className="font-bold text-brand">{selectedVariant?.price.toFixed(2)} شيكل</span>
                      </div>
                    </div>

                    {Object.keys(selectedAddons).length > 0 && (
                      <div className="bg-white rounded-lg p-3 border-2 border-gray-200">
                        <h4 className="font-bold text-gray-900 mb-2">الإضافات المحددة</h4>
                        <div className="space-y-2">
                          {addons
                            .filter(addon => selectedAddons[addon.id])
                            .map((addon) => (
                              <div key={addon.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{addon.name}</p>
                                  <p className="text-xs text-gray-600">الكمية: {addonQuantities[addon.id] || 1}</p>
                                </div>
                                <span className="text-sm font-bold text-brand">
                                  +{(addon.price * (addonQuantities[addon.id] || 1)).toFixed(2)} شيكل
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-white rounded-lg p-3 border-2 border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-bold text-gray-900">الكمية</p>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleQuantityChange(quantity - 1)}
                            className="w-8 h-8 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-bold text-lg">{quantity}</span>
                          <button
                            onClick={() => handleQuantityChange(quantity + 1)}
                            className="w-8 h-8 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Add to Cart Button - directly under review */}
                    <div className="pt-2">
                      <div className="flex justify-between items-center mb-2 p-2 bg-gray-50 rounded-lg">
                        <span className="font-bold text-gray-700 text-sm">المجموع:</span>
                        <span className="font-bold text-lg text-brand">{totalPrice.toFixed(2)} شيكل</span>
                      </div>

                      <button
                        onClick={handleAddToCart}
                        className="w-full py-2.5 rounded-lg font-bold bg-green-600 text-white hover:bg-green-700 shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        إضافة للسلة
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
                </div>

                {/* Bottom Action Bar - Fixed at bottom */}
                {step !== 'review' && (
                  <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 rounded-b-[22px]">
                    {/* Total Price */}
                    <div className="flex justify-between items-center mb-3 p-3 bg-gray-50 rounded-xl">
                      <span className="font-bold text-gray-700">المجموع:</span>
                      <span className="font-bold text-xl text-brand">{totalPrice.toFixed(2)} شيكل</span>
                    </div>

                    <button
                      onClick={step === 'variants' ? handleNextFromVariants : step === 'addons' ? handleNextFromAddons : handleNextFromOptional}
                      disabled={step === 'variants' && !selectedVariant}
                      className={`w-full py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${
                        step === 'variants' && !selectedVariant
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-brand text-white hover:bg-brand-light'
                      }`}
                    >
                      {step === 'variants' ? 'التالي: المكونات والإضافات' : step === 'addons' ? (groupedAddons.optional.length > 0 ? 'التالي: الإضافات الاختيارية' : 'التالي: المراجعة') : 'التالي: المراجعة'}
                      <ArrowRight className="w-5 h-5 rotate-180" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
