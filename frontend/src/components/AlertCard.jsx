import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';

const AlertCard = ({ type = 'error', title, message, actionButton, onClose }) => {
  if (!title && !message) return null;

  const config = {
    error: {
      icon: XCircle,
      bg: 'bg-red-50',
      border: 'border-red-200',
      iconColor: 'text-red-500',
      titleColor: 'text-red-800',
      textColor: 'text-red-600'
    },
    warning: {
      icon: AlertTriangle,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      iconColor: 'text-amber-500',
      titleColor: 'text-amber-800',
      textColor: 'text-amber-700'
    },
    success: {
      icon: CheckCircle2,
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      iconColor: 'text-emerald-500',
      titleColor: 'text-emerald-800',
      textColor: 'text-emerald-600'
    },
    info: {
      icon: Info,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      iconColor: 'text-blue-500',
      titleColor: 'text-blue-800',
      textColor: 'text-blue-600'
    }
  };

  const style = config[type] || config.error;
  const Icon = style.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={`w-full p-4 rounded-xl border ${style.bg} ${style.border} flex items-start gap-3 shadow-sm mb-4`}
      >
        <Icon className={`shrink-0 mt-0.5 ${style.iconColor}`} size={20} />
        <div className="flex-1 min-w-0">
          {title && <h4 className={`text-sm font-bold ${style.titleColor} mb-1`}>{title}</h4>}
          <div className={`text-sm ${style.textColor} whitespace-pre-wrap leading-relaxed`}>
            {message}
          </div>
          {actionButton && (
            <div className="mt-3">
              {actionButton}
            </div>
          )}
        </div>
        {onClose && (
          <button 
            type="button"
            onClick={onClose}
            className={`p-1 hover:bg-black/5 rounded-full transition-colors ${style.iconColor} opacity-70 hover:opacity-100`}
          >
            <X size={16} />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default AlertCard;
