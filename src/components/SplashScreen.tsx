import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, ShoppingBag } from 'lucide-react';
import { initializeFirebase } from '../lib/firebase';

interface SplashScreenProps {
  onComplete?: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Initialize Firebase early during splash screen
  React.useEffect(() => {
    console.log('🚀 Early Firebase initialization from splash screen...');
    initializeFirebase();

    // Auto complete after 2 seconds
    const timer = setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="z-[9999] flex items-center justify-center overflow-hidden min-h-screen"
      style={{
        background: 'linear-gradient(135deg, #c21d14 0%, #a71e1e 50%, #8b1a1a 100%)'
      }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          duration: 0.5,
          ease: "easeOut"
        }}
        className="relative flex flex-col items-center justify-center"
      >
        {/* Logo Container */}
        <motion.div
          className="relative mb-6"
          animate={{
            scale: [1, 1.05, 1]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <div className="relative w-48 h-48 rounded-3xl bg-white shadow-2xl flex items-center justify-center p-4">
            {imageError ? (
              <div className="relative">
                <motion.div
                  animate={{
                    y: [0, -5, 0]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Phone className="w-20 h-20 text-[#c21d14]" strokeWidth={2.5} />
                </motion.div>
                <motion.div
                  className="absolute -bottom-2 -right-2"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                >
                  <div className="bg-[#FFD700] rounded-full p-2 shadow-lg">
                    <ShoppingBag className="w-8 h-8 text-[#c21d14]" strokeWidth={2.5} />
                  </div>
                </motion.div>
              </div>
            ) : (
              <img
                src="https://fliwyntfvfedslbwkvks.supabase.co/storage/v1/object/public/advertisements/aloo.png"
                alt="الو جيتك"
                className="w-full h-full object-contain"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                loading="eager"
              />
            )}
          </div>

          {/* Decorative Ring */}
          <motion.div
            className="absolute inset-0 rounded-3xl border-4 border-white/30"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.5, 0.2, 0.5]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </motion.div>

        {/* App Name */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: 'Arial, sans-serif' }}>
            الو جيتك
          </h1>
          <p className="text-white/80 text-lg">
            توصيل سريع وموثوق
          </p>
        </motion.div>

        {/* Loading Dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex gap-2 mt-8"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-3 h-3 bg-white rounded-full"
              animate={{
                y: [0, -10, 0],
                opacity: [1, 0.5, 1]
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15
              }}
            />
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default SplashScreen;
