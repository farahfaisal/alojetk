import React, { useState, useEffect, useMemo } from 'react';
import { Home as HomeIcon, User, Store, Package, Bike, Circle, Menu, MapPin, Search, Clock, Headphones, ShoppingCart, Check, Star, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserRouter, useNavigate, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import LoginPage from './components/LoginPage';
import SplashScreen from './components/SplashScreen';
import OnboardingScreens from './components/OnboardingScreens';
import AddToCartPopup from './components/AddToCartPopup';
import { useAuth } from './contexts/AuthContext';
import BottomNav from './components/BottomNav';
import { PALESTINIAN_CITIES } from './lib/zones';
import AccountPage from './components/AccountPage';
import { supabase } from './lib/supabase';
import AllVendorsPage from './components/AllVendorsPage';
import Home from './pages/Home';
import Supermarket from './pages/Supermarket';
import FloatingCart from './components/FloatingCart';
import LoginPrompt from './components/LoginPrompt';
import NotificationCenter from './components/NotificationCenter';
import NotificationBadge from './components/NotificationBadge';
import PrivacyPolicy from './components/PrivacyPolicy';
import PermissionsPrompt from './components/PermissionsPrompt';
import ContactPage from './components/ContactPage';
import SignupPage from './components/SignupPage';
import BackButtonHandler from './components/BackButtonHandler';
import { ToastProvider } from './components/ToastProvider';
import { useToast } from './hooks/use-toast';
import ServiceAreaSelection from './components/ServiceAreaSelection';
import CartPage from './components/CartPage';
import OrdersPage from './components/OrdersPage';
import CaptainRequestPage from './components/CaptainRequestPage';
import CaptainRequestsTracking from './components/CaptainRequestsTracking';
import ParcelOrderPage from './components/ParcelOrderPage';
import ParcelOrdersTracking from './components/ParcelOrdersTracking';
import SearchModal from './components/SearchModal';
import CitySelector from './components/CitySelector';
import SingleProductPage from './components/SingleProductPage';
import StorePage from './components/StorePage';
import InstallPrompt from './components/InstallPrompt';
import AddressOrAreaSelector from './components/AddressOrAreaSelector';

interface ServiceArea {
  id: string;
  name: string;
  status: 'active' | 'coming_soon';
}

const AppContent: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    return hasSeenOnboarding !== 'true';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSubcategory, setSelectedSubcategory] = useState<number | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [signupReferralCode, setSignupReferralCode] = useState<string | undefined>(undefined);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false);
  const [isContactPageOpen, setIsContactPageOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'restaurants' | 'supermarket' | 'all'>('restaurants');
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState(() => {
    const stored = localStorage.getItem('selectedCity');
    return stored ? JSON.parse(stored) : 'يطا';
  });
  const [cartNotification, setCartNotification] = useState<{show: boolean; productName: string} | null>(null);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [cartPopupNotification, setCartPopupNotification] = useState<{show: boolean; productName: string} | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [showPermissionsPrompt, setShowPermissionsPrompt] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<any | null>(null);
  const { toast } = useToast();
  const [showServiceAreaSelection, setShowServiceAreaSelection] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [cartItemsCount, setCartItemsCount] = useState(0);
  const [isCaptainRequestOpen, setIsCaptainRequestOpen] = useState(false);
  const [isCaptainTrackingOpen, setIsCaptainTrackingOpen] = useState(false);
  const [isParcelOrderOpen, setIsParcelOrderOpen] = useState(false);
  const [isParcelTrackingOpen, setIsParcelTrackingOpen] = useState(false);
  const [showAddressOrAreaSelector, setShowAddressOrAreaSelector] = useState(false);
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);

  // Function to detect iOS devices
  const isIOSDevice = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };

  // Track if product page or variants modal is open
  const [isProductPageOpen, setIsProductPageOpen] = useState(false);
  const [isVariantsModalOpen, setIsVariantsModalOpen] = useState(false);
  const [isStorePageOpen, setIsStorePageOpen] = useState(false);

  // Function to handle cart item added
  const handleCartItemAdded = (productName: string) => {
    setCartNotification({ show: true, productName });
    setCartPopupNotification({ show: true, productName });

    // Hide notification after 3 seconds
    setTimeout(() => {
      setCartNotification(null);
    }, 3000);
  };

  const isAnyModalOpen = isLoginOpen || isAccountOpen ||
                        isSidebarOpen || showLoginPrompt || isNotificationCenterOpen ||
                        isPrivacyPolicyOpen || isContactPageOpen || isSignupOpen ||
                        isProductPageOpen || isVariantsModalOpen || isStorePageOpen ||
                        isCartOpen || isOrdersOpen || isCaptainRequestOpen || isCaptainTrackingOpen ||
                        isParcelOrderOpen || isParcelTrackingOpen;

  // Show login immediately after splash screen
  useEffect(() => {
    if (!showSplash && !isAuthenticated) {
      const timer = setTimeout(() => {
        setIsLoginOpen(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showSplash, isAuthenticated]);

  // Handle onboarding completion
  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    localStorage.setItem('hasSeenOnboarding', 'true');
    setTimeout(() => {
      setIsLoginOpen(true);
    }, 300);
  };

  // Update cart items count
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
      } else {
        setCartItemsCount(0);
      }
    };

    updateCartCount();
    window.addEventListener('storage', updateCartCount);
    return () => window.removeEventListener('storage', updateCartCount);
  }, []);

  // Fetch vendor data when vendorId is set
  useEffect(() => {
    if (selectedVendorId) {
      supabase
        .from('vendors')
        .select('*')
        .eq('id', selectedVendorId)
        .single()
        .then(({ data, error }) => {
          if (data && !error) {
            setSelectedVendor(data);
          } else {
            console.error('Error fetching vendor:', error);
            setSelectedVendorId(null);
          }
        });
    }
  }, [selectedVendorId]);

  // Fetch product data when productId is set
  useEffect(() => {
    if (selectedProductId) {
      supabase
        .from('products')
        .select('*, vendor:vendor_id(id, store_name, logo_url, rating, rating_count, status), category:category_id(id, name)')
        .eq('id', selectedProductId)
        .single()
        .then(({ data, error }) => {
          if (data && !error) {
            setSelectedProduct(data);
          } else {
            console.error('Error fetching product:', error);
            setSelectedProductId(null);
          }
        });
    }
  }, [selectedProductId]);

  useEffect(() => {
    const fetchServiceAreas = async () => {
      try {
        const { data, error } = await supabase
          .from('service_areas')
          .select('*')
          .order('name');

        if (error) throw error;
        setServiceAreas(data || []);
      } catch (err) {
        console.error('Error fetching service areas:', err);
      }
    };

    fetchServiceAreas();
  }, []);

  // Initialize Firebase without automatic permissions prompt
  useEffect(() => {
    console.log('🚀 Firebase initialization disabled');
  }, []);

  // Listen for cart item added event
  useEffect(() => {
    const handleCartItemAddedEvent = (event: CustomEvent) => {
      const productName = event.detail?.productName || 'منتج';
      handleCartItemAdded(productName);
    };

    window.addEventListener('cart-item-added', handleCartItemAddedEvent as EventListener);

    return () => {
      window.removeEventListener('cart-item-added', handleCartItemAddedEvent as EventListener);
    };
  }, []);

  // Listen for city selector open event
  useEffect(() => {
    const handleOpenCitySelector = () => {
      setShowAddressOrAreaSelector(true);
    };

    window.addEventListener('openCitySelector', handleOpenCitySelector);

    return () => {
      window.removeEventListener('openCitySelector', handleOpenCitySelector);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    // Test Supabase connection on app start
    const testConnection = async () => {
      try {
        const { testSupabaseConnection } = await import('./lib/supabase');
        const result = await testSupabaseConnection();
        if (!result.success) {
          console.warn('⚠️ Supabase connection issue:', result.error);
        }
      } catch (err) {
        console.warn('⚠️ Could not test Supabase connection:', err);
      }
    };

    testConnection();
    return () => clearTimeout(timer);
  }, []);

  // Open address selector only after successful login
  useEffect(() => {
    if (!showSplash && isAuthenticated) {
      const selectedServiceArea = localStorage.getItem('selectedServiceArea');
      // Only show address selector if user is logged in and hasn't selected an area
      if (!selectedServiceArea) {
        setTimeout(() => {
          setShowAddressOrAreaSelector(true);
        }, 500);
      }
    }
  }, [showSplash, isAuthenticated]);

  useEffect(() => {
    const handleCategorySelect = (event: CustomEvent) => {
      setSelectedCategory(event.detail.categoryId);
      setSelectedSubcategory(null);
    };

    window.addEventListener('selectCategory', handleCategorySelect as EventListener);

    return () => {
      window.removeEventListener('selectCategory', handleCategorySelect as EventListener);
    };
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const jwt = urlParams.get('JWT');
    const ref = urlParams.get('ref');

    if (jwt) {
      setIsLoginOpen(true);
    }

    if (ref) {
      console.log('Referral code detected in URL:', ref);
      setSignupReferralCode(ref);
      // Close all other modals first
      closeAllComponents();
      // Then open signup with referral code
      setTimeout(() => {
        setIsSignupOpen(true);
      }, 100);
    }
  }, []);

  // Listen for custom events to open specific pages
  useEffect(() => {
    const handleOpenAccountPage = () => {
      closeAllComponents();
      setIsAccountOpen(true);
    };

    const handleOpenLoginPage = () => {
      closeAllComponents();
      setIsLoginOpen(true);
    };

    const handleOpenSignupPage = () => {
      closeAllComponents();
      setIsSignupOpen(true);
    };

    const handleOpenPrivacyPolicy = () => {
      closeAllComponents();
      setIsPrivacyPolicyOpen(true);
    };

    const handleOpenContactPage = () => {
      closeAllComponents();
      setIsContactPageOpen(true);
    };

    const handleOpenCart = () => {
      closeAllComponents();
      setIsCartOpen(true);
    };

    const handleOpenOrders = () => {
      closeAllComponents();
      setIsOrdersOpen(true);
    };

    const handleShowLoginPrompt = () => {
      setShowLoginPrompt(true);
    };

    const handleOpenCaptainTrackingEvent = () => {
      handleOpenCaptainTracking();
    };

    const handleOpenCaptainRequestEvent = () => {
      handleOpenCaptainRequest();
    };

    const handleOpenParcelOrderEvent = () => {
      handleOpenParcelOrder();
    };

    const handleOpenParcelTrackingEvent = () => {
      handleOpenParcelTracking();
    };

    window.addEventListener('open-account-page', handleOpenAccountPage);
    window.addEventListener('open-login-page', handleOpenLoginPage);
    window.addEventListener('open-signup-page', handleOpenSignupPage);
    window.addEventListener('open-privacy-policy', handleOpenPrivacyPolicy);
    window.addEventListener('open-contact-page', handleOpenContactPage);
    window.addEventListener('open-cart', handleOpenCart);
    window.addEventListener('open-orders', handleOpenOrders);
    window.addEventListener('show-login-prompt', handleShowLoginPrompt);
    window.addEventListener('open-captain-tracking', handleOpenCaptainTrackingEvent);
    window.addEventListener('open-captain-request', handleOpenCaptainRequestEvent);
    window.addEventListener('open-parcel-order', handleOpenParcelOrderEvent);
    window.addEventListener('open-parcel-tracking', handleOpenParcelTrackingEvent);

    return () => {
      window.removeEventListener('open-account-page', handleOpenAccountPage);
      window.removeEventListener('open-login-page', handleOpenLoginPage);
      window.removeEventListener('open-signup-page', handleOpenSignupPage);
      window.removeEventListener('open-privacy-policy', handleOpenPrivacyPolicy);
      window.removeEventListener('open-contact-page', handleOpenContactPage);
      window.removeEventListener('open-cart', handleOpenCart);
      window.removeEventListener('open-orders', handleOpenOrders);
      window.removeEventListener('show-login-prompt', handleShowLoginPrompt);
      window.removeEventListener('open-captain-tracking', handleOpenCaptainTrackingEvent);
      window.removeEventListener('open-captain-request', handleOpenCaptainRequestEvent);
      window.removeEventListener('open-parcel-order', handleOpenParcelOrderEvent);
      window.removeEventListener('open-parcel-tracking', handleOpenParcelTrackingEvent);
    };
  }, []);

  // Listen for close-all-screens event
  useEffect(() => {
    const handleCloseAllScreens = () => {
      closeAllComponents();
    };

    window.addEventListener('close-all-screens', handleCloseAllScreens);

    return () => {
      window.removeEventListener('close-all-screens', handleCloseAllScreens);
    };
  }, []);

  // Listen for product page events
  useEffect(() => {
    const handleProductPageOpen = () => setIsProductPageOpen(true);
    const handleProductPageClose = () => setIsProductPageOpen(false);
    const handleVariantsModalOpen = () => setIsVariantsModalOpen(true);
    const handleVariantsModalClose = () => setIsVariantsModalOpen(false);
    const handleStorePageOpen = () => setIsStorePageOpen(true);
    const handleStorePageClose = () => setIsStorePageOpen(false);

    window.addEventListener('product-page-opened', handleProductPageOpen);
    window.addEventListener('product-page-closed', handleProductPageClose);
    window.addEventListener('variants-modal-opened', handleVariantsModalOpen);
    window.addEventListener('variants-modal-closed', handleVariantsModalClose);
    window.addEventListener('store-page-opened', handleStorePageOpen);
    window.addEventListener('store-page-closed', handleStorePageClose);

    return () => {
      window.removeEventListener('product-page-opened', handleProductPageOpen);
      window.removeEventListener('product-page-closed', handleProductPageClose);
      window.removeEventListener('variants-modal-opened', handleVariantsModalOpen);
      window.removeEventListener('variants-modal-closed', handleVariantsModalClose);
      window.removeEventListener('store-page-opened', handleStorePageOpen);
      window.removeEventListener('store-page-closed', handleStorePageClose);
    };
  }, []);

  // Listen for auth changes
  useEffect(() => {
    const handleAuthChange = () => {
      // Update auth-dependent state
      const storedUser = localStorage.getItem('auth_user');
      if (!storedUser) {
        setIsAccountOpen(false);
      }
      // Don't automatically open account page after login
      // User stays on home page instead
    };

    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, [isAccountOpen]);

  useEffect(() => {
    localStorage.setItem('selectedCity', JSON.stringify(selectedCity));
  }, [selectedCity]);

  // Handle search query changes
  useEffect(() => {
    const searchVendors = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);

      try {
        // Add a small delay to prevent too many requests while typing
        await new Promise(resolve => setTimeout(resolve, 300));

        // Search for vendors by name
        const { data, error } = await supabase
          .from('vendors')
          .select('id, store_name, logo_url, status, rating')
          .ilike('store_name', `%${searchQuery}%`)
          .order('rating', { ascending: false })
          .limit(5);

        if (error) throw error;
        setSearchResults(data || []);
      } catch (err) {
        console.error('Error searching vendors:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    // Only search if there's a query with at least 2 characters
    if (searchQuery.trim().length >= 2) {
      const debounceTimer = setTimeout(() => {
        searchVendors();
      }, 300);

      return () => clearTimeout(debounceTimer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleVendorClick = (vendorId: string) => {
    // Close search results
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchOpen(false);

    // Find the vendor and open its page
    supabase
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .single()
      .then(({ data }) => {
        if (data) {
          // Dispatch an event to open the vendor page
          window.dispatchEvent(new CustomEvent('open-vendor-page', {
            detail: { vendor: data }
          }));
        }
      });
  };

  const handleCitySelect = (city: typeof selectedCity) => {
    setSelectedCity(city);
    localStorage.setItem('selectedServiceArea', city);
    localStorage.setItem('selectedCity', JSON.stringify(city));
    window.dispatchEvent(new CustomEvent('serviceAreaChanged', {
      detail: { areaName: city }
    }));
    setIsCityDropdownOpen(false);
  };

  const handleAddressSelected = (address: any) => {
    // Set the selected city/zone from the address
    const city = address.zone_name || address.city;
    setSelectedCity(city);
    localStorage.setItem('selectedServiceArea', city);
    localStorage.setItem('selectedCity', JSON.stringify(city));
    window.dispatchEvent(new CustomEvent('serviceAreaChanged', {
      detail: { areaName: city }
    }));
    setShowAddressOrAreaSelector(false);
  };

  const handleAreaSelected = (area: string) => {
    setSelectedCity(area);
    localStorage.setItem('selectedServiceArea', area);
    localStorage.setItem('selectedCity', JSON.stringify(area));
    window.dispatchEvent(new CustomEvent('serviceAreaChanged', {
      detail: { areaName: area }
    }));
    setShowAddressOrAreaSelector(false);
  };

  const closeAllComponents = () => {
    setIsLoginOpen(false);
    setIsSignupOpen(false);
    setIsAccountOpen(false);
    setIsSidebarOpen(false);
    setShowLoginPrompt(false);
    setIsCaptainRequestOpen(false);
    setIsParcelOrderOpen(false);
    setIsParcelTrackingOpen(false);
    setIsCaptainTrackingOpen(false);
    setIsNotificationCenterOpen(false);
    setIsPrivacyPolicyOpen(false);
    setIsContactPageOpen(false);
    setIsCartOpen(false);
    setIsOrdersOpen(false);
    setShowAddressOrAreaSelector(false);
  };

  const handleCloseLogin = () => {
    // Only allow closing if user is logged in
    const storedUser = localStorage.getItem('auth_user');
    if (!storedUser) {
      return; // Don't close if not logged in
    }

    setIsLoginOpen(false);
    // Refresh user data after login
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        // Dispatch a custom event to notify components about auth change
        window.dispatchEvent(new CustomEvent('auth-change', { detail: parsedUser }));

        // Navigate to home page after successful login
        navigate('/');

        // Show address selector after login if no service area is selected
        const selectedServiceArea = localStorage.getItem('selectedServiceArea');
        if (!selectedServiceArea) {
          setTimeout(() => {
            setShowAddressOrAreaSelector(true);
          }, 500);
        }
      } catch (e) {
        console.error('Error parsing stored user:', e);
      }
    }
  };

  const handleCloseSignup = () => {
    // Only allow closing if user is logged in
    const storedUser = localStorage.getItem('auth_user');
    if (!storedUser) {
      return; // Don't close if not logged in
    }

    setIsSignupOpen(false);
    setSignupReferralCode(undefined);

    // Show address selector after signup if no service area is selected
    const selectedServiceArea = localStorage.getItem('selectedServiceArea');
    if (!selectedServiceArea) {
      setTimeout(() => {
        setShowAddressOrAreaSelector(true);
      }, 500);
    }
  };

  const handleOpenMenu = () => {
    closeAllComponents();
    setIsSidebarOpen(true);
  };

  const handleOpenAccount = () => {
    if (!isAuthenticated) {
      closeAllComponents();
      setIsLoginOpen(true);
      return;
    }
    closeAllComponents();
    setIsAccountOpen(true);
  };

  const handleOpenCart = () => {
    // Check if service area is selected
    const selectedServiceArea = localStorage.getItem('selectedServiceArea');
    if (!selectedServiceArea) {
      setShowAddressOrAreaSelector(true);
      return;
    }
    closeAllComponents();
    setIsCartOpen(true);
  };

  const handleOpenOrders = () => {
    if (!isAuthenticated) {
      closeAllComponents();
      setIsLoginOpen(true);
      return;
    }
    // Check if service area is selected
    const selectedServiceArea = localStorage.getItem('selectedServiceArea');
    if (!selectedServiceArea) {
      setShowAddressOrAreaSelector(true);
      return;
    }
    closeAllComponents();
    setIsOrdersOpen(true);
  };

  const handleCloseAccount = () => {
    setIsAccountOpen(false);
  };

  const handleLoginPromptClose = () => {
    setShowLoginPrompt(false);
  };

  const handleLoginPromptLogin = () => {
    setShowLoginPrompt(false);
    closeAllComponents();
    setIsLoginOpen(true);
  };

  const handleOpenNotifications = () => {
    closeAllComponents();
    setIsNotificationCenterOpen(true);
  };

  const handleOpenPrivacyPolicy = () => {
    closeAllComponents();
    setIsPrivacyPolicyOpen(true);
  };

  const handleOpenContactPage = () => {
    closeAllComponents();
    setIsContactPageOpen(true);
  };

  const handleOpenCaptainRequest = () => {
    if (!isAuthenticated) {
      closeAllComponents();
      setIsLoginOpen(true);
      return;
    }
    // Check if service area is selected
    const selectedServiceArea = localStorage.getItem('selectedServiceArea');
    if (!selectedServiceArea) {
      setShowAddressOrAreaSelector(true);
      return;
    }
    closeAllComponents();
    setIsCaptainRequestOpen(true);
  };

  const handleOpenCaptainTracking = () => {
    if (!isAuthenticated) {
      closeAllComponents();
      setIsLoginOpen(true);
      return;
    }
    closeAllComponents();
    setIsCaptainTrackingOpen(true);
  };

  const handleOpenParcelOrder = () => {
    if (!isAuthenticated) {
      closeAllComponents();
      setIsLoginOpen(true);
      return;
    }
    // Check if service area is selected
    const selectedServiceArea = localStorage.getItem('selectedServiceArea');
    if (!selectedServiceArea) {
      setShowAddressOrAreaSelector(true);
      return;
    }
    closeAllComponents();
    setIsParcelOrderOpen(true);
  };

  const handleOpenParcelTracking = () => {
    if (!isAuthenticated) {
      closeAllComponents();
      setIsLoginOpen(true);
      return;
    }
    closeAllComponents();
    setTimeout(() => {
      setIsParcelTrackingOpen(true);
    }, 50);
  };

  const handlePermissionsPromptClose = () => {
    setShowPermissionsPrompt(false);
  };

  const handleServiceAreaSelect = (area: string) => {
    setSelectedCity(area);
    localStorage.setItem('selectedServiceArea', area);
    localStorage.setItem('selectedCity', JSON.stringify(area));
    window.dispatchEvent(new CustomEvent('serviceAreaChanged', {
      detail: { areaName: area }
    }));
    setShowServiceAreaSelection(false);

    // Show permissions prompt after area selection
    setTimeout(() => {
      setShowPermissionsPrompt(true);
    }, 800);
  };

  const handleOpenPrivacyPolicyFromServiceArea = () => {
    setShowServiceAreaSelection(false);
    setIsPrivacyPolicyOpen(true);
  };

  const shouldHideBottomNav = useMemo(() => {
    // Hide bottom nav when product page, address form, signup page, or address selector is open
    const shouldHide = isProductPageOpen || isAddressFormOpen || isSignupOpen || showAddressOrAreaSelector;
    console.log('shouldHideBottomNav:', {
      isProductPageOpen,
      isAddressFormOpen,
      isSignupOpen,
      showAddressOrAreaSelector,
      shouldHide
    });
    return shouldHide;
  }, [isProductPageOpen, isAddressFormOpen, isSignupOpen, showAddressOrAreaSelector]);

  const renderContent = () => {
    // Check if user has selected a service area
    const selectedServiceArea = localStorage.getItem('selectedServiceArea');

    // If no service area selected, show blank screen or force address selector
    if (!selectedServiceArea) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-6">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">يرجى تحديد عنوان التوصيل أولاً</p>
          </div>
        </div>
      );
    }

    if (viewMode === 'supermarket') {
      return <Supermarket selectedCity={selectedCity} />;
    }

    return (
      <Home
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
        selectedCity={selectedCity}
        viewMode={viewMode}
        onOpenSearch={() => setIsSearchOpen(true)}
      />
    );
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {showSplash && (
          <SplashScreen
            key="splash"
            onComplete={() => {
              setShowSplash(false);
            }}
          />
        )}
      </AnimatePresence>

      {showOnboarding && !showSplash && (
        <OnboardingScreens onComplete={handleOnboardingComplete} />
      )}

      {!showSplash && !showOnboarding && (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-100" dir="rtl">
        <div className="absolute inset-0 overflow-hidden">

        {/* Cart Notification */}
        <AnimatePresence>
          {cartNotification?.show && (
            <motion.div
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              className="fixed left-0 right-0 z-[100] bg-brand text-white py-3 px-4 shadow-lg"
              style={{
                top: '12px'
              }}
            >
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 text-brand" />
                  </div>
                  <div>
                    <p className="font-medium">تم إضافة المنتج للسلة</p>
                    <p className="text-sm text-white/80">{cartNotification.productName}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Show main content always, even when address selector is open */}
        <div className="fixed top-0 left-0 right-0 bottom-0" style={{
          paddingTop: 0,
          paddingBottom: 'calc(68px + max(env(safe-area-inset-bottom), 8px))',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch'
        }}>
          {renderContent()}
        </div>

        {/* Floating Buttons - Show only in home page (restaurants view) */}
        {!isAccountOpen && !isSidebarOpen && !isPrivacyPolicyOpen && !isContactPageOpen && !isSignupOpen && !isCartOpen && !isOrdersOpen && !isStorePageOpen && !selectedVendorId && !selectedProductId && viewMode === 'restaurants' && (
          <div className="fixed left-4 z-[60] flex flex-col gap-3" style={{
            bottom: 'calc(6rem + max(env(safe-area-inset-bottom), 8px))'
          }}>
            {/* Package Request Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpenParcelOrder}
              className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all bg-brand text-white hover:bg-brand-light"
              title="توصيل الطرود"
            >
              <Package className="w-7 h-7" />
            </motion.button>

            {/* Support Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.open('https://wa.me/972568499643', '_blank')}
              className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all bg-brand text-white hover:bg-brand-light"
              title="الدعم الفني"
            >
              <Headphones className="w-7 h-7" />
            </motion.button>
          </div>
        )}

        {/* Floating Cart Button */}
        <FloatingCart
          onOpenCart={handleOpenCart}
          showOnlyInProductPage={false}
        />

        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onOpenContact={handleOpenContactPage}
        />

        {/* Bottom Nav */}
        <BottomNav
          onOpenCart={handleOpenCart}
          onOpenMenu={handleOpenMenu}
          onOpenAccount={handleOpenAccount}
          onOpenOrders={handleOpenOrders}
          isHidden={shouldHideBottomNav}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          cartItemsCount={cartItemsCount}
          isAccountOpen={isAccountOpen}
          isOrdersOpen={isOrdersOpen}
          isCartOpen={isCartOpen}
        />

        <AnimatePresence>
          {isLoginOpen && (
            <LoginPage
              onClose={handleCloseLogin}
            />
          )}
        </AnimatePresence>

        {isSignupOpen && (
          <div className="fixed inset-0 z-[999999]">
            <SignupPage
              onClose={handleCloseSignup}
              referralCode={signupReferralCode}
            />
          </div>
        )}

        {isAccountOpen && (
            <AccountPage
              onClose={handleCloseAccount}
              onOpenCart={handleOpenCart}
              onOpenOrders={handleOpenOrders}
              onViewModeChange={setViewMode}
              viewMode={viewMode}
              cartItemsCount={cartItemsCount}
            />
        )}

        {isPrivacyPolicyOpen && (
            <PrivacyPolicy
              onClose={() => setIsPrivacyPolicyOpen(false)}
            />
        )}

        {isContactPageOpen && (
            <ContactPage
              onClose={() => setIsContactPageOpen(false)}
            />
        )}

        {isCartOpen && (
          <CartPage
            onClose={() => setIsCartOpen(false)}
            selectedCity={selectedCity}
            onOpenAccount={handleOpenAccount}
            onOpenOrders={handleOpenOrders}
            onNavigateHome={() => setIsCartOpen(false)}
          />
        )}

        {isOrdersOpen && (
          <OrdersPage
            onClose={() => setIsOrdersOpen(false)}
            onOpenCart={handleOpenCart}
            onOpenAccount={handleOpenAccount}
            onViewModeChange={setViewMode}
            viewMode={viewMode}
            cartItemsCount={cartItemsCount}
          />
        )}

        {isCaptainRequestOpen && (
          <CaptainRequestPage
            onClose={() => setIsCaptainRequestOpen(false)}
          />
        )}

        {isCaptainTrackingOpen && (
          <CaptainRequestsTracking
            onClose={() => setIsCaptainTrackingOpen(false)}
          />
        )}

        {isParcelOrderOpen && (
          <ParcelOrderPage
            onClose={() => setIsParcelOrderOpen(false)}
          />
        )}

        {isParcelTrackingOpen && (
          <ParcelOrdersTracking
            onClose={() => setIsParcelTrackingOpen(false)}
          />
        )}

        {/* Login Prompt Modal */}
        <LoginPrompt
          isOpen={showLoginPrompt}
          onClose={handleLoginPromptClose}
          onLogin={handleLoginPromptLogin}
        />

        {/* Notification Center */}
        <NotificationCenter
          isOpen={isNotificationCenterOpen}
          onClose={() => setIsNotificationCenterOpen(false)}
        />

        {/* Permissions Prompt */}
        {showPermissionsPrompt && (
          <PermissionsPrompt onClose={handlePermissionsPromptClose} />
        )}

        {/* Search Modal */}
        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onVendorSelect={(vendorId) => {
            setIsSearchOpen(false);
            setSelectedVendorId(String(vendorId));
          }}
          onProductSelect={(productId) => {
            setIsSearchOpen(false);
            setSelectedProductId(String(productId));
          }}
        />

        {/* City Selector */}
        <CitySelector
          isOpen={isCityDropdownOpen}
          onSelectCity={handleCitySelect}
          currentCity={selectedCity}
          required={true}
        />

        {/* Address or Area Selector */}
        <AnimatePresence>
          {showAddressOrAreaSelector && (
            <AddressOrAreaSelector
              onClose={() => {
                // Allow closing anytime
                setShowAddressOrAreaSelector(false);
              }}
              onAddressSelected={handleAddressSelected}
              onAreaSelected={handleAreaSelected}
              onAddressFormStateChange={setIsAddressFormOpen}
            />
          )}
        </AnimatePresence>

        {/* Service Area Selection */}
        {showServiceAreaSelection && (
          <ServiceAreaSelection
            onSelectArea={handleServiceAreaSelect}
            onOpenPrivacyPolicy={handleOpenPrivacyPolicyFromServiceArea}
          />
        )}

        {/* Single Product Page */}
        {selectedProduct && (
          <SingleProductPage
            product={selectedProduct}
            onClose={() => {
              setSelectedProductId(null);
              setSelectedProduct(null);
            }}
            onAddToCart={() => {}}
          />
        )}

        {/* Store Page */}
        {selectedVendor && (
          <StorePage
            vendor={{
              id: selectedVendor.id,
              store_name: selectedVendor.store_name,
              banner: selectedVendor.banner_url,
              logo: selectedVendor.logo_url,
              rating: selectedVendor.rating,
              status: { is_open: selectedVendor.status === 'active' },
              address: selectedVendor.address
            }}
            categoryId={null}
            onClose={() => {
              setSelectedVendorId(null);
              setSelectedVendor(null);
            }}
          />
        )}
      </div>
      </div>
      )}

      {/* PWA Install Prompt */}
      <InstallPrompt />
    </>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <BrowserRouter>
        <BackButtonHandler />
        <Routes>
          <Route path="/" element={<AppContent />} />
          <Route path="*" element={<AppContent />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
};

export default App;
