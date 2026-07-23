import React from 'react';

const NotificationSkeleton = () => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-slate-200 bg-white shadow-sm animate-pulse">
      <div className="flex-1 flex gap-4 items-start">
        <div className="p-3 w-11 h-11 rounded-full bg-slate-200 flex-shrink-0"></div>
        
        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-start justify-between mb-2">
            <div className="h-4 bg-slate-200 rounded w-1/3"></div>
            <div className="h-3 bg-slate-200 rounded w-16"></div>
          </div>
          
          <div className="space-y-2 mb-3">
            <div className="h-3 bg-slate-200 rounded w-full"></div>
            <div className="h-3 bg-slate-200 rounded w-5/6"></div>
          </div>
          
          <div className="h-4 bg-slate-200 rounded w-20"></div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSkeleton;
