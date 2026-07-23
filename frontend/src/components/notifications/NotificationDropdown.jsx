import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Clock, AlertTriangle, AlertCircle, Info, Calendar, UserPlus, FileText, CheckCircle } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

const getIcon = (iconStr) => {
  switch (iconStr) {
    case 'calendar': return <Calendar className="w-4 h-4" />;
    case 'user-plus': return <UserPlus className="w-4 h-4" />;
    case 'file-text': return <FileText className="w-4 h-4" />;
    case 'check-circle': return <CheckCircle className="w-4 h-4" />;
    case 'alert-triangle': return <AlertTriangle className="w-4 h-4" />;
    case 'alert-circle': return <AlertCircle className="w-4 h-4" />;
    default: return <Info className="w-4 h-4" />;
  }
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
  
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const NotificationDropdown = ({ onClose, onMarkAllRead }) => {
  const navigate = useNavigate();
  const { notifications, markAsRead, loading } = useNotifications();
  
  // Show only top 5-10
  const previewList = notifications.slice(0, 5);

  const handleNotificationClick = (notification) => {
    if (notification.status !== 'VIEWED') {
      markAsRead(notification.id);
    }
    if (notification.deepLink) {
      navigate(notification.deepLink);
    }
    onClose();
  };

  const handleViewAll = () => {
    navigate('/notifications');
    onClose();
  };

  return (
    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg border border-slate-200 z-50 flex flex-col overflow-hidden origin-top-right">
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
        <h3 className="font-semibold text-slate-800">Notifications</h3>
        <button 
          onClick={onMarkAllRead}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center"
        >
          <Check className="w-3 h-3 mr-1" />
          Mark all as read
        </button>
      </div>

      <div className="flex-1 overflow-y-auto max-h-96">
        {loading && previewList.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm flex flex-col items-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            Loading...
          </div>
        ) : previewList.length === 0 ? (
          <div className="p-8 text-center text-slate-500 flex flex-col items-center">
            <Bell className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-600">No notifications yet.</p>
            <p className="text-xs text-slate-400">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {previewList.map(n => (
              <div 
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors relative flex items-start gap-3 ${
                  n.status !== 'VIEWED' ? 'bg-blue-50/30' : ''
                }`}
              >
                {n.status !== 'VIEWED' && (
                  <span className="absolute top-4 left-2 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                )}
                
                <div className={`p-2 rounded-full flex-shrink-0 ${
                  n.color === 'red' ? 'bg-red-100 text-red-600' :
                  n.color === 'yellow' ? 'bg-yellow-100 text-yellow-600' :
                  n.color === 'green' ? 'bg-green-100 text-green-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {getIcon(n.icon)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <p className={`text-sm font-medium text-slate-800 truncate ${n.status !== 'VIEWED' ? 'font-semibold' : ''}`}>
                      {n.title}
                    </p>
                    <span className="text-xs text-slate-400 whitespace-nowrap ml-2 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatTimeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">
                    {n.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-slate-100 bg-slate-50">
        <button 
          onClick={handleViewAll}
          className="w-full py-2 text-sm text-center text-blue-600 hover:text-blue-800 font-medium rounded hover:bg-blue-50 transition-colors"
        >
          View All Notifications &rarr;
        </button>
      </div>
    </div>
  );
};

export default NotificationDropdown;
