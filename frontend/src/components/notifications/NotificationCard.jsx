import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Check, Archive, Trash2, Calendar, UserPlus, FileText, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useNotifications } from '../../../hooks/useNotifications';

const getIcon = (iconStr) => {
  switch (iconStr) {
    case 'calendar': return <Calendar className="w-5 h-5" />;
    case 'user-plus': return <UserPlus className="w-5 h-5" />;
    case 'file-text': return <FileText className="w-5 h-5" />;
    case 'check-circle': return <CheckCircle className="w-5 h-5" />;
    case 'alert-triangle': return <AlertTriangle className="w-5 h-5" />;
    case 'alert-circle': return <AlertCircle className="w-5 h-5" />;
    default: return <Info className="w-5 h-5" />;
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

const NotificationCard = ({ notification }) => {
  const navigate = useNavigate();
  const { markAsRead, archiveNotification, deleteNotification } = useNotifications();
  
  const isUnread = notification.status !== 'VIEWED' && notification.status !== 'ARCHIVED';

  const handleClick = () => {
    if (isUnread) markAsRead(notification.id);
    if (notification.deepLink) {
      navigate(notification.deepLink);
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row gap-4 p-4 rounded-xl border transition-all ${isUnread ? 'bg-blue-50/30 border-blue-200 shadow-sm' : 'bg-white border-slate-200 hover:shadow-sm'}`}>
      <div 
        className="flex-1 cursor-pointer flex gap-4 items-start"
        onClick={handleClick}
      >
        <div className={`p-3 rounded-full flex-shrink-0 ${
          notification.color === 'red' ? 'bg-red-100 text-red-600' :
          notification.color === 'yellow' ? 'bg-yellow-100 text-yellow-600' :
          notification.color === 'green' ? 'bg-green-100 text-green-600' :
          'bg-blue-100 text-blue-600'
        }`}>
          {getIcon(notification.icon)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <h4 className={`text-base leading-tight ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
              {notification.title}
            </h4>
            <div className="flex gap-2 items-center ml-2 flex-shrink-0">
              {notification.priority === 'CRITICAL' && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold uppercase">Critical</span>
              )}
              {notification.priority === 'HIGH' && (
                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold uppercase">High</span>
              )}
              <span className="text-xs font-medium text-slate-400 flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1" />
                {formatTimeAgo(notification.createdAt)}
              </span>
            </div>
          </div>
          
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            {notification.message}
          </p>
          
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              {notification.category}
            </span>
            {notification.deepLink && (
              <span className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                View Details &rarr;
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex sm:flex-col justify-end sm:justify-start gap-2 border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-3">
        {isUnread && (
          <button 
            onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center"
            title="Mark as read"
          >
            <Check className="w-4 h-4" />
          </button>
        )}
        {notification.status !== 'ARCHIVED' && (
          <button 
            onClick={(e) => { e.stopPropagation(); archiveNotification(notification.id); }}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </button>
        )}
        <button 
          onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default NotificationCard;
