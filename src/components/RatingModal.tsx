import React, { useState, useEffect } from 'react';
import { Star, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  type: 'driver' | 'store' | 'product';
  name: string;
  entityId?: string;
}

const RatingModal: React.FC<RatingModalProps> = ({
  isOpen,
  onClose,
  orderId,
  type,
  name,
  entityId
}) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoveredStar, setHoveredStar] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === 0) {
      setError('يرجى اختيار تقييم');
      return;
    }
    
    if (!user) {
      setError('يجب تسجيل الدخول لإضافة تقييم');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Convert 'store' type to 'vendor' for database compatibility
      const dbType = type === 'store' ? 'vendor' : type;
      
      // Prepare rating data
      const ratingData = {
        order_id: orderId,
        from_type: 'customer',
        from_id: user.customer_id,
        to_type: dbType, // Use the converted type
        to_id: entityId,
        rating: rating,
        comment: comment || null
      };
      
      console.log('Submitting rating:', ratingData);
      
      // Submit rating to database
      const { error: submitError } = await supabase
        .from('ratings')
        .insert(ratingData);
      
      if (submitError) {
        console.error('Error submitting rating:', submitError);
        throw submitError;
      }
      
      // Show success message
      setSuccess(true);
      
      // Reset form after 2 seconds and close
      setTimeout(() => {
        setRating(0);
        setComment('');
        onClose();
      }, 2000);
      
    } catch (error) {
      console.error('Error submitting rating:', error);
      setError('فشل إرسال التقييم. الرجاء المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-md relative overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              تقييم {type === 'driver' ? 'السائق' : type === 'store' ? 'المتجر' : 'المنتج'} {name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              كيف كانت تجربتك؟
            </p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => setRating(star)}
                  className="focus:outline-none"
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      star <= (hoveredStar || rating)
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            {error && (
              <div className="bg-[#1759cb]/10 text-[#1759cb] p-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">
                تم إرسال تقييمك بنجاح!
              </div>
            )}
            
            <label
              htmlFor="comment"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              تعليقك (اختياري)
            </label>
            <textarea
              id="comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="اكتب تعليقك هنا..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand resize-none"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-700 hover:text-gray-900 transition-colors"
              disabled={loading}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={!rating}
              className="px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                  <span>جاري الإرسال...</span>
                </>
              ) : (
                'إرسال التقييم'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default RatingModal;