import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const formatTime12 = (t24) => {
  if (!t24) return "-";
  try {
    const [h, m] = t24.split(':');
    const hh = parseInt(h, 10);
    const suffix = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:${m} ${suffix}`;
  } catch (e) {
    return t24;
  }
};

// ── Wheel Column ─────────────────────────────────────────────────────────────
const ITEM_H = 40;
const VISIBLE = 3; // must be odd
const PAD = Math.floor(VISIBLE / 2); // = 1 padding row top & bottom

const WheelColumn = ({ items, selectedIndex, onSelect }) => {
  const containerH = ITEM_H * VISIBLE;
  const ref = useRef(null);
  const settling = useRef(false);
  const debounceTimer = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    settling.current = true;
    el.scrollTo({ top: selectedIndex * ITEM_H, behavior: 'smooth' });
    const t = setTimeout(() => { settling.current = false; }, 350);
    return () => clearTimeout(t);
  }, [selectedIndex]);

  const handleScroll = useCallback(() => {
    if (settling.current) return;
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      onSelect(clamped);
    }, 80);
  }, [items.length, onSelect]);

  return (
    <div className="relative" style={{ height: containerH, width: 64, overflowX: 'hidden' }}>
      {/* Selection highlight band */}
      <div
        className="absolute left-0 right-0 pointer-events-none z-10 rounded-lg"
        style={{
          top: ITEM_H * PAD,
          height: ITEM_H,
          background: 'rgba(37,99,235,0.08)',
          borderTop: '1.5px solid rgba(37,99,235,0.22)',
          borderBottom: '1.5px solid rgba(37,99,235,0.22)',
        }}
      />
      {/* Top gradient fade */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none z-10"
        style={{ height: ITEM_H, background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)' }} />
      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10"
        style={{ height: ITEM_H, background: 'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)' }} />

      <div
        ref={ref}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {Array.from({ length: PAD }).map((_, i) => (
          <div key={`t${i}`} style={{ height: ITEM_H, scrollSnapAlign: 'start', flexShrink: 0 }} />
        ))}

        {items.map((item, idx) => {
          const active = idx === selectedIndex;
          return (
            <div
              key={item}
              onClick={() => { settling.current = true; onSelect(idx); }}
              className="flex items-center justify-center cursor-pointer select-none"
              style={{
                height: ITEM_H,
                scrollSnapAlign: 'start',
                fontWeight: active ? 700 : 400,
                fontSize: active ? 18 : 14,
                color: active ? '#1d4ed8' : '#94a3b8',
                transform: active ? 'scale(1.06)' : 'scale(1)',
                transition: 'all 0.18s cubic-bezier(0.34,1.4,0.64,1)',
                letterSpacing: active ? '0.04em' : '0',
              }}
            >
              {item}
            </div>
          );
        })}

        {Array.from({ length: PAD }).map((_, i) => (
          <div key={`b${i}`} style={{ height: ITEM_H, scrollSnapAlign: 'start', flexShrink: 0 }} />
        ))}
      </div>
    </div>
  );
};

// ── TimePicker ─────────────────────────────────────────────────────────────
const HOURS   = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

const parseVal = (v) => {
  const safe = v || '09:00';
  const [hStr, mStr] = safe.split(':');
  const hh = parseInt(hStr, 10) || 9;
  const mm = parseInt(mStr, 10) || 0;
  return {
    hourIdx: (hh % 12 || 12) - 1,
    minIdx: mm,
    ampm: hh >= 12 ? 'PM' : 'AM',
  };
};

const TimePicker = ({ id, value, onChange, onBlur, className }) => {
  const { hourIdx, minIdx, ampm: initAmpm } = parseVal(value);

  const [open, setOpen]           = useState(false);
  const [draftHour, setDraftHour] = useState(hourIdx);
  const [draftMin,  setDraftMin]  = useState(minIdx);
  const [draftAmpm, setDraftAmpm] = useState(initAmpm);
  const [openUpward, setOpenUpward] = useState(false);
  const [fixedCoords, setFixedCoords] = useState({ top: 'auto', left: 0, bottom: 'auto' });
  const triggerRef = useRef(null);
  const popupRef   = useRef(null);

  // Keep draft in sync with external value
  useEffect(() => {
    const { hourIdx: h, minIdx: m, ampm: a } = parseVal(value);
    setDraftHour(h);
    setDraftMin(m);
    setDraftAmpm(a);
  }, [value]);

  const updateCoords = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const isUpward = (window.innerHeight - rect.bottom) < 290;
      setOpenUpward(isUpward);
      setFixedCoords({
        left: rect.left,
        top: isUpward ? 'auto' : rect.bottom + 6,
        bottom: isUpward ? window.innerHeight - rect.top + 6 : 'auto',
      });
    }
  }, []);

  // Decide open direction before showing
  const handleOpen = () => {
    if (!open) {
      updateCoords();
    }
    setOpen((o) => !o);
  };

  // Close on outside click & update coords on scroll/resize
  useEffect(() => {
    if (!open) return;

    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords, true);

    const handler = (e) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        setOpen(false);
        onBlur && onBlur();
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords, true);
      document.removeEventListener('mousedown', handler, true);
    };
  }, [open, onBlur, updateCoords]);

  const commit = () => {
    let h24 = draftHour + 1;
    if (draftAmpm === 'PM' && h24 < 12) h24 += 12;
    if (draftAmpm === 'AM' && h24 === 12) h24 = 0;
    onChange({ target: { id, value: `${h24.toString().padStart(2,'0')}:${draftMin.toString().padStart(2,'0')}` } });
    setOpen(false);
    onBlur && onBlur();
  };

  const cancel = () => {
    const { hourIdx: h, minIdx: m, ampm: a } = parseVal(value);
    setDraftHour(h); setDraftMin(m); setDraftAmpm(a);
    setOpen(false);
  };

  const previewH   = HOURS[draftHour]  ?? '09';
  const previewM   = MINUTES[draftMin] ?? '00';
  const previewKey = `${previewH}${previewM}${draftAmpm}`;
  const displayTime = formatTime12(value || '09:00');

  return (
    <div className="relative inline-block">
      {/* ── Trigger button ── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={`${(className || '').replace(/w-full/g, '').trim()} inline-flex items-center gap-2 cursor-pointer select-none transition-colors`}
        style={{ width: 'max-content', minWidth: 120 }}
      >
        <svg className="text-slate-400 shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span className="font-semibold text-slate-700 text-sm tracking-wide">{displayTime}</span>
        <svg className="text-slate-400 shrink-0 ml-auto" width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* ── Wheel Popup via Portal ── */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={popupRef}
              initial={{ opacity: 0, y: openUpward ? 6 : -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: openUpward ? 6 : -6, scale: 0.97 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              className="fixed z-[9999] bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden"
              style={{
                minWidth: 252,
                left: fixedCoords.left,
                top: fixedCoords.top,
                bottom: fixedCoords.bottom,
              }}
            >
            {/* Header */}
            <div className="bg-gradient-to-br from-blue-400 to-blue-500 px-4 py-3 flex flex-col items-center gap-0.5">
              <span className="text-blue-100 text-[10px] font-bold uppercase tracking-[0.18em]">Selected Time</span>
              <motion.span
                key={previewKey}
                initial={{ opacity: 0.4, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.12 }}
                className="text-white font-bold tabular-nums"
                style={{ fontSize: 29, lineHeight: 1, letterSpacing: '0.04em' }}
              >
                {previewH}:{previewM}
                <span className="ml-1.5 text-blue-100" style={{ fontSize: 16, fontWeight: 600 }}>{draftAmpm}</span>
              </motion.span>
            </div>

            {/* Column labels */}
            <div className="flex items-center justify-center gap-1 pt-2 px-3">
              <div className="w-[64px] text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hour</div>
              <div className="w-3" />
              <div className="w-[64px] text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Min</div>
              <div className="w-[66px]" />
            </div>

            {/* Wheels */}
            <div className="flex items-center justify-center gap-1 px-3 pb-1.5">
              <WheelColumn items={HOURS}   selectedIndex={draftHour} onSelect={setDraftHour} />
              <div className="text-xl font-bold text-slate-300 shrink-0">:</div>
              <WheelColumn items={MINUTES} selectedIndex={draftMin}  onSelect={setDraftMin} />

              {/* AM / PM */}
              <div className="flex flex-col gap-1.5 ml-2 shrink-0">
                {['AM', 'PM'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDraftAmpm(p)}
                    className={`w-[50px] py-2.5 rounded-lg text-xs font-bold transition-all border ${
                      draftAmpm === p
                        ? 'bg-cse-accent text-white border-cse-accent shadow-sm shadow-blue-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-3 pb-3 pt-0.5">
              <button type="button" onClick={cancel}
                className="flex-1 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={commit}
                className="flex-1 py-2 rounded-lg text-sm font-bold bg-cse-accent text-white hover:bg-blue-700 transition-colors shadow-sm">
                Apply
              </button>
            </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default TimePicker;
