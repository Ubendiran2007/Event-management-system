import React, { useEffect, useState } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationCard from '../../components/notifications/NotificationCard';
import NotificationSkeleton from '../../components/notifications/NotificationSkeleton';
import Layout from '../../components/Layout';
import { Bell, Search, CheckCheck, Loader2, SlidersHorizontal, X, ChevronDown } from 'lucide-react';

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
  const [openFilter, setOpenFilter] = useState(null);

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

  const hasActiveFilters = Boolean(searchTerm || activeCategory || activeStatus || activePriority);
  const clearFilters = () => { setSearchTerm(''); setActiveCategory(''); setActivePriority(''); setActiveStatus(''); };
  const filterLabel = (value, allLabel, status = false) => {
    if (!value) return allLabel;
    if (status && value === 'DELIVERED') return 'Unread';
    return value[0] + value.slice(1).toLowerCase();
  };
  const renderFilterMenu = (key, value, allLabel, options, onChange, isStatus = false) => (
    <div className="relative">
      <button onClick={() => setOpenFilter(openFilter === key ? null : key)} className="flex min-w-[180px] items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-800 shadow-sm transition hover:bg-slate-50">
        <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-slate-500" />{filterLabel(value, allLabel, isStatus)}</span><ChevronDown className="h-4 w-4 text-slate-500" />
      </button>
      {openFilter === key && <><div className="fixed inset-0 z-40" onClick={() => setOpenFilter(null)} /><div className="absolute right-0 z-50 mt-2 min-w-full overflow-hidden rounded-2xl border border-slate-100 bg-white py-1 shadow-xl">{[{ value: '', label: allLabel }, ...options.map((option) => ({ value: option, label: filterLabel(option, option, isStatus) }))].map((option) => <button key={option.value} onClick={() => { onChange(option.value); setOpenFilter(null); }} className={`block w-full px-4 py-2.5 text-left text-sm font-bold transition ${value === option.value ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>{option.label}</button>)}</div></>}
    </div>
  );

  return (
    <Layout>
    <div className="flex h-full min-h-0 flex-col bg-[#eef3fb]">
      <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
        <div className="mx-auto flex w-full max-w-6xl flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3"><span className="rounded-2xl bg-blue-50 p-3 text-blue-600"><Bell className="h-6 w-6" /></span><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Message inbox</p><h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Notification Center</h1><p className="mt-0.5 text-sm text-slate-500">Manage your alerts, updates and institutional messages.</p></div></div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><div className="relative min-w-0 sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search notifications..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" /></div><button onClick={markAllRead} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"><CheckCheck className="h-4 w-4" /> Mark all read</button></div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto w-full max-w-6xl space-y-5">
          <section className="flex flex-wrap items-center justify-end gap-2">{renderFilterMenu('category', activeCategory, 'All categories', CATEGORIES, setActiveCategory)}{renderFilterMenu('status', activeStatus, 'All statuses', STATUSES, setActiveStatus, true)}{renderFilterMenu('priority', activePriority, 'All priorities', PRIORITIES, setActivePriority)}</section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between"><div><h2 className="font-extrabold text-slate-900">Recent notifications</h2><p className="mt-0.5 text-sm text-slate-500">{filteredNotifications.length} notification{filteredNotifications.length === 1 ? '' : 's'} in this view</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{activeStatus === 'DELIVERED' ? 'Unread' : 'All messages'}</span></div>
            <div className="mx-auto max-w-4xl space-y-7">
            
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
                    onClick={clearFilters}
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
          </section>
        </div>
      </main>
    </div>
    </Layout>
  );
}
