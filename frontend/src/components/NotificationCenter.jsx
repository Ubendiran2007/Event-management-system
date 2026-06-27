import React, { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, XCircle, CalendarX, CalendarClock, Bell, FileText } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const NotificationCenter = ({ isOpen, onClose }) => {
  const { currentUser, events, odRequests } = useAppContext();
  const [readNotifs, setReadNotifs] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(`readNotifs_${currentUser?.id}`) || '[]'));
    } catch {
      return new Set();
    }
  });

  // Handle ESC to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const markAsRead = (id) => {
    setReadNotifs((prev) => {
      const next = new Set([...prev, id]);
      localStorage.setItem(`readNotifs_${currentUser?.id}`, JSON.stringify([...next]));
      return next;
    });
  };

  const notifications = useMemo(() => {
    if (!currentUser || (currentUser.role !== 'STUDENT_GENERAL' && currentUser.role !== 'STUDENT_ORGANIZER')) {
      return [];
    }

    const notifs = [];
    const myRequests = odRequests.filter(r => String(r.studentId) === String(currentUser.id) || String(r.userId) === String(currentUser.id));
    
    myRequests.forEach(req => {
      const sourceEvent = events.find(e => e.id === req.eventId);
      const eventName = req.eventTitle || req.eventName || sourceEvent?.title || 'Unknown Event';
      
      if (req.status === 'APPROVED') {
        notifs.push({
          id: `app_${req.id}`, title: 'Registration Approved', description: `Your OD request has been approved by IQAC.`,
          event: eventName, date: req.updatedAt || req.createdAt || new Date().toISOString(), type: 'APPROVED', category: 'Registration'
        });
      } else if (req.status === 'REJECTED') {
        notifs.push({
          id: `rej_${req.id}`, title: 'Registration Rejected', description: `Your OD request was rejected.`,
          event: eventName, date: req.updatedAt || req.createdAt || new Date().toISOString(), type: 'REJECTED', category: 'Registration'
        });
      } else if (req.status === 'WITHDRAWN') {
        notifs.push({
          id: `wth_${req.id}`, title: 'Registration Withdrawn', description: `You have successfully withdrawn your registration.`,
          event: eventName, date: req.withdrawnAt || req.updatedAt || new Date().toISOString(), type: 'WITHDRAWN', category: 'Registration'
        });
      }

      if (sourceEvent && (req.status === 'APPROVED' || req.status.startsWith('PENDING'))) {
        if (sourceEvent.status === 'POSTPONED') {
          notifs.push({
            id: `post_${sourceEvent.id}_${req.id}`, title: 'Event Postponed', description: `The event schedule has been officially updated.`,
            event: eventName, date: sourceEvent.updatedAt || sourceEvent.date || new Date().toISOString(), type: 'POSTPONED', category: 'Event Update'
          });
        } else if (sourceEvent.status === 'CANCELLED') {
          notifs.push({
            id: `canc_${sourceEvent.id}_${req.id}`, title: 'Event Cancelled', description: `This event has been officially cancelled by the institution.`,
            event: eventName, date: sourceEvent.updatedAt || new Date().toISOString(), type: 'CANCELLED', category: 'Event Update'
          });
        }
      }
    });

    return notifs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [currentUser, events, odRequests]);

  const getIcon = (type) => {
    switch(type) {
      case 'APPROVED': return <CheckCircle2 className="text-emerald-500" size={20} />;
      case 'REJECTED': return <XCircle className="text-red-500" size={20} />;
      case 'WITHDRAWN': return <FileText className="text-slate-500" size={20} />;
      case 'POSTPONED': return <CalendarClock className="text-amber-500" size={20} />;
      case 'CANCELLED': return <CalendarX className="text-red-500" size={20} />;
      default: return <Bell className="text-blue-500" size={20} />;
    }
  };

  const formatDate = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Invisible overlay to catch outside clicks without blocking layout */}
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="absolute right-0 top-[calc(100%+12px)] z-[100] w-full max-w-[400px] sm:w-[400px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[#E5E7EB] flex flex-col overflow-hidden max-h-[85vh] sm:max-h-[600px] origin-top-right
                     max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:inset-x-0 max-sm:max-w-none max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:border-b-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                <Bell size={18} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-800 leading-tight">Notifications</h2>
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Live Updates & Alerts</p>
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
          <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-300">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Bell className="text-slate-200 mb-3" size={40} />
                <p className="font-bold text-slate-600">No Notifications</p>
                <p className="text-xs text-slate-500 mt-1">You're all caught up!</p>
              </div>
            ) : (
              notifications.map(notif => {
                const isRead = readNotifs.has(notif.id);
                return (
                  <div 
                    key={notif.id} 
                    onClick={() => markAsRead(notif.id)}
                    className={`relative rounded-xl p-4 border transition-all cursor-pointer shadow-sm hover:shadow-md ${
                      isRead ? 'bg-white border-slate-200 opacity-75' : 'bg-blue-50/30 border-blue-200 hover:border-blue-300'
                    }`}
                  >
                    {!isRead && (
                      <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    )}
                    
                    <div className="flex gap-3">
                      <div className="shrink-0 mt-0.5">
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className={`text-sm leading-tight ${isRead ? 'font-bold text-slate-700' : 'font-extrabold text-slate-900'}`}>
                            {notif.title}
                          </h4>
                        </div>
                        <p className="text-xs text-slate-600 font-medium mb-2 leading-relaxed">
                          {notif.description}
                        </p>
                        
                        <div className="flex flex-col gap-2">
                          <div className="bg-white rounded-md px-2 py-1.5 border border-slate-100 flex items-center gap-1.5 shadow-sm">
                            <FileText size={12} className="text-slate-400 shrink-0" />
                            <span className="text-[11px] font-semibold text-slate-700 truncate">{notif.event}</span>
                          </div>
                          
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                              {notif.category}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                              {formatDate(notif.date)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default NotificationCenter;
