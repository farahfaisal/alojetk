import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Settings, Gift, Bell, Shield, ShieldCheck, HelpCircle, LogOut, Star, Package, Loader2, AlertCircle, Trash2, X, MapPin, CreditCard, Plus, Share2, Copy, Check, Link, Wallet, ChevronLeft, Crown, Sparkles, Heart, Award, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AddressForm from './AddressForm';
import { getSavedAddresses, type SavedAddress, getUserProfile, updateUserProfile } from '../lib/storage';
import PointsRedemptionModal from './PointsRedemptionModal';
import NotificationSettings from './NotificationSettings';
import NotificationCenter from './NotificationCenter';
import { getUserPointsAccount, getUserPointsTransactions } from '../lib/points';
import WalletPage from './WalletPage';
import { getCustomerWalletBalance } from '../lib/wallet';
import PointsSettingsAdmin from './PointsSettingsAdmin';
import BottomNav from './BottomNav';

interface AccountPageProps {
  onClose: () => void;
  onOpenCart?: () => void;
  onOpenOrders?: () => void;
  onViewModeChange?: (mode: 'restaurants' | 'supermarket' | 'all') => void;
  viewMode?: 'restaurants' | 'supermarket' | 'all';
  cartItemsCount?: number;
}

const AccountPage: React.FC<AccountPageProps> = ({
  onClose,
  onOpenCart,
  onOpenOrders,
  onViewModeChange,
  viewMode = 'restaurants',
  cartItemsCount = 0
}) => {
  const { user, logout, deleteUserAccount } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState<'main' | 'addresses' | 'payment' | 'profile' | 'points' | 'notifications' | 'referral' | 'wallet'>('main');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [pointsHistory, setPointsHistory] = useState<any[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [showRedemptionModal, setShowRedemptionModal] = useState(false);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralLink, setReferralLink] = useState<string>('');
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [creatingReferralCode, setCreatingReferralCode] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [showPointsSettings, setShowPointsSettings] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [referralStats, setReferralStats] = useState({ count: 0, earned: 0 });
  const [referralsList, setReferralsList] = useState<any[]>([]);

  // Get current time for greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'صباح الخير';
    if (hour < 17) return 'مساء الخير';
    return 'مساء الخير';
  };

  // Get user level based on points
  const getUserLevel = (points: number) => {
    if (points >= 1000) return { name: 'عضو ذهبي', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Crown };
    if (points >= 500) return { name: 'عضو فضي', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: Award };
    if (points >= 100) return { name: 'عضو برونزي', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: Star };
    return { name: 'عضو جديد', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Sparkles };
  };

  // Define menuItems array
  const menuItems = [
    {
      id: 'profile',
      title: 'الملف الشخصي',
      description: 'تعديل البيانات الشخصية',
      icon: <User className="w-6 h-6" />,
      color: 'bg-blue-500',
      onClick: () => setCurrentSection('profile')
    },
    {
      id: 'addresses',
      title: 'عناوين التوصيل',
      description: 'إدارة عناوين التوصيل',
      icon: <MapPin className="w-6 h-6" />,
      color: 'bg-green-500',
      onClick: () => setCurrentSection('addresses')
    },
    {
      id: 'payment',
      title: 'وسائل الدفع',
      description: 'إدارة بطاقات الدفع',
      icon: <CreditCard className="w-6 h-6" />,
      color: 'bg-purple-500',
      onClick: () => setCurrentSection('payment')
    },
    {
      id: 'wallet',
      title: 'المحفظة الإلكترونية',
      description: 'إدارة رصيد المحفظة',
      icon: <Wallet className="w-6 h-6" />,
      color: 'bg-indigo-500',
      onClick: () => setCurrentSection('wallet')
    },
    {
      id: 'points',
      title: 'نقاط المكافآت',
      description: 'عرض واستبدال النقاط',
      icon: <Gift className="w-6 h-6" />,
      color: 'bg-orange-500',
      onClick: () => setCurrentSection('points')
    },
    {
      id: 'referral',
      title: 'رابط الإحالة',
      description: 'شارك واكسب نقاط',
      icon: <Share2 className="w-6 h-6" />,
      color: 'bg-pink-500',
      onClick: () => setCurrentSection('referral')
    },
    {
      id: 'notification-center',
      title: 'الإشعارات',
      description: 'عرض جميع الإشعارات',
      icon: <Bell className="w-6 h-6" />,
      color: 'bg-[#1759cb]/100',
      onClick: () => setShowNotificationCenter(true)
    },
    {
      id: 'points-settings',
      title: 'إعدادات النقاط',
      description: 'إدارة نظام النقاط والمكافآت',
      icon: <Settings className="w-6 h-6" />,
      color: 'bg-indigo-500',
      onClick: () => setShowPointsSettings(true),
      adminOnly: true
    },
    {
      id: 'notifications',
      title: 'إعدادات الإشعارات',
      description: 'تخصيص الإشعارات',
      icon: <Settings className="w-6 h-6" />,
      color: 'bg-yellow-500',
      onClick: () => setCurrentSection('notifications')
    },
    {
      id: 'help',
      title: 'المساعدة والدعم',
      description: 'الحصول على المساعدة',
      icon: <HelpCircle className="w-6 h-6" />,
      color: 'bg-gray-500',
      onClick: () => {}
    }
  ];

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
          
        setIsAdmin(!!data && !error);
      } catch (err) {
        setIsAdmin(false);
      }
    };
    
    checkAdminStatus();
  }, [user]);
  React.useEffect(() => {
    const fetchUserPoints = async () => {
      if (!user) return;
      
      try {
        setLoadingPoints(true);
        setPointsError(null);
        
        console.log('Fetching points for user:', user);
        const customerId = user.customer_id || user.id;
        console.log('Using customer ID for points:', customerId);
        
        // Fetch points account
        const pointsAccount = await getUserPointsAccount(customerId);
        console.log('Points account result:', pointsAccount);
        
        if (pointsAccount) {
          setUserPoints(pointsAccount.balance);
          
          // Fetch transactions
          const transactions = await getUserPointsTransactions(pointsAccount.id);
          console.log('Points transactions:', transactions);
          setPointsHistory(transactions);
        } else {
          console.log('No points account found, setting to 0');
          setUserPoints(0);
          setPointsHistory([]);
        }
      } catch (err) {
        console.error('Error fetching points:', err);
        setPointsError('حدث خطأ في جلب بيانات النقاط');
        setUserPoints(0);
      } finally {
        setLoadingPoints(false);
      }
    };
    
    fetchUserPoints();
  }, [user]);

  // Fetch referral code and stats
  useEffect(() => {
    const fetchReferralData = async () => {
      if (!user?.id) return;

      try {
        setReferralLoading(true);
        setReferralError(null);

        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('referral_code, referral_count')
          .eq('id', user.id)
          .maybeSingle();

        if (customerError) {
          console.error('Error fetching referral code:', customerError);
          setReferralError('حدث خطأ في جلب رمز الإحالة');
          return;
        }

        if (customerData && customerData.referral_code) {
          setReferralCode(customerData.referral_code);
          setReferralLink(`https://app.jetekapp.site?ref=${customerData.referral_code}`);

          const { data: rewards } = await supabase
            .from('referrals')
            .select('referrer_reward_points')
            .eq('referrer_id', user.id)
            .eq('status', 'rewarded');

          const totalEarned = rewards?.reduce((sum, r) => sum + r.referrer_reward_points, 0) || 0;

          setReferralStats({
            count: customerData.referral_count || 0,
            earned: totalEarned
          });

          const { data: referralRecords } = await supabase
            .from('referrals')
            .select(`
              id,
              referred_id,
              status,
              referrer_reward_points,
              created_at,
              referred:customers!referrals_referred_id_fkey(name)
            `)
            .eq('referrer_id', user.id)
            .order('created_at', { ascending: false });

          const formattedReferrals = referralRecords?.map((r: any) => ({
            ...r,
            customer_name: r.referred?.name || 'مستخدم جديد'
          })) || [];

          setReferralsList(formattedReferrals);
        } else {
          setReferralCode(null);
          setReferralLink('');
        }
      } catch (err) {
        console.error('Error fetching referral data:', err);
        setReferralError('حدث خطأ في جلب بيانات الإحالة');
      } finally {
        setReferralLoading(false);
      }
    };

    fetchReferralData();
  }, [user]);

  // Fetch wallet balance
  useEffect(() => {
    const fetchWalletBalance = async () => {
      if (!user?.customer_id) return;

      try {
        setWalletLoading(true);
        const balance = await getCustomerWalletBalance(user.customer_id);
        setWalletBalance(balance);
      } catch (err) {
        console.error('Error fetching wallet balance:', err);
      } finally {
        setWalletLoading(false);
      }
    };

    fetchWalletBalance();
  }, [user]);

  // Fetch addresses
  useEffect(() => {
    const fetchAddresses = async () => {
      if (!user?.customer_id) return;

      try {
        const savedAddresses = await getSavedAddresses();
        setAddresses(savedAddresses);
      } catch (err) {
        console.error('Error fetching addresses:', err);
      }
    };

    fetchAddresses();
  }, [user, currentSection]);

  // Prevent body scrolling when account page is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Update profile data when user changes
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || ''
      });
    }
    setLoading(false);
  }, [user]);

  const handleLogout = () => {
    setLogoutLoading(true);
    // Small delay to show loading state
    setTimeout(() => {
      logout();
      localStorage.removeItem('cartItems'); // Clear cart items on logout
      onClose();
    }, 500);
  };

  const handleDeleteAccount = async () => {
    try {
      setLoading(true);
      await deleteUserAccount();
      onClose();
    } catch (err) {
      setError('فشل حذف الحساب. الرجاء المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleAddressFormSubmit = async (address: SavedAddress) => {
    const savedAddresses = await getSavedAddresses();
    setAddresses(savedAddresses);
    setShowAddressForm(false);
    setEditingAddress(null);
  };

  const handleEditAddress = (address: SavedAddress) => {
    setEditingAddress(address);
    setShowAddressForm(true);
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setProfileSuccess(false);
    
    if (!profileData.name) {
      setError('الاسم مطلوب');
      return;
    }
    
    setProfileLoading(true);
    
    try {
      // Update profile in storage and database
      const success = await updateUserProfile({
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone
      });
      
      if (success) {
        setProfileSuccess(true);
        // Update local state to reflect changes
        if (user) {
          const updatedUser = {
            ...user,
            name: profileData.name,
            email: profileData.email,
            phone: profileData.phone
          };
          // This will be handled by the auth-change event listener
        }
      } else {
        setError('فشل تحديث الملف الشخصي');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('حدث خطأ أثناء تحديث الملف الشخصي');
    } finally {
      setProfileLoading(false);
    }
  };

  const refreshPointsData = async () => {
    if (!user) return;
    
    try {
      setLoadingPoints(true);
      setPointsError(null);
      
      // Fetch points account
      const pointsAccount = await getUserPointsAccount(user.customer_id);
      
      if (pointsAccount) {
        setUserPoints(pointsAccount.balance);
        
        // Fetch transactions
        const transactions = await getUserPointsTransactions(pointsAccount.id);
        setPointsHistory(transactions);
      } else {
        setUserPoints(0);
        setPointsHistory([]);
      }
    } catch (err) {
      console.error('Error refreshing points:', err);
      setPointsError('حدث خطأ في تحديث بيانات النقاط');
    } finally {
      setLoadingPoints(false);
    }
  };

  const handleCopyReferralLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2000);
    }
  };

  const handleShareReferralLink = () => {
    if (referralLink) {
      if (navigator.share) {
        navigator.share({
          title: 'انضم إلى جيتك واحصل على نقاط مجانية!',
          text: `استخدم رمز الإحالة الخاص بي للحصول على 50 نقطة مجانية عند التسجيل في تطبيق جيتك!`,
          url: referralLink
        }).catch(err => {
          console.error('Error sharing:', err);
          setShareError('لا يمكن مشاركة الرابط، تم نسخه إلى الحافظة بدلاً من ذلك');
          handleCopyReferralLink();
          setTimeout(() => setShareError(null), 3000);
        });
      } else {
        handleCopyReferralLink();
      }
    }
  };

  const renderPointsSection = () => (
    <>
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="p-4 flex items-center">
          <button
            onClick={() => setCurrentSection('main')}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-gray-900 mr-4">نقاطي</h2>
        </div>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto">
        {pointsError && (
          <div className="bg-[#1759cb]/10 text-[#1759cb] p-4 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{pointsError}</p>
          </div>
        )}

        {loadingPoints ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : (
          <>
            {/* Points Summary Card */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 bg-gradient-to-br from-brand to-brand-light">
                <div className="text-center">
                  <h3 className="text-accent text-lg font-bold mb-2">رصيد النقاط الحالي</h3>
                  <div className="text-4xl font-bold text-accent">{userPoints || 0}</div>
                </div>
              </div>
              
              <div className="p-4">
                <button
                  onClick={() => setShowRedemptionModal(true)}
                  className="w-full bg-brand text-white py-3 rounded-lg hover:bg-brand-light transition-colors"
                >
                  استبدال النقاط
                </button>
              </div>
            </div>

            {/* Points History */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-900 mb-4">سجل النقاط</h3>
              
              {pointsHistory.length > 0 ? (
                <div className="space-y-4">
                  {pointsHistory.map((transaction) => (
                    <div key={transaction.id} className="border-b pb-4 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900">{transaction.description}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            {new Date(transaction.created_at).toLocaleDateString('ar')}
                          </div>
                        </div>
                        <div className={`font-bold ${transaction.amount > 0 ? 'text-green-600' : 'text-[#1759cb]'}`}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount} نقطة
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  لا توجد معاملات نقاط سابقة
                </div>
              )}
            </div>

            {/* How to Earn Points */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-900 mb-4">كيف تكسب المزيد من النقاط</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-brand" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">اطلب من المتاجر</div>
                    <div className="text-sm text-gray-600">اكسب نقاط مقابل كل طلب تقوم به</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Star className="w-4 h-4 text-brand" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">قيّم طلباتك</div>
                    <div className="text-sm text-gray-600">اكسب 10 نقاط عند تقييم طلبك</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Gift className="w-4 h-4 text-brand" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">دعوة الأصدقاء</div>
                    <div className="text-sm text-gray-600">اكسب 50 نقطة لكل صديق تدعوه</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );

  const renderReferralSection = () => (
    <>
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="p-4 flex items-center">
          <button
            onClick={() => setCurrentSection('main')}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-gray-900 mr-4">رابط الإحالة</h2>
        </div>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto">
        {referralError && (
          <div className="bg-[#1759cb]/10 text-[#1759cb] p-4 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{referralError}</p>
          </div>
        )}

        {shareError && (
          <div className="bg-yellow-50 text-yellow-600 p-4 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{shareError}</p>
          </div>
        )}

        {referralLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : (
          <>
            {/* Referral Card */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 bg-gradient-to-br from-brand to-brand-light">
                <div className="text-center">
                  <h3 className="text-accent text-lg font-bold mb-2">رابط الإحالة الخاص بك</h3>
                  <div className="text-sm text-accent/80 mb-4">شارك هذا الرابط مع أصدقائك واكسب نقاط عندما يستخدمونه</div>
                  
                  <div className="bg-white/80 rounded-lg p-3 text-center">
                    {referralCode ? (
                      <p className="font-bold text-accent text-lg">{referralCode}</p>
                    ) : (
                      <p className="text-gray-500">يتم إنشاء رمز الإحالة تلقائياً</p>
                    )}
                  </div>
                </div>
              </div>
              
              {referralLink && (
                <div className="p-4 space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={referralLink}
                      readOnly
                      className="w-full px-4 py-3 pr-10 bg-gray-50 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                    <button
                      onClick={handleCopyReferralLink}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-brand"
                    >
                      {referralCopied ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  
                  <button
                    onClick={handleShareReferralLink}
                    className="w-full bg-brand text-accent py-3 rounded-lg hover:bg-brand-light transition-colors flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-5 h-5" />
                    مشاركة الرابط
                  </button>
                </div>
              )}
            </div>

            {/* How Referrals Work */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-900 mb-4">كيف تعمل الإحالات</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Share2 className="w-4 h-4 text-brand" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">شارك رابط الإحالة</div>
                    <div className="text-sm text-gray-600">أرسل رابط الإحالة الخاص بك إلى أصدقائك وعائلتك</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-brand" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">تسجيل صديقك</div>
                    <div className="text-sm text-gray-600">عندما يقوم صديقك بالتسجيل باستخدام رابط الإحالة الخاص بك</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Gift className="w-4 h-4 text-brand" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">اكسب نقاط</div>
                    <div className="text-sm text-gray-600">تحصل على 50 نقطة لكل صديق يستخدم رابط الإحالة الخاص بك</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Referral Stats */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-900 mb-4">إحصائيات الإحالة</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-500">عدد الإحالات</p>
                  <p className="text-2xl font-bold text-brand">{referralStats.count}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-500">النقاط المكتسبة</p>
                  <p className="text-2xl font-bold text-brand">{referralStats.earned}</p>
                </div>
              </div>
            </div>

            {/* Referrals List */}
            {referralsList.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="font-bold text-gray-900 mb-4">إحالاتي</h3>
                <div className="space-y-3">
                  {referralsList.map((referral) => (
                    <div key={referral.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-semibold text-gray-900">{referral.customer_name}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(referral.created_at).toLocaleDateString('ar')}
                        </p>
                      </div>
                      <div className="text-left">
                        {referral.status === 'rewarded' ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <Check className="w-4 h-4" />
                            <span className="text-sm font-semibold">+{referral.referrer_reward_points} نقطة</span>
                          </div>
                        ) : referral.status === 'completed' ? (
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">قيد المعالجة</span>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">قيد الانتظار</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  const renderNotificationsSection = () => (
    <NotificationSettings onClose={() => setCurrentSection('main')} />
  );

  const renderAddresses = () => (
    <>
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="p-4 flex items-center">
          <button
            onClick={() => setCurrentSection('main')}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-gray-900 mr-4">عناوين التوصيل</h2>
        </div>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto">
        <button
          onClick={() => setShowAddressForm(true)}
          className="w-full bg-brand text-white p-4 rounded-xl flex items-center justify-center gap-2 hover:bg-brand-light transition-colors"
        >
          <Plus className="w-5 h-5" />
          إضافة عنوان جديد
        </button>

        {addresses.map((address) => (
          <div key={address.id} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-gray-900">
                  {address.label || `بدون عنوان - ${address.phone}`}
                </h3>
                <p className="text-gray-600 mt-1">{address.address}</p>
                {address.mainArea && (
                  <p className="text-gray-500 text-sm mt-1">
                    المنطقة الرئيسية: {address.mainArea}
                  </p>
                )}
                {address.subArea && (
                  <p className="text-gray-500 text-sm">
                    المنطقة الفرعية: {address.subArea}
                  </p>
                )}
                <p className="text-gray-600">{address.phone}</p>
                {address.isDefault && (
                  <span className="inline-block mt-2 px-2 py-1 bg-brand/10 text-accent text-sm rounded-lg">
                    العنوان الافتراضي
                  </span>
                )}
              </div>
              <button
                onClick={() => handleEditAddress(address)}
                className="text-brand hover:text-brand-light"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );

  const renderPaymentMethods = () => (
    <>
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="p-4 flex items-center">
          <button
            onClick={() => setCurrentSection('main')}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-gray-900 mr-4">وسائل الدفع</h2>
        </div>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto">
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-semibold text-yellow-800">قريباً</h3>
              <p className="text-yellow-700 mt-1">
                سيتم إضافة خيارات الدفع الإلكتروني قريباً. حالياً، يمكنك الدفع نقداً عند الاستلام.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm opacity-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">**** **** **** 1234</h3>
                <p className="text-gray-500 text-sm">تنتهي في 12/25</p>
              </div>
            </div>
            <button className="text-brand hover:text-brand-light" disabled>
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );

  const renderProfileSettings = () => (
    <>
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="p-4 flex items-center">
          <button
            onClick={() => setCurrentSection('main')}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-gray-900 mr-4">الملف الشخصي</h2>
        </div>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            {error && (
              <div className="bg-[#1759cb]/10 text-[#1759cb] p-4 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {profileSuccess && (
              <div className="bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                <p>تم تحديث الملف الشخصي بنجاح</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الاسم
              </label>
              <input
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                رقم الهاتف
              </label>
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                readOnly
              />
              <p className="text-xs text-gray-500 mt-1">لا يمكن تغيير رقم الهاتف</p>
            </div>
            <button 
              type="submit" 
              disabled={profileLoading}
              className="w-full bg-brand text-white py-2 rounded-lg hover:bg-brand-light transition-colors flex items-center justify-center gap-2"
            >
              {profileLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                'حفظ التغييرات'
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );

  if (showAddressForm) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-50">
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="p-4 flex items-center">
            <button
              onClick={() => {
                setShowAddressForm(false);
                setEditingAddress(null);
              }}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-gray-900 mr-4">
              {editingAddress ? 'تعديل العنوان' : 'إضافة عنوان جديد'}
            </h2>
          </div>
        </div>
        <div className="p-4 overflow-y-auto">
          <AddressForm
            onSave={handleAddressFormSubmit}
            onCancel={() => {
              setShowAddressForm(false);
              setEditingAddress(null);
            }}
            initialAddress={editingAddress}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col overflow-hidden modal-page-ios">
      {currentSection === 'main' ? (
        <>
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
                <h2 className="text-xl font-bold text-gray-900">حسابي</h2>
                <div className="w-[80px]"></div>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto modal-scroll">
            <div className="max-w-md mx-auto" style={{
              paddingBottom: 'calc(120px + max(env(safe-area-inset-bottom), 0px))',
              WebkitOverflowScrolling: 'touch'
            }}>
              {error && (
                <div className="bg-[#1759cb]/10 border border-[#1759cb]/30 rounded-xl p-4 m-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-[#1759cb] shrink-0" />
                    <p className="text-[#1759cb] font-medium">{error}</p>
                  </div>
                </div>
              )}

              <div className="p-4">
                {/* Welcome Header Card */}
                <div className="bg-gradient-to-br from-brand via-[#1759cb] to-[#1759cb] rounded-3xl shadow-xl overflow-hidden mb-6 relative">
                  {/* Decorative background elements */}
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full"></div>
                    <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/5 rounded-full"></div>
                    <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-yellow-400/20 rounded-full"></div>
                  </div>
                  
                  <div className="relative z-10 p-6">
                    {/* Greeting and User Info */}
                    <div className="text-center mb-6">
                      <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl border-4 border-white/30">
                        <User className="w-12 h-12 text-white" />
                      </div>
                      
                      <div className="space-y-2">
                        <h1 className="text-3xl font-bold text-white">
                          {getGreeting()}، {user?.name || 'المستخدم'}! 👋
                        </h1>
                        <p className="text-white/90 text-lg">
                          مرحباً بك في JIB
                        </p>
                        {user?.email && (
                          <p className="text-white/70 text-sm">{user.email}</p>
                        )}
                      </div>
                    </div>

                    {/* User Level Badge */}
                    {userPoints !== null && (
                      <div className="flex justify-center mb-6">
                        {(() => {
                          const level = getUserLevel(userPoints);
                          const LevelIcon = level.icon;
                          return (
                            <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 border border-white/30">
                              <LevelIcon className="w-5 h-5 text-yellow-300" />
                              <span className="text-white font-medium text-sm">{level.name}</span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 text-center border border-white/30">
                        <div className="flex items-center justify-center mb-2">
                          <Gift className="w-6 h-6 text-yellow-300" />
                        </div>
                        <p className="text-white/80 text-sm mb-1">رصيد النقاط</p>
                        <p className="text-2xl font-bold text-white">{userPoints || 0}</p>
                        <p className="text-white/60 text-xs">نقطة</p>
                      </div>
                      
                      <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 text-center border border-white/30">
                        <div className="flex items-center justify-center mb-2">
                          <Wallet className="w-6 h-6 text-green-300" />
                        </div>
                        <p className="text-white/80 text-sm mb-1">رصيد المحفظة</p>
                        <p className="text-xl font-bold text-white">
                          {walletLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                          ) : (
                            `${walletBalance.toFixed(2)}`
                          )}
                        </p>
                        <p className="text-white/60 text-xs">شيكل</p>
                      </div>
                    </div>
                    
                    {/* Quick Actions */}
                    <div className="mt-6 grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setCurrentSection('points')}
                        className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center border border-white/30 hover:bg-white/30 transition-all"
                      >
                        <Gift className="w-5 h-5 text-yellow-300 mx-auto mb-1" />
                        <span className="text-white text-xs font-medium">النقاط</span>
                      </button>
                      
                      <button
                        onClick={() => setCurrentSection('wallet')}
                        className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center border border-white/30 hover:bg-white/30 transition-all"
                      >
                        <Wallet className="w-5 h-5 text-green-300 mx-auto mb-1" />
                        <span className="text-white text-xs font-medium">المحفظة</span>
                      </button>
                      
                      <button
                        onClick={() => setCurrentSection('referral')}
                        className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center border border-white/30 hover:bg-white/30 transition-all"
                      >
                        <Share2 className="w-5 h-5 text-blue-300 mx-auto mb-1" />
                        <span className="text-white text-xs font-medium">الإحالة</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Welcome Message */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 mb-6 border border-blue-100">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Heart className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        نحن سعداء لوجودك معنا! 🌟
                      </h3>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        شكراً لاختيارك JIB. نسعى دائماً لتقديم أفضل خدمة توصيل في فلسطين. 
                        استمتع بتجربة التسوق والتوصيل السريع!
                      </p>
                      
                      {/* Progress to next level */}
                      {userPoints !== null && userPoints < 1000 && (
                        <div className="mt-4 p-3 bg-white/80 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">التقدم للمستوى التالي</span>
                            <span className="text-xs text-gray-500">
                              {userPoints >= 500 ? '1000' : userPoints >= 100 ? '500' : '100'} نقطة
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                              style={{ 
                                width: `${Math.min(100, (userPoints / (userPoints >= 500 ? 1000 : userPoints >= 100 ? 500 : 100)) * 100)}%` 
                              }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {userPoints >= 500 
                              ? `${1000 - userPoints} نقطة للوصول للعضوية الذهبية`
                              : userPoints >= 100 
                                ? `${500 - userPoints} نقطة للوصول للعضوية الفضية`
                                : `${100 - userPoints} نقطة للوصول للعضوية البرونزية`
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Menu Items with Enhanced Design */}
                <div className="mt-8 space-y-4">
                  {menuItems
                    .filter(item => !item.adminOnly || isAdmin)
                    .map((item) => (
                    <motion.button
                      key={item.id}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={item.onClick}
                      className="w-full bg-white rounded-2xl p-5 flex items-center shadow-lg hover:shadow-xl transition-all border border-gray-100 hover:border-gray-200 group"
                    >
                      <div className={`${item.color} w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
                        {item.icon}
                      </div>
                      <div className="mr-4 text-right flex-1">
                        <h3 className="font-bold text-gray-900 text-lg group-hover:text-gray-700 transition-colors">{item.title}</h3>
                        <p className="text-gray-500 text-sm mt-1">{item.description}</p>
                      </div>
                      <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                      </div>
                    </motion.button>
                  ))}

                  {/* Logout Button with Special Design */}
                  <motion.button 
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleLogout}
                    disabled={logoutLoading}
                    className="w-full bg-gradient-to-r from-[#1759cb]/10 to-pink-50 rounded-2xl p-5 flex items-center shadow-lg hover:shadow-xl transition-all border border-[#1759cb]/20 hover:border-[#1759cb]/30 group"
                  >
                    <div className="bg-gradient-to-br from-[#1759cb]/100 to-[#1759cb] w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                      {logoutLoading ? (
                        <Loader2 className="w-7 h-7 animate-spin" />
                      ) : (
                        <LogOut className="w-7 h-7" />
                      )}
                    </div>
                    <div className="mr-4 text-right flex-1">
                      <h3 className="font-bold text-[#1759cb] text-lg group-hover:text-[#1759cb] transition-colors">
                        {logoutLoading ? 'جاري تسجيل الخروج...' : 'تسجيل الخروج'}
                      </h3>
                      <p className="text-gray-500 text-sm mt-1">الخروج من الحساب بأمان</p>
                    </div>
                    <div className="text-[#1759cb] group-hover:text-[#1759cb] transition-colors">
                      <ChevronLeft className="w-5 h-5" />
                    </div>
                  </motion.button>

                  {/* Delete Account Button */}
                  <motion.button 
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full bg-gradient-to-r from-gray-50 to-[#1759cb]/10 rounded-2xl p-5 flex items-center shadow-lg hover:shadow-xl transition-all border border-gray-200 hover:border-[#1759cb]/30 group"
                  >
                    <div className="bg-gradient-to-br from-gray-500 to-[#1759cb]/100 w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                      <Trash2 className="w-7 h-7" />
                    </div>
                    <div className="mr-4 text-right flex-1">
                      <h3 className="font-bold text-[#1759cb] text-lg group-hover:text-[#1759cb] transition-colors">حذف الحساب</h3>
                      <p className="text-gray-500 text-sm mt-1">حذف الحساب نهائياً (لا يمكن التراجع)</p>
                    </div>
                    <div className="text-[#1759cb] group-hover:text-[#1759cb] transition-colors">
                      <ChevronLeft className="w-5 h-5" />
                    </div>
                  </motion.button>
                  
                  {/* App Info Footer */}
                  <div className="mt-8 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl border border-gray-100">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <img 
                          src="https://rrhoxgfnikmtgsxwvjuv.supabase.co/storage/v1/object/public/general/WhatsApp%20Image%202025-09-23%20at%2000.16.28.jpeg"
                          alt="JIB"
                          className="w-8 h-8 rounded-full"
                        />
                        <span className="font-bold text-gray-900">JIB</span>
                      </div>
                      <p className="text-gray-600 text-xs">
                        الإصدار 1.0 • أفضل تطبيق توصيل في فلسطين
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        © 2025 جميع الحقوق محفوظة
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : currentSection === 'addresses' ? (
        renderAddresses()
      ) : currentSection === 'payment' ? (
        renderPaymentMethods()
      ) : currentSection === 'points' ? (
        renderPointsSection()
      ) : currentSection === 'notifications' ? (
        renderNotificationsSection()
      ) : currentSection === 'profile' ? (
        renderProfileSettings()
      ) : currentSection === 'referral' ? (
        renderReferralSection()
      ) : currentSection === 'wallet' ? (
        <WalletPage onClose={() => setCurrentSection('main')} />
      ) : null}

      {/* Points Settings Admin Modal */}
      {showPointsSettings && isAdmin && (
        <PointsSettingsAdmin onClose={() => setShowPointsSettings(false)} />
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-[#1759cb]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-[#1759cb]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">تأكيد حذف الحساب</h3>
            </div>
            
            <div className="bg-[#1759cb]/10 rounded-2xl p-4 mb-6 border border-[#1759cb]/20">
              <p className="text-[#1759cb] text-center font-medium">
                ⚠️ تحذير: هذا الإجراء لا يمكن التراجع عنه
              </p>
            </div>
            
            <p className="text-gray-600 mb-6 text-center leading-relaxed">
              هل أنت متأكد من رغبتك في حذف حسابك؟ هذا الإجراء لا يمكن التراجع عنه وسيؤدي إلى حذف جميع بياناتك.
            </p>
            
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all shadow-md"
              >
                إلغاء
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-[#1759cb]/100 to-[#1759cb] text-white py-4 rounded-2xl font-bold hover:from-[#1759cb] hover:to-[#1759cb] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    جاري الحذف...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    تأكيد الحذف
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Points Redemption Modal */}
      <PointsRedemptionModal
        isOpen={showRedemptionModal}
        onClose={() => setShowRedemptionModal(false)}
        userPoints={userPoints || 0}
        onRedeemSuccess={refreshPointsData}
      />

      {/* Notification Center */}
      <NotificationCenter
        isOpen={showNotificationCenter}
        onClose={() => setShowNotificationCenter(false)}
      />

      {/* Bottom Navigation */}
      <BottomNav
        onOpenCart={() => {
          onClose();
          setTimeout(() => {
            if (onOpenCart) onOpenCart();
          }, 100);
        }}
        onOpenAccount={() => {}}
        onOpenOrders={() => {
          onClose();
          setTimeout(() => {
            if (onOpenOrders) onOpenOrders();
          }, 100);
        }}
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          onClose();
          setTimeout(() => {
            if (onViewModeChange) onViewModeChange(mode);
          }, 100);
        }}
        cartItemsCount={cartItemsCount}
        isAccountOpen={true}
        isOrdersOpen={false}
        isCartOpen={false}
      />
    </div>
  );
};

export default AccountPage;