import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';

const NotificationContext = createContext(null);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within NotificationProvider');
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [dialogConfig, setDialogConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info', // 'warning', 'danger', 'info', 'success'
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: null,
    onCancel: null,
    hideCancel: false,
  });

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const processMessage = (msg) => {
    if (!msg) return { title: 'Error', message: 'An unknown error occurred.', type: 'danger' };
    
    let processedMessage = String(msg);
    let defaultTitle = 'Operation Failed';
    let defaultType = 'danger';
    let isAuthError = false;

    if (processedMessage.includes('Unauthorized') || processedMessage.includes('session token') || processedMessage.includes('invalid signature') || processedMessage.includes('jwt expired')) {
      defaultTitle = 'Session Expired';
      processedMessage = 'Your session has expired or is no longer valid.\nPlease sign in again to continue.';
      isAuthError = true;
    } else if (processedMessage.includes('Network Error') || processedMessage.includes('Failed to fetch')) {
      defaultTitle = 'Connection Error';
      processedMessage = 'Unable to connect to the server.\nPlease check your internet connection or try again later.';
    } else if (processedMessage.includes('500') || processedMessage.includes('Internal Server Error')) {
      defaultTitle = 'Server Error';
      processedMessage = 'Something went wrong while processing your request.\nPlease try again later.';
    }

    return { defaultTitle, message: processedMessage, defaultType, isAuthError };
  };

  const showDialog = useCallback(({ title, message, type = 'info', confirmText = 'OK', cancelText = 'Cancel', hideCancel = false }) => {
    return new Promise((resolve) => {
      const processed = processMessage(message);
      
      const finalTitle = title || processed.defaultTitle;
      const finalMessage = processed.message;
      const finalType = (type && type !== 'info') ? type : processed.defaultType;
      
      let finalConfirmText = confirmText;
      let finalHideCancel = hideCancel;
      if (processed.isAuthError) {
         finalConfirmText = 'Login Again';
         finalHideCancel = true;
      }

      setDialogConfig({
        isOpen: true,
        title: finalTitle,
        message: finalMessage,
        type: finalType,
        confirmText: finalConfirmText,
        cancelText,
        hideCancel: finalHideCancel,
        onConfirm: () => {
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
          if (processed.isAuthError) {
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('currentUser');
            window.location.href = '/login';
          }
          resolve(true);
        },
        onCancel: () => {
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
          resolve(false);
        }
      });
    });
  }, []);

  return (
    <NotificationContext.Provider value={{ showToast, showDialog }}>
      {children}
      
      {/* Dialog Renderer */}
      <ConfirmationModal
        isOpen={dialogConfig.isOpen}
        onClose={dialogConfig.onCancel}
        onConfirm={dialogConfig.onConfirm}
        title={dialogConfig.title}
        message={dialogConfig.message}
        type={dialogConfig.type === 'success' ? 'info' : dialogConfig.type} 
        confirmText={dialogConfig.confirmText}
        cancelText={dialogConfig.cancelText}
        hideCancel={dialogConfig.hideCancel}
      />

      {/* Toasts Renderer */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto flex items-center gap-3 rounded-xl shadow-xl p-4 min-w-[300px] border ${
                toast.type === 'error' ? 'bg-white border-red-200 text-red-600' :
                toast.type === 'warning' ? 'bg-white border-amber-200 text-amber-600' :
                toast.type === 'info' ? 'bg-white border-blue-200 text-blue-600' :
                'bg-white border-emerald-200 text-emerald-600'
              }`}
            >
              {toast.type === 'error' ? <XCircle size={20} className="text-red-500" /> :
               toast.type === 'warning' ? <AlertTriangle size={20} className="text-amber-500" /> :
               toast.type === 'info' ? <Info size={20} className="text-blue-500" /> :
               <CheckCircle2 size={20} className="text-emerald-500" />}
              
              <span className="text-sm font-semibold text-slate-700 flex-1">{toast.message}</span>
              
              <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
};
