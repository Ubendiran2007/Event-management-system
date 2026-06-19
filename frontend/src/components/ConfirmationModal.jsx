import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, CheckCircle2, Loader2 } from 'lucide-react';

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  type = 'warning', // 'warning', 'danger', 'info'
  isProcessing = false
}) => {
  if (!isOpen) return null;

  const themes = {
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-100',
      btnBg: 'bg-amber-600 hover:bg-amber-700',
      accentColor: 'border-amber-200'
    },
    danger: {
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-100',
      btnBg: 'bg-red-600 hover:bg-red-700',
      accentColor: 'border-red-200'
    },
    info: {
      icon: CheckCircle2,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-100',
      btnBg: 'bg-blue-600 hover:bg-blue-700',
      accentColor: 'border-blue-200'
    }
  };

  const theme = themes[type] || themes.warning;
  const Icon = theme.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!isProcessing ? onClose : undefined}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className={`relative w-full max-w-md overflow-hidden rounded-3xl border ${theme.accentColor} bg-white shadow-2xl shadow-slate-900/20`}
        >
          {/* Header/Banner */}
          <div className={`h-2 w-full ${theme.btnBg.split(' ')[0]}`} />
          
          <div className="p-8">
            <div className="flex flex-col items-center text-center">
              <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ${theme.iconBg} ${theme.iconColor} shadow-inner`}>
                <Icon size={32} />
              </div>
              
              <h3 className="mb-2 text-xl font-extrabold text-slate-900 tracking-tight">
                {title}
              </h3>
              
              <p className="mb-8 text-sm font-medium leading-relaxed text-slate-500">
                {message}
              </p>
              
              <div className="flex w-full flex-col gap-3 sm:flex-row">
                <button
                  disabled={isProcessing}
                  onClick={onClose}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50"
                >
                  {cancelText}
                </button>
                <button
                  disabled={isProcessing}
                  onClick={onConfirm}
                  className={`flex-1 rounded-2xl ${theme.btnBg} px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  {isProcessing ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    confirmText
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* Close button */}
          {!isProcessing && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition-all"
            >
              <X size={20} />
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConfirmationModal;
