import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, XCircle, CalendarX, CalendarClock, Bell, FileText, CheckCheck, ArchiveX } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';

const NotificationCenter = ({ isOpen, onClose }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, archiveAllRead } = useNotification();
  const navigate = useNavigate();

  // Handle ESC to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Separate Unread from History
  const unreadNotifs = notifications.filter(n => n.status === 'DELIVERED');
  const historyNotifs = notifications.filter(n => n.status === 'VIEWED');

  const handleNotificationClick = (notif) => {
    if (notif.status === 'DELIVERED') {
      markAsRead(notif.id);
    }
    if (notif.deepLink) {
      onClose();
      navigate(notif.deepLink);
    }
  };

  const renderIcon = (iconName, color) => {
    let IconComponent = Bell;
    switch(iconName) {
      case 'calendar-check': IconComponent = CheckCircle2; break; // Simple fallback
      case 'user-check': IconComponent = CheckCircle2; break;
      case 'file-check': IconComponent = FileText; break;
      case 'alert-triangle': IconComponent = CalendarX; break;
      default: IconComponent = Bell;
    }
    
    let colorClass = 'text-blue-500 bg-blue-50';
    if (color === 'green') colorClass = 'text-emerald-500 bg-emerald-50';
    if (color === 'red') colorClass = 'text-red-500 bg-red-50';
    if (color === 'amber' || color === 'orange') colorClass = 'text-amber-500 bg-amber-50';

    return (
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
        <IconComponent size={20} />
      </div>
    );
  };

  const formatDate = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const renderNotificationCard = (notif, isUnread) => (
    <div 
      key={notif.id} 
      onClick={() => handleNotificationClick(notif)}
      className={`relative rounded-xl p-4 border transition-all cursor-pointer shadow-sm hover:shadow-md ${
        isUnread ? 'bg-blue-50/30 border-blue-200 hover:border-blue-300' : 'bg-white border-slate-200 opacity-80 hover:opacity-100'
      }`}
    >
      {isUnread && (
        <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
      )}
      
      <div className="flex gap-4 items-start">
        {renderIcon(notif.icon, notif.color)}
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className={`text-sm leading-tight ${isUnread ? 'font-extrabold text-slate-900' : 'font-bold text-slate-700'}`}>
              {notif.title}
            </h4>
          </div>
          <p className="text-xs text-slate-600 font-medium mb-2 leading-relaxed">
            {notif.message}
          </p>
          
          <div className="flex justify-between items-center mt-1">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
              {notif.category}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold shrink-0">
              {formatDate(notif.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="absolute right-0 top-[calc(100%+12px)] z-[100] w-full max-w-[400px] sm:w-[420px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[#E5E7EB] flex flex-col overflow-hidden max-h-[85vh] sm:max-h-[600px] origin-top-right
                     max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:inset-x-0 max-sm:max-w-none max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:border-b-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 relative">
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-800 leading-tight">Notifications</h2>
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Live Updates</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-300">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Bell className="text-slate-200 mb-3" size={40} />
                <p className="font-bold text-slate-600">No Notifications</p>
                <p className="text-xs text-slate-500 mt-1">You're all caught up!</p>
              </div>
            ) : (
              <>
                {/* Unread Section */}
                {unreadNotifs.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unread ({unreadNotifs.length})</h3>
                      <button onClick={markAllAsRead} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                        <CheckCheck size={14} /> Mark all read
                      </button>
                    </div>
                    {unreadNotifs.map(n => renderNotificationCard(n, true))}
                  </div>
                )}

                {/* History Section */}
                {historyNotifs.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Earlier</h3>
                      <button onClick={archiveAllRead} className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1">
                        <ArchiveX size={14} /> Archive
                      </button>
                    </div>
                    {historyNotifs.map(n => renderNotificationCard(n, false))}
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default NotificationCenter;
