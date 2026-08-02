import React, { useEffect, useMemo, useState } from 'react';
import { X, CalendarClock, AlertTriangle, Shield, History, Lock } from 'lucide-react';
import {
  EXTENSION_POLICY,
  getRegistrationMeta,
  isExtensionAllowed,
  formatDeadlineLabel,
  toInputLocal,
  fromInputLocal
} from '../utils/registrationUtils';
import { registrationApi } from '../utils/api';

const statusChip = (label, tone = 'slate') => {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    blue: 'bg-sky-50 text-sky-700 border-sky-200'
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${tones[tone] || tones.slate}`}>
      {label}
    </span>
  );
};

/**
 * DeadlineExtensionModal
 * Dialog for organizers / faculty / admins to extend the registration deadline.
 * Collects a mandatory reason, shows policy limits, and visualises the full
 * deadline history timeline (original → extensions → auto-closed → finalized).
 */
const DeadlineExtensionModal = ({ open, onClose, event, currentUser, onSuccess }) => {
  const meta = useMemo(() => getRegistrationMeta(event), [event]);

  const policy = useMemo(() => isExtensionAllowed(event, currentUser?.role), [event, currentUser]);

  const [newDeadlineLocal, setNewDeadlineLocal] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState(null);

  // Seed minimum new deadline to max(now, currentDeadline) to prevent going backward
  const minLocal = useMemo(() => {
    const now = new Date();
    const cur = meta.currentDeadline ? new Date(meta.currentDeadline) : null;
    const floor = cur && cur > now ? cur : now;
    return toInputLocal(floor);
  }, [meta.currentDeadline]);

  // Maximum default suggestion: today + MAX_EXTENSION_DAYS
  const defaultSuggestion = useMemo(() => {
    const start = meta.currentDeadline ? new Date(meta.currentDeadline) : new Date();
    const floor = start < new Date() ? new Date() : start;
    const then = new Date(floor.getTime() + EXTENSION_POLICY.MAX_EXTENSION_DAYS * 24 * 60 * 60 * 1000);
    return toInputLocal(then);
  }, [meta.currentDeadline]);

  useEffect(() => {
    if (open) {
      setNewDeadlineLocal(defaultSuggestion);
      setReason('');
      setErrorMsg('');
      setHistory(null);
      if (event?.id) {
        registrationApi.history(event.id).then(r => {
          if (r?.success) setHistory(r);
        }).catch(() => {});
      }
    }
  }, [open, event, defaultSuggestion]);

  if (!open || !event) return null;

  const canExtend = policy.allowed && meta.status !== 'FINALIZED';
  const isAdmin = ['SYSTEM_ADMIN', 'IQAC_TEAM'].includes(currentUser?.role);
  const maxDayHint = isAdmin ? 'Unlimited (admin override)' : `${EXTENSION_POLICY.MAX_EXTENSION_DAYS} days`;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setErrorMsg('');
    try {
      const iso = fromInputLocal(newDeadlineLocal);
      if (!iso) throw new Error('Please choose a valid deadline.');
      if (!String(reason).trim()) throw new Error('Reason is mandatory when extending the deadline.');

      const res = await registrationApi.extendDeadline(event.id, { newDeadline: iso, reason: reason.trim() });
      if (!res?.success) throw new Error(res?.message || 'Failed to extend deadline.');

      if (onSuccess) onSuccess(res);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const timeline = history?.timeline || [];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-50 to-sky-50 px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-white shadow-sm border border-indigo-100">
              <CalendarClock className="text-indigo-600" size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Extend Registration Deadline</h3>
              <p className="text-sm text-slate-500 mt-0.5 max-w-md truncate">
                {event?.title || event?.eventName || event?.id}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {meta.status === 'FINALIZED' && statusChip('Locked (Finalized)', 'rose')}
                {meta.status === 'CLOSED' && statusChip('Currently Closed', 'amber')}
                {meta.status === 'OPEN' && statusChip('Currently Open', 'green')}
                {meta.extensionCount > 0 && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isAdmin ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    <Lock size={10} /> {meta.extensionCount} / {isAdmin ? '∞' : EXTENSION_POLICY.MAX_EXTENSIONS} extensions
                  </span>
                )}
                {isAdmin && statusChip('Admin Override', 'blue')}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/70 transition-colors text-slate-500 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Current state summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Current Deadline</div>
              <div className="font-semibold text-slate-800">
                {meta.currentDeadline ? new Date(meta.currentDeadline).toLocaleString() : 'Unset (event start)'}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{formatDeadlineLabel(meta.currentDeadline)}</div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Original Deadline</div>
              <div className="font-semibold text-slate-800">
                {meta.originalDeadline ? new Date(meta.originalDeadline).toLocaleString() : 'Unset'}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Immutable baseline (never overwritten)</div>
            </div>
          </div>

          {/* Policy notice */}
          {!canExtend && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
              <AlertTriangle size={18} className="text-amber-700 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-900 space-y-1">
                <p className="font-semibold">Unable to extend</p>
                <p className="text-amber-800">{policy.reason || 'Registration is already locked.'}</p>
              </div>
            </div>
          )}

          {canExtend && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">New Deadline *</label>
                <input
                  type="datetime-local"
                  disabled={busy}
                  min={minLocal}
                  value={newDeadlineLocal}
                  onChange={(e) => setNewDeadlineLocal(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-sm disabled:opacity-60"
                />
                <div className="mt-1.5 text-xs text-slate-500 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1"><Shield size={11} className="text-slate-400" /> Must be before event start</span>
                  <span className="inline-flex items-center gap-1"><CalendarClock size={11} className="text-slate-400" /> Max extension per request: {maxDayHint}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Reason for Extension *</label>
                <textarea
                  rows={3}
                  disabled={busy || !canExtend}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide a clear justification (required for audit trail, e.g. 'Added more venue capacity', 'Many students on industrial visit')…"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-sm resize-none disabled:opacity-60"
                  maxLength={500}
                />
                <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><History size={11} /> Stored permanently in the audit log</span>
                  <span>{reason.length} / 500 characters</span>
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-xl p-3 bg-rose-50 border border-rose-200 text-sm text-rose-800">
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !canExtend}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-sky-500 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {busy ? 'Extending…' : 'Extend Deadline'}
                </button>
              </div>
            </form>
          )}

          {/* Deadline History / Timeline */}
          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
              <History size={16} className="text-slate-500" /> Deadline Timeline
            </h4>
            {timeline.length === 0 ? (
              <p className="text-xs text-slate-400">No history recorded yet.</p>
            ) : (
              <ol className="relative border-l-2 border-slate-100 ml-2 space-y-4">
                {timeline.map((entry, idx) => (
                  <li key={idx} className="ml-5 relative">
                    <span className={`absolute -left-[27px] top-0.5 w-4 h-4 rounded-full border-4 border-white shadow ${
                      /Finalized/.test(entry.version) ? 'bg-rose-500' :
                      /Closed/.test(entry.version) ? 'bg-amber-500' :
                      /Extension/.test(entry.version) ? 'bg-sky-500' : 'bg-emerald-500'
                    }`} />
                    <div className="text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-800">{entry.version}</span>
                        {entry.registrationCount !== undefined && entry.registrationCount > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {entry.registrationCount} registrations
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {entry.oldDeadline && entry.deadline ? (
                          <>
                            {new Date(entry.oldDeadline).toLocaleString()} →{' '}
                            <strong>{new Date(entry.deadline).toLocaleString()}</strong>
                          </>
                        ) : entry.deadline ? (
                          <strong>{new Date(entry.deadline).toLocaleString()}</strong>
                        ) : null}
                      </div>
                      {entry.reason && <p className="mt-1 text-slate-600 italic">"{entry.reason}"</p>}
                      {entry.changedBy && (
                        <p className="mt-0.5 text-slate-400 text-[11px]">
                          {entry.changedBy?.name || entry.changedBy?.id || entry.changedBy}
                          {entry.changedBy?.role && <span className="mx-1">·</span>}
                          {entry.changedBy?.role}
                          {entry.timestamp && (
                            <> · {new Date(entry.timestamp).toLocaleString()}</>
                          )}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeadlineExtensionModal;
