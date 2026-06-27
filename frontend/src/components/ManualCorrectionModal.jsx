import React, { useState, useEffect } from 'react';
import { X, Loader2, UserCheck, AlertCircle, Search, CheckCircle2, XCircle } from 'lucide-react';

const REASON_PRESETS = [
  'QR Scanner Failure',
  'Student Verified Manually',
  'Technical Issue',
  'Late Entry Approved',
  'Network Issue During Scan',
  'Other',
];

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
};

const ManualCorrectionModal = ({ event, odRequests = [], targetDate, onClose, onCorrect }) => {
  const allConfigs = event.attendanceConfigs || {};

  // ── Step 1: Fixed Target Date ─────────────────────────────────────────────
  const selectedDate = targetDate;
  const config = allConfigs[selectedDate] || {};
  const attendanceType = config.attendanceType || 'Single Session';

  // ── Step 2: Student selection ─────────────────────────────────────────────
  const approvedStudents = odRequests.filter(r => r.eventId === event.id && r.status === 'APPROVED');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  const filteredStudents = searchQuery.trim() === '' ? [] : approvedStudents.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      (s.studentName || '').toLowerCase().includes(q) ||
      (s.rollNo || '').toLowerCase().includes(q)
    );
  });

  // ── Step 3: Attendance values ─────────────────────────────────────────────
  const [s1Present, setS1Present] = useState(false);
  const [s2Present, setS2Present] = useState(false);

  // When student changes, load current attendance from their record
  useEffect(() => {
    if (!selectedStudent) return;
    const att = selectedStudent.attendance?.[selectedDate] || {};
    setS1Present(!!(att.S1 || att.FN));
    setS2Present(!!(att.S2 || att.AN));
  }, [selectedStudent, selectedDate]);

  // ── Step 4: Reason ────────────────────────────────────────────────────────
  const [reasonPreset, setReasonPreset] = useState('');
  const [reasonCustom, setReasonCustom] = useState('');
  const reason = reasonPreset === 'Other' ? reasonCustom : reasonPreset;

  // ── Submit ────────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Compute new status from session flags
  const computeStatus = () => {
    if (attendanceType === 'Single Session') return s1Present ? 'P' : 'A';
    if (s1Present && s2Present) return 'P';
    if (s1Present) return 'FN';
    if (s2Present) return 'AN';
    return 'A';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedStudent) { setError('Please select a student.'); return; }
    if (!reason.trim()) { setError('Reason is mandatory for audit logging.'); return; }

    setIsSubmitting(true);
    try {
      const newStatus = computeStatus();
      const res = await fetch(`http://localhost:5001/api/events/${event.id}/attendance/correct`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
        body: JSON.stringify({
          rollNo: selectedStudent.rollNo,
          studentName: selectedStudent.studentName,
          registrationId: selectedStudent.id,
          date: selectedDate,
          session: attendanceType === 'Single Session' ? 'S1' : 'BOTH',
          s1Present,
          s2Present,
          newStatus,
          reason: reason.trim(),
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      onCorrect(data);
      onClose();
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  const currentStatus = computeStatus();
  const statusLabel = { P: 'Present', FN: 'Forenoon Only', AN: 'Afternoon Only', A: 'Absent' };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
              <UserCheck size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Manual Attendance Correction</h2>
              <p className="text-xs text-slate-500">Changes are logged permanently for audit</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              <AlertCircle size={16} className="shrink-0" /><span>{error}</span>
            </div>
          )}

          {/* ── Fixed Date Display ── */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center">
             <div>
                <p className="text-xs font-bold text-slate-500 mb-0.5">Target Event Date</p>
                <p className="text-sm font-bold text-slate-900">{formatDisplayDate(selectedDate)}</p>
             </div>
             {config.attendanceType && (
               <div className="text-right">
                 <p className="text-xs font-bold text-slate-500 mb-0.5">Type</p>
                 <p className="text-sm font-bold text-slate-900">{config.attendanceType}</p>
               </div>
             )}
          </div>

          {/* ── Student Search ── */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Student *</label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name or roll number..."
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
            {searchQuery.trim().length > 0 && (
              <div className="border border-slate-200 rounded-xl max-h-40 overflow-y-auto divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-slate-400 text-center">No matching students found.</p>
                ) : filteredStudents.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSelectedStudent(s); setSearchQuery(''); }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-indigo-50 ${selectedStudent?.id === s.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
                  >
                    <span className="font-semibold">{s.studentName}</span>
                    <span className="text-xs font-mono text-slate-500">{s.rollNo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Attendance Status Editor ── */}
          {selectedStudent && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-sm">{selectedStudent.studentName}</p>
                  <p className="text-xs font-mono text-slate-500">{selectedStudent.rollNo}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                  currentStatus === 'A' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {statusLabel[currentStatus] || currentStatus}
                </div>
              </div>

              {/* Single Session */}
              {attendanceType === 'Single Session' && (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-2">Session 1 Status</p>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setS1Present(true)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border transition-colors ${s1Present ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'}`}>
                      <CheckCircle2 size={16} /> Present
                    </button>
                    <button type="button" onClick={() => setS1Present(false)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border transition-colors ${!s1Present ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-600 border-slate-300 hover:border-red-400'}`}>
                      <XCircle size={16} /> Absent
                    </button>
                  </div>
                </div>
              )}

              {/* Both Sessions */}
              {attendanceType === 'Both Sessions' && (
                <div className="space-y-3">
                  {[{ label: 'Session 1 (Forenoon)', val: s1Present, set: setS1Present },
                    { label: 'Session 2 (Afternoon)', val: s2Present, set: setS2Present }
                  ].map(({ label, val, set }) => (
                    <div key={label}>
                      <p className="text-xs font-bold text-slate-500 mb-1.5">{label}</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => set(true)}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors ${val ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'}`}>
                          <CheckCircle2 size={14} /> Present
                        </button>
                        <button type="button" onClick={() => set(false)}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors ${!val ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-600 border-slate-300 hover:border-red-400'}`}>
                          <XCircle size={14} /> Absent
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Reason ── */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Reason for Correction *</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {REASON_PRESETS.map(r => (
                <button key={r} type="button" onClick={() => setReasonPreset(r)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${reasonPreset === r ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}>
                  {r}
                </button>
              ))}
            </div>
            {reasonPreset === 'Other' && (
              <textarea
                value={reasonCustom}
                onChange={e => setReasonCustom(e.target.value)}
                placeholder="Describe the reason for this correction..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none text-sm"
              />
            )}
          </div>

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={isSubmitting}
              className="flex-1 py-2.5 text-sm font-semibold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || !selectedStudent || !reason.trim()}
              className="flex-1 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              Save Correction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualCorrectionModal;
