import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function PremiumDatePicker({ value, onChange, min, max, className, required, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const popupRef = useRef(null);

  // Initialize currentMonth based on value
  useEffect(() => {
    if (value) {
       const d = new Date(value);
       if (!isNaN(d)) setCurrentMonth(d);
    }
  }, [value]);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const isDateDisabled = (year, month, day) => {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (min && dStr < min) return true;
    if (max && dStr > max) return true;
    return false;
  };

  const handleSelect = (day) => {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    // Mimic the native event object so onChange(e) works perfectly everywhere
    const fakeEvent = { target: { value: dStr } };
    if (onChange) onChange(fakeEvent);
    setIsOpen(false);
  };

  const formattedDisplay = value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'dd-mmm-yyyy';

  return (
    <div className="relative" ref={popupRef}>
      <button 
        type="button"
        disabled={disabled}
        className={`flex items-center justify-between w-full px-3 py-2 text-left bg-white border border-slate-300 rounded-lg text-sm shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-indigo-400 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className || ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={value ? 'text-slate-800 font-medium' : 'text-slate-400'}>{formattedDisplay}</span>
        <CalendarIcon size={16} className="text-slate-400" />
      </button>

      {/* Hidden input for HTML form validation if required */}
      {required && <input type="text" className="opacity-0 absolute bottom-0 left-1/2 -z-10 w-1 h-1" required={required} value={value || ''} onChange={() => {}} tabIndex={-1} />}

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 mt-1 p-4 bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-xl rounded-2xl w-[280px] left-0 origin-top-left"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
               <button type="button" onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-600"><ChevronLeft size={16} /></button>
               <div className="font-bold text-slate-800 text-sm">
                 {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
               </div>
               <button type="button" onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-600"><ChevronRight size={16} /></button>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS_OF_WEEK.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d}</div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = value === dStr;
                const isDisabled = isDateDisabled(year, month, day);
                const isToday = dStr === new Date().toISOString().split('T')[0];
                
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleSelect(day)}
                    className={`
                      w-8 h-8 flex items-center justify-center rounded-full text-xs font-semibold transition-all duration-200 mx-auto
                      ${isDisabled ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer'}
                      ${isSelected ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:text-white' : ''}
                      ${!isSelected && isToday ? 'border border-indigo-200 text-indigo-600 bg-indigo-50/50' : ''}
                      ${!isSelected && !isToday && !isDisabled ? 'text-slate-700' : ''}
                    `}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
