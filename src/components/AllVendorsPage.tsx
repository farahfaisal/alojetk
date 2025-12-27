import React, { useState, useEffect } from 'react';
import { X, Search, Filter, ChevronDown, ChevronLeft, Star, MapPin, Clock, Store } from 'lucide-react';
import { motion } from 'framer-motion';
import VendorsList from './VendorsList';
import BottomNav from './BottomNav';
import FeaturedSlider from './FeaturedSlider';
import { supabase } from '../lib/supabase';
import StorePage from './StorePage';

interface AllVendorsPageProps {
  onClose: () => void;
  selectedCity: string;
  viewMode: 'restaurants' | 'supermarket' | 'all';
  onViewModeChange: (mode: 'restaurants' | 'supermarket' | 'all') => void;
  onOpenCart: () => void;
  onOpenAccount: () => void;
  onOpenOrders: () => void;
}

interface Vendor {
  id: string;
  store_name: string;
  logo_url?: string;
  banner_url?: string;
  rating?: number;
  rating_count?: number;
  status: string;
  address?: string;
  city?: string;
  type?: string;
}

const AllVendorsPage: React.FC<AllVendorsPageProps> = ({
  onClose,
  selectedCity,
  viewMode,
  onViewModeChange,
  onOpenCart,
  onOpenAccount,
  onOpenOrders
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'newest' | 'rating'>('featured');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [viewType, setViewType] = useState<'grid' | 'list'>('list');

  // Fetch vendors when component mounts
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Map UI type to database type
        let dbType = null;
        if (viewMode === 'restaurants') dbType = 'مطاعم';
        if (viewMode === 'supermarket') dbType = 'ماركت';
        
        // Build query for vendors
        let query = supabase
          .from('vendors')
          .select('*');
          
        // Apply type filter if not 'all'
        if (dbType) {
          query = query.eq('type', dbType);
        }
        
        // Apply search filter if provided
        if (searchQuery.trim()) {
          query = query.ilike('store_name', `%${searchQuery}%`);
        }
        
        // Apply sorting
        switch (sortBy) {
          case 'newest':
            query = query.order('created_at', { ascending: false });
            break;
          case 'rating':
            query = query.order('rating', { ascending: false, nullsLast: true });
            break;
          case 'featured':
          default:
            query = query.order('featured_order', { ascending: true, nullsLast: true })
                        .order('rating', { ascending: false, nullsLast: true });
            break;
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        setVendors(data || []);
      } catch (err) {
        console.error('Error fetching vendors:', err);
        setError('حدث خطأ في جلب المتاجر');
      } finally {
        setLoading(false);
      }
    };

    fetchVendors();
  }, [viewMode, searchQuery, sortBy]);

  const handleVendorClick = (vendor: Vendor) => {
    setSelectedVendor(vendor);
  };

  const renderVendorList = () => {
    if (loading) {
      return (
        <div className="space-y-4 py-4">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="bg-white rounded-lg p-4 shadow-sm animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 text-red-800 p-4 rounded-lg my-4">
          <p>{error}</p>
        </div>
      );
    }

    if (vendors.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-300">
            <Store className="w-full h-full" />
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">لا توجد متاجر</h3>
          <p className="text-gray-500">لم يتم العثور على متاجر تطابق معايير البحث</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 py-4">
        {vendors.map((vendor) => (
          <motion.div
            key={vendor.id}
            whileHover={{ scale: 1.01 }}
            onClick={() => handleVendorClick(vendor)}
            className="bg-white rounded-lg p-4 border border-gray-200 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-white flex-shrink-0 border-2 border-gray-100">
                {vendor.logo_url ? (
                  <img
                    src={vendor.logo_url}
                    alt={`${vendor.store_name} logo`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://via.placeholder.com/100?text=${vendor.store_name.charAt(0)}`;
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-accent flex items-center justify-center text-white font-bold text-2xl">
                    {vendor.store_name.charAt(0)}
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg">{vendor.store_name}</h3>

                <div className="flex items-center gap-2 mt-0.5">
                  {vendor.rating && (
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span>{vendor.rating.toFixed(1)}</span>
                    </div>
                  )}
                  
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    vendor.status === 'active'
                      ? 'bg-green-500/90 text-white'
                      : vendor.status === 'busy'
                        ? 'bg-orange-500/90 text-white'
                        : vendor.status === 'suspended'
                          ? 'bg-red-500/90 text-white'
                          : 'bg-gray-500/90 text-white'
                  }`}>
                    {vendor.status === 'active' ? 'مفتوح' :
                     vendor.status === 'busy' ? 'مشغول' :
                     vendor.status === 'suspended' ? 'معلق' : 'مغلق'}
                  </span>
                  
                  {vendor.type && (
                    <span className="bg-brand/10 text-accent text-xs px-2 py-0.5 rounded-full">
                      {vendor.type === 'مطاعم' ? 'مطعم' : 
                       vendor.type === 'ماركت' ? 'الـو جيتك' : vendor.type}
                    </span>
                  )}
                </div>
                
                {vendor.address && (
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                    <MapPin className="w-3 h-3" />
                    <span>{vendor.address}</span>
                    {vendor.city && <span>، {vendor.city}</span>}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-[99999] flex flex-col" data-store-page="true" style={{
      paddingTop: 'max(env(safe-area-inset-top), 0px)'
    }}>
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto">
          <div className="p-4 flex items-center justify-between">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="font-medium">رجوع</span>
            </button>
            <h2 className="text-xl font-bold text-gray-900">
              {viewMode === 'restaurants' ? 'جميع المطاعم' : 
               viewMode === 'supermarket' ? 'جميع المتاجر' : 
               'جميع المتاجر'}
            </h2>
            <div className="w-[80px]"></div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto modal-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Featured Slider */}
        <div className="-mx-4">
          <FeaturedSlider />
        </div>

        {/* Search and Filters */}
        <div className="bg-white shadow-sm">
          <div className="max-w-md mx-auto p-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث عن متاجر..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pr-10 bg-gray-50 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            </div>

            {/* Filters */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 text-accent"
              >
                <Filter className="w-5 h-5" />
                <span className="font-medium">تصفية</span>
              </button>
              <motion.button
                animate={{ rotate: showFilters ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-5 h-5 text-gray-500" />
              </motion.button>
            </div>

            {/* Filter Options */}
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-4 pt-4 border-t"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ترتيب حسب
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="featured">المميزة</option>
                    <option value="newest">الأحدث</option>
                    <option value="rating">التقييم</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    طريقة العرض
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewType('grid')}
                      className={`flex-1 py-2 px-4 rounded-lg border ${
                        viewType === 'grid' 
                          ? 'bg-brand text-accent border-brand' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      شبكة
                    </button>
                    <button
                      onClick={() => setViewType('list')}
                      className={`flex-1 py-2 px-4 rounded-lg border ${
                        viewType === 'list' 
                          ? 'bg-brand text-accent border-brand' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      قائمة
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Vendors List */}
        <div className="w-full p-4" style={{
          paddingBottom: 'calc(120px + max(env(safe-area-inset-bottom), 8px))'
        }}>
          {viewType === 'list' ? (
            renderVendorList()
          ) : (
            <VendorsList
              selectedCategory={null}
              selectedCity={selectedCity}
              sortBy={sortBy}
              type={viewMode === 'restaurants' ? 'restaurant' : 
                    viewMode === 'supermarket' ? 'supermarket' : 'all'}
            />
          )}
        </div>
      </div>

      {/* Vendor Page Modal */}
      {selectedVendor && (
        <StorePage
          vendor={{
            id: selectedVendor.id,
            store_name: selectedVendor.store_name,
            banner: selectedVendor.banner_url,
            logo: selectedVendor.logo_url,
            rating: selectedVendor.rating,
            status: selectedVendor.status
          }}
          categoryId={null}
          onClose={() => setSelectedVendor(null)}
        />
      )}
    </div>
  );
};

export default AllVendorsPage;