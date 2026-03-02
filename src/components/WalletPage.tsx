import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Minus, CreditCard, History, ArrowUpRight, ArrowDownLeft, X, Loader2, AlertCircle, Check, DollarSign, TrendingUp, TrendingDown, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import {
  getCustomerWallet,
  getCustomerWalletTransactions,
  addMoneyToWallet,
  withdrawFromWallet,
  formatTransactionType,
  formatPaymentType,
  formatTransactionStatus,
  type CustomerWallet,
  type WalletTransaction
} from '../lib/wallet';
import { showPaymentNotification, arePaymentNotificationsEnabled } from '../lib/firebase';

interface WalletPageProps {
  onClose: () => void;
}

const WalletPage: React.FC<WalletPageProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<CustomerWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Prevent body scrolling when wallet page is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Fetch wallet data
  useEffect(() => {
    const fetchWalletData = async () => {
      const customerId = user?.customer_id || user?.id;
      if (!customerId) {
        setError('معرف العميل غير متوفر');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch wallet
        const walletData = await getCustomerWallet(customerId);
        setWallet(walletData);

        // Fetch transactions
        const transactionsData = await getCustomerWalletTransactions(customerId);
        setTransactions(transactionsData);
      } catch (err) {
        console.error('Error fetching wallet data:', err);
        setError('حدث خطأ في جلب بيانات المحفظة');
      } finally {
        setLoading(false);
      }
    };

    fetchWalletData();
  }, [user]);

  const handleAddMoney = async (e: React.FormEvent) => {
    e.preventDefault();

    const customerId = user?.customer_id || user?.id;
    if (!customerId || !amount || parseFloat(amount) <= 0) {
      setActionError('يرجى إدخال مبلغ صحيح');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const result = await addMoneyToWallet(
        customerId,
        parseFloat(amount),
        description || 'إيداع في المحفظة',
        'electronic'
      );

      if (result.success) {
        setActionSuccess('تم إرسال طلب الإيداع بنجاح. سيتم مراجعته من قبل المدير.');
        setAmount('');
        setDescription('');
        setShowAddMoney(false);

        // Show payment notification for deposit request
        if (arePaymentNotificationsEnabled()) {
          showPaymentNotification('pending', parseFloat(amount));
        }

        // Refresh wallet data
        const updatedWallet = await getCustomerWallet(customerId);
        setWallet(updatedWallet);

        const updatedTransactions = await getCustomerWalletTransactions(customerId);
        setTransactions(updatedTransactions);
      } else {
        setActionError(result.message);
        
        // Show payment failure notification
        if (arePaymentNotificationsEnabled()) {
          showPaymentNotification('failed', parseFloat(amount));
        }
      }
    } catch (err) {
      console.error('Error adding money:', err);
      setActionError('حدث خطأ أثناء إضافة المبلغ');
      
      // Show payment failure notification
      if (arePaymentNotificationsEnabled()) {
        showPaymentNotification('failed', parseFloat(amount));
      }
    } finally {
      setActionLoading(false);
    }
  };


  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'refund':
      case 'bonus':
        return <ArrowDownLeft className="w-5 h-5 text-green-500" />;
      case 'payment':
      case 'penalty':
        return <ArrowUpRight className="w-5 h-5 text-red-700" />;
      default:
        return <DollarSign className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'refund':
      case 'bonus':
        return 'text-green-600';
      case 'payment':
      case 'penalty':
        return 'text-red-800';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-40 flex items-center justify-center" style={{
        paddingBottom: 'calc(62px + env(safe-area-inset-bottom))'
      }}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand animate-spin mx-auto mb-4" />
          <p className="text-gray-600">جاري تحميل بيانات المحفظة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 z-40 flex flex-col overflow-hidden" style={{
      paddingTop: 'max(env(safe-area-inset-top), 0px)',
      paddingBottom: 'calc(62px + env(safe-area-inset-bottom))'
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
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Wallet className="w-6 h-6 text-brand" />
              محفظتي
            </h2>
            <div className="w-[80px]"></div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto p-4 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-800 p-4 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {actionSuccess && (
            <div className="bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2">
              <Check className="w-5 h-5 flex-shrink-0" />
              <p>{actionSuccess}</p>
            </div>
          )}

          {/* Wallet Balance Card */}
          <div className="bg-gradient-to-br from-brand to-brand-light rounded-xl p-6 text-center shadow-lg">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-accent text-lg font-bold mb-2">رصيد المحفظة</h3>
            <div className="text-4xl font-bold text-accent mb-4">
              {wallet ? wallet.balance.toFixed(2) : '0.00'} شيكل
            </div>
            
            {/* Quick Stats */}
            {wallet && (
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">{wallet.total_deposits.toFixed(0)}</div>
                  <div className="text-accent/80 text-sm">إجمالي الإيداعات</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">{wallet.total_spent.toFixed(0)}</div>
                  <div className="text-accent/80 text-sm">إجمالي المصروفات</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">{wallet.total_withdrawals.toFixed(0)}</div>
                  <div className="text-accent/80 text-sm">إجمالي السحوبات</div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => setShowAddMoney(true)}
              className="bg-green-500 text-white p-4 rounded-xl flex flex-col items-center gap-2 hover:bg-green-600 transition-colors shadow-md"
            >
              <Plus className="w-6 h-6" />
              <span className="font-medium">إضافة أموال</span>
            </button>
          </div>

          {/* Transactions History */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-brand" />
              سجل المعاملات
            </h3>
            
            {transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center">
                          {getTransactionIcon(transaction.type)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {formatTransactionType(transaction.type)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {transaction.description}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(transaction.created_at).toLocaleDateString('ar')} - {formatPaymentType(transaction.payment_type)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${getTransactionColor(transaction.type)}`}>
                          {['deposit', 'refund', 'bonus'].includes(transaction.type) ? '+' : '-'}
                          {transaction.amount.toFixed(2)} شيكل
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatTransactionStatus(transaction.status)}
                        </div>
                        {transaction.status === 'pending' && transaction.type === 'deposit' && (
                          <div className="text-xs text-yellow-600 mt-1">
                            في انتظار موافقة المدير
                          </div>
                        )}
                        {transaction.status === 'rejected' && (
                          <div className="text-xs text-red-800 mt-1">
                            مرفوضة
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <History className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>لا توجد معاملات سابقة</p>
              </div>
            )}
          </div>

          {/* Wallet Info */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">معلومات المحفظة</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• يمكنك استخدام رصيد المحفظة للدفع عند إتمام الطلبات</li>
              <li>• يتم إضافة المكافآت والاسترداد تلقائياً إلى محفظتك</li>
              <li>• طلبات الإيداع تبقى معلقة حتى موافقة المدير (24-48 ساعة)</li>
              <li>• جميع المعاملات محمية ومشفرة</li>
              <li>• لا يمكن سحب الأموال من المحفظة، يمكن استخدامها للدفع فقط</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add Money Modal */}
      <AnimatePresence>
        {showAddMoney && (
          <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">إضافة أموال</h3>
                <button
                  onClick={() => {
                    setShowAddMoney(false);
                    setAmount('');
                    setDescription('');
                    setActionError(null);
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddMoney} className="p-4 space-y-4">
                {actionError && (
                  <div className="bg-red-50 text-red-800 p-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p>{actionError}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    المبلغ (شيكل) *
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    min="1"
                    step="0.01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الوصف (اختياري)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="وصف المعاملة"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>

                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-700">
                    <strong>ملاحظة:</strong> سيبقى طلب الإيداع معلقاً حتى يوافق عليه المدير. قد يستغرق 24-48 ساعة للمراجعة والموافقة.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMoney(false);
                      setAmount('');
                      setDescription('');
                      setActionError(null);
                    }}
                    className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !amount || parseFloat(amount) <= 0}
                    className="flex-1 bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        جاري الإضافة...
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        إضافة
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default WalletPage;