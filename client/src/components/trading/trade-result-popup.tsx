import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TradeResultPopupProps {
  result: 'win' | 'loss' | null;
  amount: number;
  onClose: () => void;
}

export function TradeResultPopup({ result, amount, onClose }: TradeResultPopupProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (result) {
      setIsVisible(true);
      
      const winSound = new Audio('/sounds/win.mp3');
      const lossSound = new Audio('/sounds/loss.mp3');
      
      if (result === 'win') {
        winSound.play().catch(() => {});
      } else {
        lossSound.play().catch(() => {});
      }

      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 500);
      }, 7000);

      return () => clearTimeout(timer);
    }
  }, [result, onClose]);

  if (!result) return null;

  const isWin = result === 'win';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.5, type: 'spring', bounce: 0.4 }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className={`relative p-8 rounded-3xl backdrop-blur-xl border-4 shadow-2xl pointer-events-auto ${
              isWin 
                ? 'bg-gradient-to-br from-emerald-500/30 to-green-600/30 border-emerald-400' 
                : 'bg-gradient-to-br from-red-500/30 to-rose-600/30 border-red-400'
            }`}
          >
            <div className="absolute inset-0 rounded-3xl overflow-hidden">
              <motion.div
                className={`absolute inset-0 ${isWin ? 'bg-emerald-500' : 'bg-red-500'}`}
                animate={{
                  opacity: [0.1, 0.3, 0.1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </div>

            <div className="relative z-10 text-center">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, duration: 0.6, type: 'spring' }}
                className="mb-4"
              >
                {isWin ? (
                  <div className="text-8xl mb-2">🎉</div>
                ) : (
                  <div className="text-8xl mb-2">😢</div>
                )}
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className={`text-6xl font-black mb-4 ${
                  isWin ? 'text-emerald-300' : 'text-red-300'
                }`}
                style={{
                  textShadow: isWin 
                    ? '0 0 20px rgba(16, 185, 129, 0.8), 0 0 40px rgba(16, 185, 129, 0.4)' 
                    : '0 0 20px rgba(239, 68, 68, 0.8), 0 0 40px rgba(239, 68, 68, 0.4)'
                }}
              >
                {isWin ? 'WIN!' : 'LOSS!'}
              </motion.h2>

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 }}
                className={`text-4xl font-bold ${
                  isWin ? 'text-white' : 'text-white'
                }`}
              >
                {isWin ? '+' : '-'}${Math.abs(amount).toFixed(2)}
              </motion.div>

              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ delay: 1, duration: 6 }}
                className={`h-1 mt-6 rounded-full ${
                  isWin ? 'bg-emerald-400' : 'bg-red-400'
                }`}
              />
            </div>

            {isWin && (
              <>
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute text-2xl"
                    initial={{
                      x: 0,
                      y: 0,
                      opacity: 1,
                      scale: 0
                    }}
                    animate={{
                      x: Math.cos(i * 18 * Math.PI / 180) * 200,
                      y: Math.sin(i * 18 * Math.PI / 180) * 200,
                      opacity: 0,
                      scale: 1
                    }}
                    transition={{
                      duration: 1.5,
                      delay: 0.5 + i * 0.02,
                      ease: "easeOut"
                    }}
                    style={{
                      left: '50%',
                      top: '50%',
                    }}
                  >
                    ✨
                  </motion.div>
                ))}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
