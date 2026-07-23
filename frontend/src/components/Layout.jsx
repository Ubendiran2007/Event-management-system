import React, { useState } from 'react';
import Navbar from './Navbar';
import { Menu, X } from 'lucide-react';
import seceHeader from '../assets/sece header.jpeg';
import { useAppContext } from '../context/AppContext';
import { WorkflowEventsProvider } from '../context/WorkflowEventsContext';
import { OrganizerEventsProvider } from '../context/OrganizerEventsContext';
import { ODWorkflowProvider } from '../context/ODWorkflowContext';
import { useNotifications } from '../hooks/useNotifications';
import NotificationCenter from './NotificationCenter';
import { Bell } from 'lucide-react';

export default function Layout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const { currentUser } = useAppContext();
  const { unreadCount } = useNotifications();

  return (
    <WorkflowEventsProvider>
      <ODWorkflowProvider>
        <OrganizerEventsProvider>
        <div className="h-screen w-full flex flex-col md:flex-row overflow-hidden bg-[#f8fafc]">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 z-40 shrink-0">
        <div className="flex items-center gap-2">
          <img src={seceHeader} alt="SECE" className="w-8 h-8 rounded-lg object-cover" />
          <span className="font-extrabold text-slate-800 text-sm tracking-tight">SECE EVENT HUB</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsNotifOpen(true)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors relative"
          >
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* Desktop Sidebar & Mobile Drawer Wrapper inside Navbar */}
      <Navbar 
        isMobileMenuOpen={isMobileMenuOpen} 
        setIsMobileMenuOpen={setIsMobileMenuOpen} 
      />

      {/* Main Content wrapper */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto relative bg-[#f8fafc]">
        {/* Desktop floating notification bell */}
        <div className="hidden md:flex absolute top-4 right-6 z-40">
          <button 
            onClick={() => setIsNotifOpen(true)}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-xl transition-all shadow-sm relative group"
          >
            <Bell size={20} className="group-hover:animate-pulse" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white shadow-sm ring-2 ring-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* The Notification Center Drawer/Dropdown */}
        <div className="absolute top-16 md:top-16 right-4 md:right-6 z-[100]">
          <NotificationCenter isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
        </div>

        {children}
      </main>
        </div>
        </OrganizerEventsProvider>
      </ODWorkflowProvider>
    </WorkflowEventsProvider>
  );
}
