import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users, Search, CheckCircle2, XCircle, Clock, ClipboardList,
  Loader2, FileCheck, CalendarClock, History, AlertTriangle, Check,
  UserCheck, Ban
} from 'lucide-react';
import { formatStudentNameWithRoll, fallbackValue } from '../utils/formatters';
import { registrationApi } from '../utils/api';
import {
  INDIVIDUAL_REGISTRATION_STATUSES,
  REGISTRATION_STATUSES,
  getRegistrationMeta,
  formatDeadlineLabel,
  isExtensionAllowed,
  isRoleAllowedToExtend
} from '../utils/registrationUtils';
import DeadlineExtensionModal from './DeadlineExtensionModal';
import ConfirmationModal from './ConfirmationModal';

const STATUS_STYLE = {
  [INDIVIDUAL_REGISTRATION_STATUSES.PENDING]: {
    chip: 'bg-amber-50 text-amber-800 border-amber-200',
    ring: 'ring-amber-300',
    pill: 'bg-amber-500'
  },
  [INDIVIDUAL_REGISTRATION_STATUSES.APPROVED]: {
    chip: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    ring: 'ring-emerald-300',
    pill: 'bg-emerald-500'
  },
  [INDIVIDUAL_REGISTRATION_STATUSES.REJECTED]: {
    chip: 'bg-rose-50 text-rose-800 border-rose-200',
    ring: 'ring-rose-300',
    pill: 'bg-rose-500'
  },
  [INDIVIDUAL_REGISTRATION_STATUSES.WAITLISTED]: {
    chip: 'bg-sky-50 text-sky-800 border-sky-200',
    ring: 'ring-sky-300',
    pill: 'bg-sky-500'
  },
  [INDIVIDUAL_REGISTRATION_STATUSES.WITHDRAWN]: {
    chip: 'bg-slate-100 text-slate-600 border-slate-200',
    ring: 'ring-slate-300',
    pill: 'bg-slate-500'
  }
};

function normaliseStatus(raw) {
  if (raw === 'REGISTERED') return INDIVIDUAL_REGISTRATION_STATUSES.APPROVED;
  if (raw === 'PENDING_APPROVAL') return INDIVIDUAL_REGISTRATION_STATUSES.PENDING;
  return raw || INDIVIDUAL_REGISTRATION_STATUSES.PENDING;
}

const StatusChip = ({ value }) => {
  const v = normaliseStatus(value);
  const style = STATUS_STYLE[v] || STATUS_STYLE[INDIVIDUAL_REGISTRATION_STATUSES.PENDING];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${style.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.pill}`} />
      {v}
    </span>
  );
};

const KPI = ({ label, value, icon: Icon, tone, hint, onClick, disabled, selected }) => {
  const tones = {
    slate: 'bg-slate-50 border-slate-200 hover:border-slate-300',
    amber: 'bg-amber-50 border-amber-200 hover:border-amber-300',
    emerald: 'bg-emerald-50 border-emerald-200 hover:border-emerald-300',
    rose: 'bg-rose-50 border-rose-200 hover:border-rose-300',
    sky: 'bg-sky-50 border-sky-200 hover:border-sky-300'
  };
  const iconTones = {
    slate: 'text-slate-600',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    sky: 'text-sky-700'
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left w-full rounded-xl border p-4 transition-all ${tones[tone] || tones.slate} ${
        selected ? `ring-2 ${STATUS_STYLE?.[value]?.ring || 'ring-indigo-400'} scale-[1.01]` : ''
      } disabled:cursor-not-allowed disabled:opacity-70`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</div>
          <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{value}</div>
          {hint && <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>}
        </div>
        <div className={`${iconTones[tone] || iconTones.slate}`}>
          <Icon size={22} strokeWidth={2.2} />
        </div>
      </div>
    </button>
  );
};

/**
 * Registration Dashboard tab (replaces a simple OD request list view).
 * Queries the new `/api/events/:id/registrations` endpoint. Falls back to
 * rendering old OD-request style list when the registration endpoint is not
 * available (backward compat with older deploys).
 */
