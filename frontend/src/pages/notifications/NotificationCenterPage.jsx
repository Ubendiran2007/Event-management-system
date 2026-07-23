import React, { useEffect, useState } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationCard from '../../components/notifications/NotificationCard';
import NotificationSkeleton from '../../components/notifications/NotificationSkeleton';
import { Filter, Search, CheckCheck, Loader2 } from 'lucide-react';

const CATEGORIES = ['EVENTS', 'REGISTRATIONS', 'OD', 'REPORTS', 'SYSTEM'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['DELIVERED', 'VIEWED', 'ARCHIVED'];

export default function NotificationCenterPage() {
  const { 
    notifications, 
    loading, 
    hasMore, 
    filters, 
    refreshNotifications, 
    loadMore, 
    markAllRead 
  } = useNotifications();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [activePriority, setActivePriority] = useState('');
  const [activeStatus, setActiveStatus] = useState('');

  useEffect(() => {
    refreshNotifications({
      category: activeCategory || undefined,
      priority: activePriority || undefined,
      status: activeStatus || undefined
    });
  }, [activeCategory, activePriority, activeStatus, refreshNotifications]);

  // Client-side search (since full-text search isn't trivial in Firestore without extra setup)
  const filteredNotifications = notifications.filter(n => {
    if (!searchTerm) return true;
    const lowerSearch = searchTerm.toLowerCase();
    return n.title.toLowerCase().includes(lowerSearch) || 
           n.message.toLowerCase().includes(lowerSearch);
  });

  // Grouping by Date
  const groupedNotifications = filteredNotifications.reduce((acc, notif) => {
    const date = new Date(notif.createdAt);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let group = 'Older';
    if (date.toDateString() === today.toDateString()) {
      group = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      group = 'Yesterday';
    } else if (date > new Date(today.setDate(today.getDate() - 7))) {
      group = 'This Week';
    }

    if (!acc[group]) acc[group] = [];
    acc[group].push(notif);
    return acc;
  }, {});

  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Older'];

  return (
    <div className="h-full flex flex-col min-h-0 bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Notification Center</h1>
          <p className="text-sm text-slate-500 font-medium">Manage all your alerts and messages</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text"
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            />
          </div>
          <button 
            onClick={markAllRead}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors shrink-0"
          >
            <CheckCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Mark All Read</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Filters Sidebar */}
        <div className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-4 shrink-0 overflow-y-auto">
          <div className="flex items-center gap-2 font-bold text-slate-700 mb-4">
            <Filter className="w-4 h-4" /> Filters
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Category</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setActiveCategory('')}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm ${!activeCategory ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  All Categories
                </button>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`w-full text-left px-3 py-1.5 rounded text-sm capitalize ${activeCategory === cat ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {cat.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Status</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setActiveStatus('')}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm ${!activeStatus ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  All Statuses
                </button>
                {STATUSES.map(status => (
                  <button
                    key={status}
                    onClick={() => setActiveStatus(status)}
                    className={`w-full text-left px-3 py-1.5 rounded text-sm capitalize ${activeStatus === status ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {status === 'DELIVERED' ? 'Unread' : status.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Priority</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setActivePriority('')}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm ${!activePriority ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  All Priorities
                </button>
                {PRIORITIES.map(priority => (
                  <button
                    key={priority}
                    onClick={() => setActivePriority(priority)}
                    className={`w-full text-left px-3 py-1.5 rounded text-sm capitalize ${activePriority === priority ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {priority.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
          <div className="max-w-3xl mx-auto space-y-8">
            
            {loading && notifications.length === 0 ? (
              <div className="space-y-3">
                <NotificationSkeleton />
                <NotificationSkeleton />
                <NotificationSkeleton />
                <NotificationSkeleton />
                <NotificationSkeleton />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 text-slate-300">
                  <CheckCheck className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-700">No notifications found</h3>
                <p className="text-sm text-slate-500 max-w-sm mt-2">
                  {searchTerm || activeCategory || activeStatus || activePriority 
                    ? "Try adjusting your filters to see more results." 
                    : "You're all caught up! There are no new notifications for you right now."}
                </p>
                {(searchTerm || activeCategory || activeStatus || activePriority) && (
                  <button 
                    onClick={() => {
                      setSearchTerm('');
                      setActiveCategory('');
                      setActivePriority('');
                      setActiveStatus('');
                    }}
                    className="mt-4 text-blue-600 font-semibold hover:underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {groupOrder.map(group => {
                  const groupItems = groupedNotifications[group];
                  if (!groupItems || groupItems.length === 0) return null;
                  
                  return (
                    <div key={group} className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-2">
                        {group}
                      </h3>
                      <div className="space-y-3">
                        {groupItems.map(notif => (
                          <NotificationCard key={notif.id} notification={notif} />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {hasMore && (
                  <div className="pt-4 pb-8 flex justify-center">
                    <button 
                      onClick={loadMore}
                      disabled={loading}
                      className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Load More
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
