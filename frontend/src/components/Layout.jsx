import React, { useState } from 'react';
import Navbar from './Navbar';
import { Menu, X } from 'lucide-react';
import seceHeader from '../assets/sece header.jpeg';
import { useAppContext } from '../context/AppContext';
import { WorkflowEventsProvider } from '../context/WorkflowEventsContext';
import { OrganizerEventsProvider } from '../context/OrganizerEventsContext';

export default function Layout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { currentUser } = useAppContext();

  return (
    <WorkflowEventsProvider>
      <OrganizerEventsProvider>
        <div className="h-screen w-full flex flex-col md:flex-row overflow-hidden bg-[#f8fafc]">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 z-40 shrink-0">
        <div className="flex items-center gap-2">
          <img src={seceHeader} alt="SECE" className="w-8 h-8 rounded-lg object-cover" />
          <span className="font-extrabold text-slate-800 text-sm tracking-tight">SECE EVENT HUB</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Desktop Sidebar & Mobile Drawer Wrapper inside Navbar */}
      <Navbar 
        isMobileMenuOpen={isMobileMenuOpen} 
        setIsMobileMenuOpen={setIsMobileMenuOpen} 
      />

      {/* Main Content wrapper */}
      {/* We use flex-1 min-w-0 to prevent horizontal overflow in flex layouts */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto relative bg-[#f8fafc]">
        {children}
      </main>
        </div>
      </OrganizerEventsProvider>
    </WorkflowEventsProvider>
  );
}
