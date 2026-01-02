import React, { useState, useEffect } from 'react';
import { Search, X, MapPin, Store, Package, TrendingUp, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface ServiceArea {
  id: string;
  name: string;
  status: 'active' | 'coming_soon';
}

interface SearchResult {
  id: number;
  name: string;
  type: 'vendor' | 'product';
  image?: string;
  vendor_name?: string;
  price?: number;
  category?: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVendorSelect?: (vendorId: number) => void;
  onProductSelect?: (productId: number) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onVendorSelect,
  onProductSelect
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [popularSearches] = useState<string[]>(['بيتزا', 'برجر', 'شاورما', 'حلويات', 'مشروبات']);

  useEffect(() => {
    const loadServiceAreas = async () => {
      try {
        const { data, error } = await supabase
          .from('service_areas')
          .select('*')
          .order('name');

        if (error) throw error;
        setServiceAreas(data || []);

        // Set default zone from localStorage
        const storedZone = localStorage.getItem('selectedCity');
        if (storedZone) {
          const parsedZone = JSON.parse(storedZone);
          const zone = data?.find(area => area.name === parsedZone);
          if (zone) {
            setSelectedZone(zone.name);
          }
        }
      } catch (error) {
        console.error('Error loading service areas:', error);
      }
    };

    loadServiceAreas();

    // Load recent searches
    const stored = localStorage.getItem('recentSearches');
    if (stored) {
      setRecentSearches(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);

      try {
        console.log('🔍 Search started:', { searchQuery, selectedZone });

        // Build vendor query
        let vendorQuery = supabase
          .from('vendors')
          .select('id, store_name, logo_url, type, service_areas')
          .ilike('store_name', `%${searchQuery}%`)
          .eq('status', 'active');

        // Filter by zone if selected
        if (selectedZone) {
          vendorQuery = vendorQuery.contains('service_areas', [selectedZone]);
        }

        const { data: vendors, error: vendorsError } = await vendorQuery.limit(5);

        if (vendorsError) {
          console.error('❌ Vendors query error:', vendorsError);
          throw vendorsError;
        }

        console.log('✅ Vendors found:', vendors?.length || 0, vendors);

        // Build products query with vendor zone filter
        let productsQuery = supabase
          .from('products')
          .select('id, name, price, image_url, vendor:vendor_id(id, store_name, service_areas, status)')
          .ilike('name', `%${searchQuery}%`)
          .eq('status', 'active');

        const { data: products, error: productsError } = await productsQuery.limit(20);

        if (productsError) {
          console.error('❌ Products query error:', productsError);
        }

        console.log('📦 Products found (before filter):', products?.length || 0, products);

        // Filter products by zone if selected and vendor is active
        let filteredProducts = products || [];
        if (selectedZone) {
          filteredProducts = filteredProducts.filter((p: any) => {
            const hasServiceArea = p.vendor?.service_areas &&
                                  Array.isArray(p.vendor.service_areas) &&
                                  p.vendor.service_areas.includes(selectedZone);
            const isVendorActive = p.vendor?.status === 'active';
            console.log(`Product "${p.name}":`, {
              vendorName: p.vendor?.store_name,
              serviceAreas: p.vendor?.service_areas,
              hasServiceArea,
              vendorStatus: p.vendor?.status,
              isVendorActive
            });
            return hasServiceArea && isVendorActive;
          });
        } else {
          // If no zone selected, still filter by vendor status
          filteredProducts = filteredProducts.filter((p: any) => p.vendor?.status === 'active');
        }

        console.log('📦 Products found (after filter):', filteredProducts.length);

        const results: SearchResult[] = [
          ...(vendors || []).map((v: any) => ({
            id: v.id,
            name: v.store_name,
            type: 'vendor' as const,
            image: v.logo_url,
            category: v.type
          })),
          ...filteredProducts.map((p: any) => ({
            id: p.id,
            name: p.name,
            type: 'product' as const,
            image: p.image_url,
            vendor_name: p.vendor?.store_name,
            price: p.price
          }))
        ];

        console.log('✅ Total results:', results.length);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(performSearch, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, selectedZone]);

  const handleSearchSubmit = (query: string) => {
    if (query.trim()) {
      // Save to recent searches
      const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'vendor' && onVendorSelect) {
      onVendorSelect(result.id);
    } else if (result.type === 'product' && onProductSelect) {
      onProductSelect(result.id);
    }
    handleSearchSubmit(result.name);
    onClose();
  };

  const handleZoneChange = (zoneName: string) => {
    setSelectedZone(zoneName);
    localStorage.setItem('selectedCity', JSON.stringify(zoneName));
    window.dispatchEvent(new Event('storage'));
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white rounded-b-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: '90vh',
          paddingTop: 'max(env(safe-area-inset-top), 0px)'
        }}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-[#c21d14] to-[#8b1a1a] px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors backdrop-blur-sm"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <h2 className="text-xl font-bold text-white">البحث</h2>
          </div>

          {/* Zone Display */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-white/80" />
                <span className="text-white/80 text-sm">منطقة التوصيل</span>
              </div>
              <span className="text-white font-bold text-lg">{selectedZone || 'اختر المنطقة'}</span>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن مطاعم أو منتجات..."
              className="w-full bg-white rounded-2xl pl-4 pr-12 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 shadow-lg transition-all"
              autoFocus
            />
            {isSearching && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-[#c21d14] rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 240px)' }}>
          {searchQuery.trim() && searchResults.length > 0 ? (
            <div className="p-4">
              <h3 className="text-sm font-bold text-gray-500 mb-3 px-2">نتائج البحث</h3>
              <div className="space-y-2">
                {searchResults.map((result) => (
                  <motion.button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-right"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border-2 border-gray-100">
                      {result.image ? (
                        <img
                          src={result.image}
                          alt={result.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {result.type === 'vendor' ? (
                            <Store className="w-7 h-7 text-gray-400" />
                          ) : (
                            <Package className="w-7 h-7 text-gray-400" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 truncate">{result.name}</h4>
                      {result.type === 'vendor' ? (
                        <p className="text-sm text-gray-500">{result.category || 'متجر'}</p>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-500 truncate">{result.vendor_name}</p>
                          {result.price && (
                            <p className="text-sm font-bold text-[#c21d14]">
                              {result.price.toFixed(2)} ₪
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    {result.type === 'vendor' && (
                      <Store className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          ) : searchQuery.trim() && !isSearching ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500">لا توجد نتائج</p>
              <p className="text-sm text-gray-400 mt-1">جرب البحث بكلمات أخرى</p>
            </div>
          ) : (
            <div className="p-4 space-y-6">
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 px-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <h3 className="text-sm font-bold text-gray-500">عمليات البحث الأخيرة</h3>
                  </div>
                  <div className="space-y-1">
                    {recentSearches.map((term, index) => (
                      <button
                        key={index}
                        onClick={() => setSearchQuery(term)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-right"
                      >
                        <Search className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{term}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Searches */}
              <div>
                <div className="flex items-center gap-2 mb-3 px-2">
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-bold text-gray-500">عمليات البحث الشائعة</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {popularSearches.map((term, index) => (
                    <button
                      key={index}
                      onClick={() => setSearchQuery(term)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SearchModal;
