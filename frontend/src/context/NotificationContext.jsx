import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from './AppContext';
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

  const { currentUser } = useAppContext();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Firestore Real-time Listener for current user's notifications
  useEffect(() => {
    if (!currentUser?.id && !currentUser?.rollNo) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const userId = currentUser.id || currentUser.rollNo;
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('status', 'in', ['DELIVERED', 'VIEWED']),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = [];
      let unread = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        notifs.push({ id: doc.id, ...data });
        if (data.status === 'DELIVERED') {
          unread++;
        }
      });
      setNotifications(notifs);
      setUnreadCount(unread);
    }, (error) => {
      console.error('[NotificationContext] Error fetching notifications:', error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const markAsRead = useCallback(async (notificationId) => {
    // Optimistic UI Update
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, status: 'VIEWED' } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    try {
      const ref = doc(db, 'notifications', notificationId);
      await updateDoc(ref, { 
        status: 'VIEWED',
        viewedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('[NotificationContext] markAsRead failed:', error);
      // Depending on strictness, we might want to revert the optimistic update here.
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!currentUser) return;
    const userId = currentUser.id || currentUser.rollNo;
    
    // Optimistic UI
    setNotifications(prev => prev.map(n => n.status === 'DELIVERED' ? { ...n, status: 'VIEWED' } : n));
    setUnreadCount(0);

    try {
      await fetch('/api/notifications/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'MARK_ALL_READ' })
      });
    } catch (error) {
      console.error('[NotificationContext] markAllAsRead failed:', error);
    }
  }, [currentUser]);

  const archiveAllRead = useCallback(async () => {
    if (!currentUser) return;
    const userId = currentUser.id || currentUser.rollNo;
    
    // Optimistic UI
    setNotifications(prev => prev.filter(n => n.status !== 'VIEWED'));

    try {
      await fetch('/api/notifications/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'ARCHIVE_ALL' })
      });
    } catch (error) {
      console.error('[NotificationContext] archiveAllRead failed:', error);
    }
  }, [currentUser]);

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
    <NotificationContext.Provider value={{ 
      showToast, 
      showDialog, 
      notifications, 
      unreadCount, 
      markAsRead, 
      markAllAsRead, 
      archiveAllRead 
    }}>
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
