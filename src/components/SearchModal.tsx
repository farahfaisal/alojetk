import React, { useState, useEffect, useCallback } from 'react';
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
  service_areas?: string[];
  vendor_service_areas?: string[];
  main_area?: string;
  vendor_main_area?: string;
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
  const [displayedZone, setDisplayedZone] = useState<string>('');
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [popularSearches] = useState<string[]>(['بيتزا', 'برجر', 'شاورما', 'حلويات', 'مشروبات']);

  const getMainArea = useCallback(async (areaName: string): Promise<string> => {
    try {
      const { data: area } = await supabase
        .from('service_areas')
        .select('id, name, parent_id, city')
        .eq('name', areaName)
        .maybeSingle();

      if (!area) return areaName;

      if (!area.parent_id) {
        return area.name;
      }

      const { data: parentArea } = await supabase
        .from('service_areas')
        .select('name')
        .eq('id', area.parent_id)
        .maybeSingle();

      return parentArea?.name || area.name;
    } catch (error) {
      console.error('Error getting main area:', error);
      return areaName;
    }
  }, []);

  const getAllSubAreas = useCallback(async (areaName: string): Promise<string[]> => {
    try {
      // Get the selected area
      const { data: selectedArea } = await supabase
        .from('service_areas')
        .select('id, name, parent_id')
        .eq('name', areaName)
        .maybeSingle();

      if (!selectedArea) return [areaName];

      // Find the main (parent) area
      let mainAreaId = selectedArea.id;
      let mainAreaName = selectedArea.name;

      // If this is a sub-area, get the parent area
      if (selectedArea.parent_id) {
        const { data: parentArea } = await supabase
          .from('service_areas')
          .select('id, name')
          .eq('id', selectedArea.parent_id)
          .maybeSingle();

        if (parentArea) {
          mainAreaId = parentArea.id;
          mainAreaName = parentArea.name;
        }
      }

      // Get all sub-areas with this parent_id
      const { data: subAreas } = await supabase
        .from('service_areas')
        .select('name')
        .eq('parent_id', mainAreaId);

      // Return main area + all sub-areas
      const allAreas = [mainAreaName];
      if (subAreas && subAreas.length > 0) {
        allAreas.push(...subAreas.map(area => area.name));
      }

      console.log(`📍 getAllSubAreas for "${areaName}":`, {
        selectedArea: areaName,
        mainArea: mainAreaName,
        allAreas
      });

      return allAreas;
    } catch (error) {
      console.error('Error getting sub areas:', error);
      return [areaName];
    }
  }, []);

  useEffect(() => {
    const loadServiceAreas = async () => {
      try {
        const { data, error } = await supabase
          .from('service_areas')
          .select('*')
          .order('name');

        if (error) throw error;

        // Filter to show only main areas (no parent_id) in the dropdown
        const mainAreas = data?.filter(area => !area.parent_id) || [];
        setServiceAreas(mainAreas);

        // Set default zone from localStorage
        const storedZone = localStorage.getItem('selectedCity');
        if (storedZone) {
          const parsedZone = JSON.parse(storedZone);

          // Get main area for the stored zone
          const mainArea = await getMainArea(parsedZone);
          setSelectedZone(mainArea);
          setDisplayedZone(mainArea);
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
  }, [getMainArea]);

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);

      try {
        console.log('🔍 Search started:', { searchQuery, selectedZone });

        // Get area IDs for filtering
        let searchAreaIds: string[] = [];
        if (selectedZone) {
          const searchAreas = await getAllSubAreas(selectedZone);
          console.log('📍 Search areas (names):', searchAreas);

          const { data: areaData } = await supabase
            .from('service_areas')
            .select('id, name')
            .in('name', searchAreas);

          searchAreaIds = areaData?.map(a => a.id) || [];
          console.log('📍 Search area IDs:', searchAreaIds);
        }

        // Build vendor query
        let vendorQuery = supabase
          .from('vendors')
          .select('id, store_name, logo_url, type, service_areas, main_service_area_id')
          .ilike('store_name', `%${searchQuery}%`)
          .eq('status', 'active');

        const { data: allVendors, error: vendorsError } = await vendorQuery.limit(50);

        if (vendorsError) {
          console.error('❌ Vendors query error:', vendorsError);
          throw vendorsError;
        }

        console.log('📦 All vendors before filter:', allVendors?.length || 0);

        // Filter vendors by zone (including sub-areas)
        let vendors = allVendors || [];
        if (selectedZone && searchAreaIds.length > 0) {
          console.log('🔍 Filtering vendors - Search Area IDs:', searchAreaIds);

          vendors = vendors.filter((v: any) => {
            // Check main_service_area_id first (most reliable)
            const hasMainArea = v.main_service_area_id && searchAreaIds.includes(v.main_service_area_id);

            console.log(`✓ Vendor "${v.store_name}":`, {
              main_service_area_id: v.main_service_area_id,
              searchAreaIds: searchAreaIds,
              isInSearchArea: hasMainArea,
              willShow: hasMainArea ? 'YES ✓' : 'NO ✗'
            });

            return hasMainArea;
          });
        }

        console.log('✅ Vendors found after filter:', vendors?.length || 0, vendors);

        // Build products query with vendor zone filter
        let productsQuery = supabase
          .from('products')
          .select('id, name, price, image_url, vendor:vendor_id(id, store_name, service_areas, main_service_area_id, status)')
          .ilike('name', `%${searchQuery}%`)
          .eq('status', 'active');

        const { data: products, error: productsError } = await productsQuery.limit(20);

        if (productsError) {
          console.error('❌ Products query error:', productsError);
        }

        console.log('📦 Products found (before filter):', products?.length || 0);

        // Filter products by zone if selected and vendor is active
        let filteredProducts = products || [];
        if (selectedZone && searchAreaIds.length > 0) {
          filteredProducts = filteredProducts.filter((p: any) => {
            const hasMainServiceArea = p.vendor?.main_service_area_id &&
                                       searchAreaIds.includes(p.vendor.main_service_area_id);
            const isVendorActive = p.vendor?.status === 'active';

            return hasMainServiceArea && isVendorActive;
          });
        } else {
          // If no zone selected, still filter by vendor status
          filteredProducts = filteredProducts.filter((p: any) => p.vendor?.status === 'active');
        }

        console.log('📦 Products found (after filter):', filteredProducts.length);

        // Get main areas for vendors and products
        const vendorResults = await Promise.all((vendors || []).map(async (v: any) => {
          const firstArea = v.service_areas && v.service_areas.length > 0 ? v.service_areas[0] : '';
          const mainArea = firstArea ? await getMainArea(firstArea) : '';
          return {
            id: v.id,
            name: v.store_name,
            type: 'vendor' as const,
            image: v.logo_url,
            category: v.type,
            service_areas: v.service_areas || [],
            main_area: mainArea
          };
        }));

        const productResults = await Promise.all(filteredProducts.map(async (p: any) => {
          const firstArea = p.vendor?.service_areas && p.vendor.service_areas.length > 0 ? p.vendor.service_areas[0] : '';
          const mainArea = firstArea ? await getMainArea(firstArea) : '';
          return {
            id: p.id,
            name: p.name,
            type: 'product' as const,
            image: p.image_url,
            vendor_name: p.vendor?.store_name,
            price: p.price,
            vendor_service_areas: p.vendor?.service_areas || [],
            vendor_main_area: mainArea
          };
        }));

        const results: SearchResult[] = [...vendorResults, ...productResults];

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
  }, [searchQuery, selectedZone, getMainArea, getAllSubAreas]);

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

  const handleZoneChange = async (zoneName: string) => {
    setSelectedZone(zoneName);

    if (zoneName) {
      localStorage.setItem('selectedCity', JSON.stringify(zoneName));
      localStorage.setItem('selectedServiceArea', zoneName);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('serviceAreaChanged', {
        detail: { areaName: zoneName }
      }));

      // Update displayed zone to main area
      const mainArea = await getMainArea(zoneName);
      setDisplayedZone(mainArea);
    } else {
      // Clear zone selection
      setDisplayedZone('');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/10 backdrop-blur-lg"
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
        <div className="bg-gradient-to-br from-[#1759cb] to-[#0f3d8a] px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors backdrop-blur-sm"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <h2 className="text-xl font-bold text-white">البحث</h2>
          </div>

          {/* Zone Selector */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 mb-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <MapPin className="w-4 h-4" />
                <span>منطقة البحث</span>
              </div>
              <span className="text-white font-bold text-sm">
                {displayedZone || 'جميع المناطق'}
              </span>
            </div>
            <select
              value={selectedZone}
              onChange={(e) => handleZoneChange(e.target.value)}
              className="w-full bg-white/20 backdrop-blur-sm text-white rounded-xl px-4 py-3 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all appearance-none cursor-pointer"
            >
              <option value="" className="bg-gray-800 text-white">جميع المناطق</option>
              {serviceAreas.map(area => (
                <option key={area.id} value={area.name} className="bg-gray-800 text-white">
                  {area.name}
                </option>
              ))}
            </select>
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
                <div className="w-5 h-5 border-2 border-gray-300 border-t-[#1759cb] rounded-full animate-spin" />
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
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-gray-900 truncate">{result.name}</h4>
                      </div>
                      {result.type === 'vendor' ? (
                        <div className="space-y-1">
                          <p className="text-sm text-gray-500">{result.category || 'متجر'}</p>
                          {result.main_area && (
                            <div className="flex items-center gap-1.5 bg-brand/10 rounded-lg px-2 py-1 w-fit">
                              <MapPin className="w-4 h-4 text-brand flex-shrink-0" />
                              <p className="text-sm text-brand font-bold truncate">
                                {result.main_area}
                                {result.service_areas && result.service_areas.length > 1 && ` +${result.service_areas.length - 1}`}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-sm text-gray-500 truncate">{result.vendor_name}</p>
                          <div className="flex items-center justify-between gap-2">
                            {result.vendor_main_area && (
                              <div className="flex items-center gap-1.5 bg-brand/10 rounded-lg px-2 py-1">
                                <MapPin className="w-4 h-4 text-brand flex-shrink-0" />
                                <p className="text-sm text-brand font-bold truncate">
                                  {result.vendor_main_area}
                                  {result.vendor_service_areas && result.vendor_service_areas.length > 1 && ` +${result.vendor_service_areas.length - 1}`}
                                </p>
                              </div>
                            )}
                            {result.price && (
                              <p className="text-sm font-bold text-[#1759cb] whitespace-nowrap">
                                {result.price.toFixed(2)} ₪
                              </p>
                            )}
                          </div>
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