const RegistrationsTab = ({ event, odRequests = [], currentUser, onRefreshEvent }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ PENDING: 0, APPROVED: 0, REJECTED: 0, WAITLISTED: 0, WITHDRAWN: 0, TOTAL: 0 });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(null); // 'APPROVE' | 'REJECT' | 'FINALIZE'

  const [extensionOpen, setExtensionOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(null); // studentId for single-line reject reason dialog

  // Finalize checklist state
  const [finalizeMode, setFinalizeMode] = useState('REVIEW'); // REVIEW | AUTO_REJECT | ACKNOWLEDGE
  const [finalizePendingReason, setFinalizePendingReason] = useState('Not selected after registration review');
  const [finalizeCheckedAck, setFinalizeCheckedAck] = useState(false);

  const meta = useMemo(() => getRegistrationMeta(event), [event]);
  const canExtend = useMemo(() => {
    const policy = isExtensionAllowed(event, currentUser?.role);
    return policy.allowed && isRoleAllowedToExtend(currentUser?.role, event, currentUser?.id);
  }, [event, currentUser]);

  const isFinalized = meta.status === REGISTRATION_STATUSES.FINALIZED;

  const fetchData = useCallback(async () => {
    if (!event?.id) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await registrationApi.list(event.id, { status: statusFilter === 'ALL' ? '' : statusFilter, limit: 500 });
      if (res?.success) {
        setItems(res.items || []);
        if (res.counts) setCounts(res.counts);
      } else {
        throw new Error(res?.message || 'Failed to load registrations');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Unable to load registrations');
    } finally {
      setLoading(false);
    }
  }, [event?.id, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(r => {
      const hay = [r.userName, r.name, r.userEmail, r.email, r.rollNo, r.userYear, r.userClass, r.class]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [items, searchQuery]);

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (filteredItems.length === 0) return;
    const allThere = filteredItems.every(r => selected.has(r.studentId || r.userId || r.id));
    const next = new Set(selected);
    if (allThere) {
      filteredItems.forEach(r => next.delete(r.studentId || r.userId || r.id));
    } else {
      filteredItems.forEach(r => next.add(r.studentId || r.userId || r.id));
    }
    setSelected(next);
  };

  const doBulkApprove = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkBusy('APPROVE');
    try {
      const res = await registrationApi.bulkApprove(event.id, ids);
      if (!res?.success) throw new Error(res?.message || 'Bulk approve failed');
      setSelected(new Set());
      await fetchData();
      if (onRefreshEvent) onRefreshEvent();
    } catch (err) {
      setErrorMsg(err.message || 'Bulk approve failed');
    } finally {
      setBulkBusy(null);
    }
  };

  const confirmBulkReject = () => setRejectOpen('__BULK__');

  const doReject = async (reasonText) => {
    const isBulk = rejectOpen === '__BULK__';
    const ids = isBulk ? [...selected] : [rejectOpen];
    if (ids.length === 0 || ids.some(i => !i)) { setRejectOpen(null); return; }
    setBulkBusy('REJECT');
    try {
      const res = await registrationApi.bulkReject(event.id, ids, reasonText);
      if (!res?.success) throw new Error(res?.message || 'Bulk reject failed');
      setSelected(new Set());
      setRejectOpen(null);
      setRejectReason('');
      await fetchData();
      if (onRefreshEvent) onRefreshEvent();
    } catch (err) {
      setErrorMsg(err.message || 'Reject failed');
      setBulkBusy(null);
    }
  };

  const setSingleStatus = async (studentId, status) => {
    if (studentId) {
      try {
        const res = await registrationApi.setStatus(event.id, studentId, status);
        if (!res?.success) throw new Error(res?.message || 'Status change failed');
        await fetchData();
        if (onRefreshEvent) onRefreshEvent();
      } catch (err) {
        setErrorMsg(err.message || 'Status change failed');
      }
    }
  };

  const doFinalize = async () => {
    setBulkBusy('FINALIZE');
    try {
      const pendingCount = counts?.PENDING || 0;
      let payload;
      if (pendingCount > 0) {
        if (finalizeMode === 'AUTO_REJECT') {
          payload = {
            confirm: true,
            autoRejectPending: true,
            pendingRejectionReason: String(finalizePendingReason || '').trim() || 'Not selected after registration review'
          };
        } else if (finalizeMode === 'ACKNOWLEDGE') {
          if (!finalizeCheckedAck) throw new Error('Please acknowledge that pending registrations will remain unresolved and receive no email.');
          payload = { confirm: true, acknowledgePending: true };
        } else {
          throw new Error('Please choose how to handle remaining pending registrations.');
        }
      } else {
        payload = { confirm: true };
      }
      const res = await registrationApi.finalizeWithOptions(event.id, payload);
      if (!res?.success) throw new Error(res?.message || 'Failed to finalize');
      setFinalizeOpen(false);
      setFinalizeMode('REVIEW');
      setFinalizeCheckedAck(false);
      setFinalizePendingReason('Not selected after registration review');
      await fetchData();
      if (onRefreshEvent) onRefreshEvent();
    } catch (err) {
      setErrorMsg(err.message || 'Finalize failed');
    } finally {
      setBulkBusy(null);
    }
  };

  const totalSelected = selected.size;

  // Fallback: render old OD-request table when no endpoint data was returned, to preserve legacy UX
  const shouldFallback = !loading && errorMsg && items.length === 0 && !event?.id;
  if (shouldFallback || (odRequests?.length > 0 && !event?.id)) {
    const eventRequests = odRequests.filter(req => req.eventId === (event?.id || ''));
    const isVolunteerEnabled = Boolean(event?.registrationOptions?.allowVolunteer);
    const fR = eventRequests.filter(req => {
      const sL = searchQuery.toLowerCase();
      return (req.studentName || '').toLowerCase().includes(sL) || (req.rollNo || '').toLowerCase().includes(sL);
    });
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-800">Event Registrations</h3>
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold ml-2">{fR.length}</span>
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text" placeholder="Search by name or roll no..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                  <th className="p-4 w-16 text-center">S.No</th>
                  <th className="p-4 w-32">Roll No</th>
                  <th className="p-4 min-w-[200px]">Student Name</th>
                  <th className="p-4 w-32">Class</th>
                  {isVolunteerEnabled && <th className="p-4 w-32">Type</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fR.length > 0 ? fR.map((req, idx) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 transition-colors bg-white">
                    <td className="p-4 text-center text-sm font-semibold text-slate-400">{idx + 1}</td>
                    <td className="p-4 text-sm font-bold text-indigo-900">{req.rollNo || '-'}</td>
                    <td className="p-4"><div className="text-sm font-bold text-slate-800">{req.studentName || 'Unknown'}</div></td>
                    <td className="p-4 text-sm text-slate-500 font-medium">{fallbackValue(req.class, 'General')}</td>
                    {isVolunteerEnabled && (
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          req.registrationType === 'VOLUNTEER' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                          {req.registrationType === 'VOLUNTEER' ? 'Volunteer' : 'Participant'}
                        </span>
                      </td>
                    )}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={isVolunteerEnabled ? 5 : 4} className="p-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <Users size={40} className="text-slate-300 mb-3" />
                        <p className="text-sm font-bold text-slate-700">No registrations found</p>
                        <p className="text-xs text-slate-500 mt-1">Adjust your search or filters to see results.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Meta & Actions */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 relative">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-indigo-200/80 font-bold mb-1">Registration Lifecycle</div>
            <h2 className="text-xl font-black">{event?.title || event?.eventName || 'Event'}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                meta.status === 'FINALIZED' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                meta.status === 'CLOSED' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                'bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  meta.status === 'FINALIZED' ? 'bg-rose-500' :
                  meta.status === 'CLOSED' ? 'bg-amber-500' : 'bg-emerald-500'
                } animate-pulse`} />
                {meta.status === 'FINALIZED' ? 'Finalized' : meta.status === 'CLOSED' ? 'Closed' : 'Open'}
              </span>
              {meta.extensionCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100/90 text-sky-900 border border-sky-200">
                  <CalendarClock size={11} />
                  Extended {meta.extensionCount}×
                </span>
              )}
              {meta.maxParticipants && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  meta.isFull
                    ? 'bg-orange-100 text-orange-900 border-orange-200'
                    : 'bg-slate-200/60 text-slate-900 border-white/20'
                }`}>
                  <Users size={11} />
                  {counts.APPROVED || 0} / {meta.maxParticipants} seats
                  {meta.isFull && <span className="ml-1 font-black">· FULL</span>}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 text-sm">
              <div className="rounded-xl bg-white/10 backdrop-blur px-4 py-3 border border-white/10">
                <div className="text-[10px] uppercase tracking-wider text-indigo-200 font-bold">Registration Opens</div>
                <div className="font-bold mt-1">
                  {meta.opensAt ? new Date(meta.opensAt).toLocaleString() : 'Immediately'}
                </div>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur px-4 py-3 border border-white/10">
                <div className="text-[10px] uppercase tracking-wider text-indigo-200 font-bold">Registration Deadline</div>
                <div className="font-bold mt-1">
                  {meta.currentDeadline ? new Date(meta.currentDeadline).toLocaleString() : 'Event start'}
                </div>
                <div className="text-[11px] text-indigo-200 mt-0.5">{formatDeadlineLabel(meta.currentDeadline)}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row flex-wrap gap-2 lg:min-w-[320px]">
            <button
              type="button"
              onClick={() => setExtensionOpen(true)}
              disabled={!canExtend || bulkBusy}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CalendarClock size={16} />
              Extend Deadline
            </button>
            <button
              type="button"
              onClick={() => fetchData()}
              disabled={loading || bulkBusy}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Loader2 size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={() => setFinalizeOpen(true)}
              disabled={isFinalized || !!bulkBusy || counts.TOTAL === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-bold shadow-lg hover:bg-slate-50 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileCheck size={16} />
              {isFinalized ? 'Finalized ✓' : 'Finalize & Notify'}
            </button>
          </div>
        </div>

        {meta.notificationSent && (
          <div className="mt-4 text-xs text-emerald-300 inline-flex items-center gap-1.5">
            <Check size={12} /> Emails sent {meta.notificationSentAt ? `on ${new Date(meta.notificationSentAt).toLocaleString()}` : ''}
          </div>
        )}
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI
          label="Total"
          value={counts.TOTAL || 0}
          icon={Users}
          tone="slate"
          onClick={() => setStatusFilter('ALL')}
          selected={statusFilter === 'ALL'}
        />
        <KPI
          label="Pending"
          value={counts.PENDING || 0}
          icon={Clock}
          tone="amber"
          hint="Requires review"
          onClick={() => setStatusFilter(INDIVIDUAL_REGISTRATION_STATUSES.PENDING)}
          selected={statusFilter === INDIVIDUAL_REGISTRATION_STATUSES.PENDING}
        />
        <KPI
          label="Approved"
          value={counts.APPROVED || 0}
          icon={CheckCircle2}
          tone="emerald"
          onClick={() => setStatusFilter(INDIVIDUAL_REGISTRATION_STATUSES.APPROVED)}
          selected={statusFilter === INDIVIDUAL_REGISTRATION_STATUSES.APPROVED}
        />
        <KPI
          label="Waitlist"
          value={counts.WAITLISTED || 0}
          icon={ClipboardList}
          tone="sky"
          onClick={() => setStatusFilter(INDIVIDUAL_REGISTRATION_STATUSES.WAITLISTED)}
          selected={statusFilter === INDIVIDUAL_REGISTRATION_STATUSES.WAITLISTED}
        />
        <KPI
          label="Rejected"
          value={counts.REJECTED || 0}
          icon={XCircle}
          tone="rose"
          onClick={() => setStatusFilter(INDIVIDUAL_REGISTRATION_STATUSES.REJECTED)}
          selected={statusFilter === INDIVIDUAL_REGISTRATION_STATUSES.REJECTED}
        />
      </div>

      {/* Bulk Action Bar */}
      {!isFinalized && (
        <div className={`transition-all rounded-2xl border ${
          totalSelected > 0
            ? 'bg-indigo-50 border-indigo-200 shadow-sm'
            : 'bg-white border-slate-200'
        } p-4 flex flex-col md:flex-row md:items-center justify-between gap-3`}>
          <div className="flex flex-col sm:flex-row items-start md:items-center gap-3 w-full md:w-auto flex-1 min-w-0">
            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, roll, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            <div className="text-xs text-slate-500 whitespace-nowrap">
              Showing <strong className="text-slate-700">{filteredItems.length}</strong> of <strong className="text-slate-700">{items.length}</strong>
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            {totalSelected > 0 && (
              <div className="text-sm font-semibold text-indigo-800 bg-white rounded-lg px-3 py-1.5 border border-indigo-200">
                {totalSelected} selected
              </div>
            )}
            <button
              type="button"
              disabled={totalSelected === 0 || !!bulkBusy || isFinalized}
              onClick={doBulkApprove}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow hover:bg-emerald-500 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkBusy === 'APPROVE' ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
              Approve
            </button>
            <button
              type="button"
              disabled={totalSelected === 0 || !!bulkBusy || isFinalized}
              onClick={confirmBulkReject}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold shadow hover:bg-rose-500 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkBusy === 'REJECT' ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {errorMsg && (
        <div className="rounded-xl p-4 bg-rose-50 border border-rose-200 text-sm text-rose-900 flex items-start gap-3">
          <AlertTriangle size={16} className="text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="text-rose-800">{errorMsg}</p>
          </div>
          <button type="button" onClick={() => setErrorMsg('')} className="ml-auto text-xs text-rose-700 hover:text-rose-900">Dismiss</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                <th className="p-4 w-10 text-center">
                  {!isFinalized && (
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      className="w-4 h-4 accent-indigo-600 rounded"
                      checked={filteredItems.length > 0 && filteredItems.every(r => selected.has(r.studentId || r.userId || r.id))}
                      onChange={toggleSelectAll}
                    />
                  )}
                </th>
                <th className="p-4 w-24">Roll No</th>
                <th className="p-4 min-w-[220px]">Student</th>
                <th className="p-4 w-28">Class</th>
                <th className="p-4 w-28">Status</th>
                <th className="p-4 w-36">Registered At</th>
                <th className="p-4 w-36 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500">
                    <Loader2 size={22} className="animate-spin mx-auto text-indigo-500 mb-2" />
                    <p className="text-sm font-semibold">Loading registrations…</p>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-14 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Users size={42} className="text-slate-300 mb-3" />
                      <p className="text-sm font-bold text-slate-700">No registrations match this view</p>
                      <p className="text-xs text-slate-500 mt-1">Try clearing the search or changing status filters.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.map((r, idx) => {
                const sid = r.studentId || r.userId || r.id;
                const st = normaliseStatus(r.status || r.registrationStatus);
                const isChecked = selected.has(sid);
                return (
                  <tr key={sid || idx} className={`hover:bg-slate-50/60 transition-colors bg-white ${isChecked ? 'bg-indigo-50/40' : ''}`}>
                    <td className="p-4 text-center">
                      {!isFinalized && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.userName || r.name || sid}`}
                          className="w-4 h-4 accent-indigo-600 rounded"
                          checked={isChecked}
                          onChange={() => toggleSelect(sid)}
                        />
                      )}
                    </td>
                    <td className="p-4 text-sm font-bold text-indigo-900 font-mono">{r.rollNo || r.studentRoll || '-'}</td>
                    <td className="p-4">
                      <div className="text-sm font-bold text-slate-800 truncate max-w-sm">{r.userName || r.name || 'Unknown'}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-sm">{r.userEmail || r.email || ''}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-500 font-medium">{fallbackValue(r.userClass || r.class, 'General')}</td>
                    <td className="p-4"><StatusChip value={st} /></td>
                    <td className="p-4 text-xs text-slate-500">
                      {r.registeredAt ? new Date(r.registeredAt).toLocaleString() : '-'}
                      {r.reviewedByName && (
                        <div className="text-[10px] text-slate-400 mt-1">Reviewed by {r.reviewedByName}</div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {!isFinalized && (
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            title="Approve"
                            disabled={st === INDIVIDUAL_REGISTRATION_STATUSES.APPROVED}
                            onClick={() => setSingleStatus(sid, INDIVIDUAL_REGISTRATION_STATUSES.APPROVED)}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-700 disabled:opacity-30 transition-colors"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                          <button
                            type="button"
                            title="Waitlist"
                            disabled={st === INDIVIDUAL_REGISTRATION_STATUSES.WAITLISTED}
                            onClick={() => setSingleStatus(sid, INDIVIDUAL_REGISTRATION_STATUSES.WAITLISTED)}
                            className="p-1.5 rounded-lg hover:bg-sky-50 text-sky-700 disabled:opacity-30 transition-colors"
                          >
                            <ClipboardList size={16} />
                          </button>
                          <button
                            type="button"
                            title="Reject"
                            disabled={st === INDIVIDUAL_REGISTRATION_STATUSES.REJECTED}
                            onClick={() => setRejectOpen(sid)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-700 disabled:opacity-30 transition-colors"
                          >
                            <XCircle size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extend Deadline modal */}
      <DeadlineExtensionModal
        open={extensionOpen}
        onClose={() => setExtensionOpen(false)}
        event={event}
        currentUser={currentUser}
        onSuccess={() => {
          fetchData();
          if (onRefreshEvent) onRefreshEvent();
        }}
      />

      {/* Finalize confirm — with checklist + pending gating */}
      <ConfirmationModal
        open={finalizeOpen}
        onClose={() => {
          setFinalizeOpen(false);
          setFinalizeMode('REVIEW');
          setFinalizeCheckedAck(false);
          setFinalizePendingReason('Not selected after registration review');
        }}
        title="Finalize Registration & Notify Students"
        onConfirm={doFinalize}
        confirmLabel={bulkBusy === 'FINALIZE' ? 'Finalizing…' : 'Finalize & Send Emails'}
        confirmTone="emerald"
        size="lg"
        disabled={
          !!bulkBusy ||
          (
            (counts?.PENDING || 0) > 0 &&
            finalizeMode !== 'AUTO_REJECT' &&
            !(finalizeMode === 'ACKNOWLEDGE' && finalizeCheckedAck)
          )
        }
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p>
            Finalizing will <strong className="text-slate-900">lock the participant list</strong> and immediately queue a batch of
            personalized notification emails (approved, rejected, waitlisted) to every student.
          </p>

          {/* Checklist summary */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Registration Summary</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-xs text-emerald-700 font-bold uppercase tracking-wider">Approved</div>
                <div className="text-2xl font-black text-emerald-800 mt-1">{counts.APPROVED || 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
                <div className="text-xs text-sky-700 font-bold uppercase tracking-wider">Waitlisted</div>
                <div className="text-2xl font-black text-sky-800 mt-1">{counts.WAITLISTED || 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                <div className="text-xs text-rose-700 font-bold uppercase tracking-wider">Rejected</div>
                <div className="text-2xl font-black text-rose-800 mt-1">{counts.REJECTED || 0}</div>
              </div>
              <div className={`p-3 rounded-xl border ${(counts?.PENDING || 0) > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-100 border-slate-200'}`}>
                <div className={`text-xs font-bold uppercase tracking-wider ${(counts?.PENDING || 0) > 0 ? 'text-amber-700' : 'text-slate-500'}`}>Pending</div>
                <div className={`text-2xl font-black mt-1 ${(counts?.PENDING || 0) > 0 ? 'text-amber-800' : 'text-slate-600'}`}>{counts.PENDING || 0}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 flex items-center justify-between">
                <span className="text-slate-500 font-semibold uppercase tracking-wider">Event Capacity</span>
                <span className="font-bold text-slate-900">{meta.maxParticipants ? `${meta.maxParticipants} seats` : 'Unlimited'}</span>
              </div>
              <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 flex items-center justify-between">
                <span className="text-slate-500 font-semibold uppercase tracking-wider">Emails to Send</span>
                <span className="font-bold text-slate-900">
                  {((counts.APPROVED || 0) + (counts.REJECTED || 0) + (counts.WAITLISTED || 0) + (finalizeMode === 'AUTO_REJECT' ? (counts.PENDING || 0) : 0))}
                  {' '}students
                </span>
              </div>
            </div>
          </div>

          {/* Pending workflow choices */}
          {(counts?.PENDING || 0) > 0 && (
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50/70 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-bold text-amber-900">
                    ⚠ {counts.PENDING} registration{counts.PENDING === 1 ? '' : 's'} remain pending.
                  </div>
                  <div className="text-xs text-amber-800 mt-1">
                    Unresolved pending registrations will <strong>not</strong> receive any notification email unless you auto-reject them below.
                    Choose how to proceed before you can finalize.
                  </div>
                </div>
              </div>

              <label className={`block rounded-lg border p-3 cursor-pointer transition-colors ${finalizeMode === 'AUTO_REJECT' ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-300' : 'bg-white border-slate-200 hover:bg-rose-50/50'}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    checked={finalizeMode === 'AUTO_REJECT'}
                    onChange={() => setFinalizeMode('AUTO_REJECT')}
                    className="mt-1 accent-rose-600"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="font-semibold text-slate-900 text-sm">Auto Reject Remaining Pending (Recommended)</div>
                    <div className="text-xs text-slate-600">
                      All {counts.PENDING} pending application{counts.PENDING === 1 ? '' : 's'} will be marked as REJECTED with the reason below,
                      and included in the rejected group notification email.
                    </div>
                    <textarea
                      rows={2}
                      disabled={finalizeMode !== 'AUTO_REJECT'}
                      value={finalizePendingReason}
                      onChange={(e) => setFinalizePendingReason(e.target.value)}
                      placeholder="Reason for rejection (sent to each student)"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-400/30 focus:border-rose-400 resize-none text-xs bg-white disabled:bg-slate-50 disabled:text-slate-400"
                      maxLength={400}
                    />
                    <div className="text-right text-[11px] text-slate-400">{finalizePendingReason.length} / 400</div>
                  </div>
                </div>
              </label>

              <label className={`block rounded-lg border p-3 cursor-pointer transition-colors ${finalizeMode === 'ACKNOWLEDGE' ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-300' : 'bg-white border-slate-200 hover:bg-amber-50/50'}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    checked={finalizeMode === 'ACKNOWLEDGE'}
                    onChange={() => { setFinalizeMode('ACKNOWLEDGE'); setFinalizeCheckedAck(false); }}
                    className="mt-1 accent-amber-600"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="font-semibold text-slate-900 text-sm">Return and Review Remaining Applications</div>
                    <div className="text-xs text-slate-600">
                      Keep the {counts.PENDING} pending registration{counts.PENDING === 1 ? '' : 's'} as-is (UNRESOLVED). No email will be sent to these students.
                      You must confirm this explicitly in the checkbox below.
                    </div>
                    {finalizeMode === 'ACKNOWLEDGE' && (
                      <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={finalizeCheckedAck}
                          onChange={(e) => setFinalizeCheckedAck(e.target.checked)}
                          className="mt-0.5 accent-amber-600"
                        />
                        <span className="text-xs text-slate-700">
                          I understand that {counts.PENDING} pending registration{counts.PENDING === 1 ? '' : 's'} will remain unresolved,
                          will <strong>not</strong> be notified, and that I cannot re-open this list once finalized.
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              </label>
            </div>
          )}

          {(counts?.PENDING || 0) === 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-emerald-800">
                All registrations are resolved. Click <strong>Finalize &amp; Send Emails</strong> to lock the list and dispatch batch notifications.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              This action <strong>cannot be undone</strong>. Emails will be sent via the notification queue in the background.
              Ensure you have reviewed every application before proceeding.
            </p>
          </div>
        </div>
      </ConfirmationModal>

      {/* Reject (single or bulk) reason dialog */}
      <ConfirmationModal
        open={!!rejectOpen}
        onClose={() => { setRejectOpen(null); setRejectReason(''); }}
        title={rejectOpen === '__BULK__' ? `Reject ${totalSelected} Selected Registration(s)` : 'Reject Registration'}
        onConfirm={() => doReject(rejectReason.trim())}
        confirmLabel={bulkBusy === 'REJECT' ? 'Rejecting…' : 'Confirm Reject'}
        confirmTone="rose"
        disabled={!!bulkBusy}
        size="md"
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>Optionally provide a reason (sent to each student in the rejection email and saved to the audit log).</p>
          <textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Event at full capacity · Clash with department schedule · Did not meet prerequisites"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-400/30 focus:border-rose-400 resize-none text-sm"
            maxLength={400}
          />
          <div className="text-right text-[11px] text-slate-400">{rejectReason.length} / 400</div>
        </div>
      </ConfirmationModal>
    </div>
  );
};

export default RegistrationsTab;
