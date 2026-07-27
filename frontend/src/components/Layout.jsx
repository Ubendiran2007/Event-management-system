import React, { useState } from 'react';
import Navbar from './Navbar';
import { Menu } from 'lucide-react';
import seceHeader from '../assets/sece header.jpeg';

export default function Layout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
        <div className="h-screen w-full flex flex-col md:flex-row overflow-hidden bg-[#e8edf5]">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 z-40 shrink-0">
        <div className="flex items-center gap-2">
          <img src={seceHeader} alt="SECE" className="w-8 h-8 rounded-lg object-cover" />
          <span className="font-extrabold text-slate-800 text-sm tracking-tight">SECE EVENT HUB</span>
        </div>
        <div>
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
      <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto relative bg-[#e8edf5]">
        {children}
      </main>
        </div>
  );
}
