import React, { useState, useEffect } from 'react';
import { Loader2, QrCode, CheckCircle2, XCircle, Users, Clock, Calendar, CalendarX } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useNotification } from '../context/NotificationContext';
import ManualCorrectionModal from './ManualCorrectionModal';
import QRScanner from './QRScanner';
import AttendanceTable from './AttendanceTable';
import * as XLSX from 'xlsx';

// ── Helpers ──────────────────────────────────────────────────────────────────
const generateDateRange = (startDateStr, endDateStr) => {
  if (!startDateStr) return [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr || startDateStr);
  const dates = [];
  let current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

// ── Component ─────────────────────────────────────────────────────────────────
const AttendanceTab = ({ event }) => {
  const { currentUser, odRequests = [] } = useAppContext();
  const { showDialog, showToast } = useNotification();
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult]     = useState(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [sessionStartDialog, setSessionStartDialog] = useState(null);
  // ── Live clock — updates every second ───────────────────────────────────
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const startDateStr = event?.requisition?.step1?.eventStartDate || event?.date;
  const endDateStr   = event?.requisition?.step1?.eventEndDate   || startDateStr;
  const eventDates = generateDateRange(startDateStr, endDateStr);
  
  const defaultDate = eventDates.includes(new Date().toISOString().split('T')[0]) 
    ? new Date().toISOString().split('T')[0] 
    : eventDates[0];
    
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [attendanceTypeSelection, setAttendanceTypeSelection] = useState('Single Session');
  const [beforeStartModal, setBeforeStartModal] = useState(false);
  
  // Real-time local state for the UI, synced from event props
  const [localConfigs, setLocalConfigs] = useState(event.attendanceConfigs || {});

  useEffect(() => {
    setLocalConfigs(event.attendanceConfigs || {});
  }, [event.attendanceConfigs]);

  const isOrganizer = (currentUser?.role === 'STUDENT_ORGANIZER' || currentUser?.role === 'FACULTY') && event.organizerId === currentUser?.id;
  const currentConfig = localConfigs[selectedDate];
  
  const displayDateStr = new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
  const finalizeBtnText = eventDates.length > 1 ? `Finalize ${displayDateStr}` : 'Finalize Attendance';
  const finalizedBtnText = eventDates.length > 1 ? `${displayDateStr} Finalized` : 'Attendance Finalized';
  
  // ── Compute Live Stats Dynamically ────────────────────────────────────────
  const eventApprovedRequests = odRequests.filter(req => req.eventId === event.id && req.status === 'APPROVED');
  const totalApproved = eventApprovedRequests.length;
  
  let studentsCheckedIn = 0;
  let fullyAttended = 0;
  
  let currentS1Present = 0;
  let currentS2Present = 0;
  
  eventApprovedRequests.forEach(req => {
      let hasAnyAttendance = false;
      let isFullyAttended = true;

      eventDates.forEach(date => {
          const c = localConfigs[date];
          if (!c) {
              isFullyAttended = false;
              return;
          }
          
          const att = (req.attendance && req.attendance[date]) || {};
          
          if (date === selectedDate) {
              if (att.S1) currentS1Present++;
              if (att.S2) currentS2Present++;
          }
          
          if (att.S1 || att.S2) hasAnyAttendance = true;
          
          if (c.attendanceType === 'Both Sessions') {
              if (!att.S1 || !att.S2) isFullyAttended = false;
          } else {
              if (!att.S1) isFullyAttended = false;
          }
      });
      
      if (hasAnyAttendance) studentsCheckedIn++;
      if (isFullyAttended) fullyAttended++;
  });

  const attendanceProgressPercent = totalApproved > 0 ? Math.round((fullyAttended / totalApproved) * 100) : 0;
  const currentSessionStatus = currentConfig ? (
     currentConfig.session1Status === 'Running' ? 'Session 1 Running' : 
     currentConfig.session2Status === 'Running' ? 'Session 2 Running' : 
     (currentConfig.attendanceFinalized ? 'Closed (Finalized)' : 'Closed')
  ) : 'Not Configured';

  const startTimeStr = event?.time || event?.requisition?.step1?.eventStartTime || '09:00';
  const isFirstDay = selectedDate === eventDates[0];
  const startDateTime = new Date(selectedDate);
  if (isFirstDay && startTimeStr) {
    // Only the first day of the event is gated by the actual start time
    const [hours, minutes] = startTimeStr.split(':').map(Number);
    startDateTime.setHours(hours, minutes, 0, 0);
  } else {
    // For Day 2, Day 3 etc. — scanning opens from the start of the day (midnight)
    // because participants arrive for a new session, not at the original event start time
    startDateTime.setHours(0, 0, 0, 0);
  }
  // Derived from live `now` state — re-evaluates every second automatically
  const isEventDateStarted = now.getTime() >= startDateTime.getTime();

  useEffect(() => {
    if (currentConfig) setAttendanceTypeSelection(currentConfig.attendanceType);
  }, [currentConfig]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSaveConfig = async () => {
    if (!isOrganizer) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`http://localhost:5001/api/events/${event.id}/attendance-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
        body: JSON.stringify({ date: selectedDate, attendanceType: attendanceTypeSelection })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setLocalConfigs(data.attendanceConfigs);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSessionAction = async (sessionKey, action) => {
    if (!isOrganizer) return;

    if (action === 'START' && !isEventDateStarted) {
      setBeforeStartModal(true);
      return;
    }

    if (action === 'END') {
      const confirmed = await showDialog({
        title: 'End Session',
        message: `Are you sure you want to manually end ${sessionKey === 'S1' ? 'Session 1' : 'Session 2'}?`,
        type: 'warning'
      });
      if (!confirmed) return;
    }
    
    setIsProcessing(true);
    try {
      const res = await fetch(`http://localhost:5001/api/events/${event.id}/attendance-session`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
        body: JSON.stringify({ date: selectedDate, sessionKey, action })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setLocalConfigs(data.attendanceConfigs);
      if (action === 'START') {
        setIsScannerOpen(true);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalize = async () => {
    if (!isOrganizer) return;
    const confirmed = await showDialog({
      title: finalizeBtnText,
      message: `Are you sure you want to finalize attendance for ${displayDateStr}? After finalization, attendance for this date cannot be modified.`,
      type: 'warning',
      confirmText: 'Finalize'
    });
    if (!confirmed) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`http://localhost:5001/api/events/${event.id}/finalize-attendance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
        body: JSON.stringify({ date: selectedDate })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      
      setLocalConfigs(data.attendanceConfigs);
      
      let nextDateAvailableMsg = '';
      const currentIndex = eventDates.indexOf(selectedDate);
      if (currentIndex !== -1 && currentIndex + 1 < eventDates.length) {
         const nextDateStr = new Date(eventDates[currentIndex + 1]).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
         nextDateAvailableMsg = `\n\n${nextDateStr} is available for attendance configuration.`;
      }
      
      await showDialog({ 
         title: 'Success', 
         message: `✓ Attendance for ${displayDateStr} has been finalized successfully.\n\n${displayDateStr} is now read-only.${nextDateAvailableMsg}`, 
         type: 'success', 
         hideCancel: true 
      });
    } catch (err) {
      await showDialog({ title: 'Finalization Error', message: err.message, type: 'danger', hideCancel: true });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScan = async (decodedText) => {
    if (!decodedText || isProcessing || currentConfig?.attendanceFinalized) return;
    setIsProcessing(true);
    setScanResult(null);
    console.log('[Scanner] Decoded Payload:', decodedText);
    
    try {
      let qrData = {};
      try { qrData = JSON.parse(decodedText); } catch {
        console.error('[Scanner] Validation Failed: Invalid JSON format');
        setScanResult({ success: false, message: 'Invalid QR Code\nThe scanned QR is not recognized.' });
        setIsProcessing(false);
        return;
      }
      
      const { rollNo, eventId, registrationId, studentName } = qrData;
      
      if (!eventId || !registrationId || !rollNo || !studentName) {
        console.error('[Scanner] Validation Failed: Missing required fields in payload');
        setScanResult({ success: false, message: 'Invalid QR Code\nThe scanned QR is missing required participant data.' });
        setIsProcessing(false);
        return;
      }
      
      if (eventId !== event.id) {
        console.error('[Scanner] Validation Failed: Event ID mismatch');
        setScanResult({ success: false, message: 'Wrong Event QR\nThis QR belongs to another event.' });
        setIsProcessing(false);
        return;
      }
      
      console.log('[Scanner] Backend Validation Started for', rollNo);
      const res = await fetch(`http://localhost:5001/api/events/${event.id}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
        body: JSON.stringify({ rollNo, studentName, eventId, registrationId, date: selectedDate })
      });
      
      const data = await res.json();
      if (!data.success) {
        if (data.duplicate) {
          console.warn('[Scanner] Duplicate Scan detected');
          setScanResult({ success: false, message: `Attendance Already Recorded\nThis student has already been marked for this session.\n\n${data.studentName} (${data.rollNo})\n${data.sessionLabel}` });
        } else {
          console.error('[Scanner] Validation Failed:', data.silentMessage);
          setScanResult({ success: false, message: data.silentMessage || 'Student is not an approved participant.' });
          if (data.silentMessage?.includes('is not active')) {
              window.location.reload();
          }
        }
      } else {
        console.log('[Scanner] Attendance Recorded Successfully');
        // Play success sound
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
        } catch (e) { /* ignore */ }
        
        setScanResult({ success: true, message: `Attendance Recorded\n${data.studentName} (${data.rollNo})\n${data.sessionLabel}\n${new Date(selectedDate).toLocaleDateString()} • ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` });
        
        // Stats will auto-update via Firebase real-time listener on odRequests
      }
    } catch (err) {
      console.error('[Scanner] System Error:', err);
      setScanResult({ success: false, message: 'System Error processing attendance.' });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setScanResult(null), 5000);
    }
  };

  const handleExport = async (format = 'excel') => {
    setIsProcessing(true);
    try {
      const res  = await fetch(`http://localhost:5001/api/iqac/${event.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to fetch attendance data.');
      const rows = data.attendanceStats?.rows || [];

      const exportData = rows.map((r, idx) => {
          const row = { 'S.No': idx + 1, 'Roll No': r.rollNo, 'Student Name': r.student };
          
          let allFinalized = true;
          let hasAnyAttendance = false;
          let missedAnyRequired = false;
          
          eventDates.forEach(d => {
             const formattedDate = new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
             const c = localConfigs[d];
             const isFinalized = c && c.attendanceFinalized;
             if (!isFinalized) allFinalized = false;
             
             const sessions = r.attendance?.[d] || {};
             const type = c ? c.attendanceType : 'Single Session';
             const s1 = sessions.S1 || sessions.FN || false;
             const s2 = sessions.S2 || sessions.AN || false;
             
             if (s1 || s2) hasAnyAttendance = true;
             
             if (type === 'Both Sessions') {
                 if (!s1 || !s2) missedAnyRequired = true;
             } else {
                 if (!s1) missedAnyRequired = true;
             }
             
             if (!c || c.session1Status === 'NotStarted') {
                 row[formattedDate] = 'Pending';
             } else if (type === 'Single Session') {
                 row[formattedDate] = s1 ? 'P' : 'A';
             } else {
                 if (s1 && s2) row[formattedDate] = 'P';
                 else if (s1) row[formattedDate] = 'FN';
                 else if (s2) row[formattedDate] = 'AN';
                 else row[formattedDate] = 'A';
             }
          });
          
          let overallStatus = 'Pending';
          if (allFinalized) {
              if (!hasAnyAttendance) overallStatus = 'Absent';
              else if (missedAnyRequired) overallStatus = 'Partially Attended';
              else overallStatus = 'Fully Attended';
          }
          row['Overall Status'] = overallStatus;
          return row;
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-fit columns
      const wscols = [
          {wch: 8}, // S.No
          {wch: 15}, // Roll No
          {wch: 30}, // Student Name
      ];
      eventDates.forEach(() => wscols.push({wch: 15})); // Date columns
      wscols.push({wch: 25}); // Overall Status
      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      
      const safeEventName = (event.title || event.requisition?.step1?.eventName || 'Event')
          .replace(/[<>:"/\\|?*]/g, '-')
          .trim()
          .replace(/\s+/g, '_');
          
      const safeDate = new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
      const fileNameBase = `${safeEventName}_${safeDate}`;
      
      if (format === 'csv') {
          XLSX.writeFile(wb, `${fileNameBase}.csv`);
      } else {
          XLSX.writeFile(wb, `${fileNameBase}.xlsx`);
      }
    } catch (err) {
      await showDialog({ title: 'Export Failed', message: err.message, type: 'danger', hideCancel: true });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Auto-timeout sessions after 3 hours (driven by live `now` clock) ──────
  useEffect(() => {
    if (!currentConfig) return;
    const nowMs = now.getTime();
    let changed = false;
    const updatedConfig = { ...currentConfig };
    if (updatedConfig.session1Status === 'Running' && updatedConfig.session1StartTime) {
      if (nowMs - new Date(updatedConfig.session1StartTime).getTime() > 3 * 60 * 60 * 1000) {
        updatedConfig.session1Status = 'Closed';
        if (updatedConfig.attendanceType === 'Both Sessions') updatedConfig.session2Status = 'NotStarted';
        changed = true;
      }
    }
    if (updatedConfig.session2Status === 'Running' && updatedConfig.session2StartTime) {
      if (nowMs - new Date(updatedConfig.session2StartTime).getTime() > 3 * 60 * 60 * 1000) {
        updatedConfig.session2Status = 'Closed';
        changed = true;
      }
    }
    if (changed) setLocalConfigs(prev => ({ ...prev, [selectedDate]: updatedConfig }));
  }, [now, currentConfig, selectedDate]);


  // ── Renders ────────────────────────────────────────────────────────────────
  if (!eventDates || eventDates.length === 0) {
    return <div className="p-8 text-center text-slate-500">Event dates missing.</div>;
  }
  
  const activeSessionKey = currentConfig?.session1Status === 'Running' ? 'S1' : currentConfig?.session2Status === 'Running' ? 'S2' : null;

  if (event.status === 'CANCELLED') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-red-50 rounded-xl border border-red-200">
        <CalendarX size={48} className="text-red-400 mb-4" />
        <h3 className="text-xl font-bold text-red-800">Event Cancelled</h3>
        <p className="text-red-600 mt-2 max-w-md">Attendance tracking is disabled because this event has been officially cancelled.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      {eventDates.length > 1 && (
        <div className="flex gap-2 p-4 bg-slate-50 rounded-lg border border-slate-200 overflow-x-auto">
          {eventDates.map(date => (
            <button key={date} onClick={() => setSelectedDate(date)}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${selectedDate === date ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}>
              <Calendar size={16} />
              {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </button>
          ))}
        </div>
      )}

      {/* Configuration Panel — shown before Session 1 is started */}
      {(() => {
        const configLocked = currentConfig && currentConfig.session1Status !== 'NotStarted';
        const showConfigPanel = !configLocked;

        return showConfigPanel ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center max-w-lg mx-auto">
          <h3 className="text-xl font-bold text-slate-800 mb-2">Attendance Configuration</h3>
          <p className="text-sm text-slate-500 mb-6">Select the attendance format for {new Date(selectedDate).toLocaleDateString()}. {currentConfig ? 'You can modify this until Session 1 starts.' : 'This is required before starting the session.'}</p>
          
          <div className="space-y-4 mb-8">
            <label className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${attendanceTypeSelection === 'Single Session' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="radio" name="attendanceType" value="Single Session"
                checked={attendanceTypeSelection === 'Single Session'}
                onChange={(e) => setAttendanceTypeSelection(e.target.value)}
                className="w-4 h-4 text-indigo-600" />
              <div className="text-left">
                <p className="font-bold text-slate-800">Single Session</p>
                <p className="text-xs text-slate-500">One continuous attendance session (max 3 hours).</p>
              </div>
            </label>
            <label className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${attendanceTypeSelection === 'Both Sessions' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="radio" name="attendanceType" value="Both Sessions"
                checked={attendanceTypeSelection === 'Both Sessions'}
                onChange={(e) => setAttendanceTypeSelection(e.target.value)}
                className="w-4 h-4 text-indigo-600" />
              <div className="text-left">
                <p className="font-bold text-slate-800">Both Sessions</p>
                <p className="text-xs text-slate-500">Two separate attendance sessions (e.g., Forenoon &amp; Afternoon).</p>
              </div>
            </label>
          </div>

          {isOrganizer ? (
            <button onClick={handleSaveConfig} disabled={isProcessing || (currentConfig && currentConfig.attendanceType === attendanceTypeSelection)}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-60 mb-6">
              {isProcessing && <Loader2 size={16} className="animate-spin inline mr-2" />}
              {currentConfig && currentConfig.attendanceType === attendanceTypeSelection ? '✓ Configuration Saved' : 'Save & Continue'}
            </button>
          ) : (
            <p className="text-sm text-slate-400 mb-6">Waiting for organizer to configure attendance.</p>
          )}

          <div className={`mt-6 p-5 rounded-xl border ${!isEventDateStarted ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'} text-left`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`font-bold ${!isEventDateStarted ? 'text-amber-900' : 'text-emerald-900'}`}>Event Readiness</h4>
              <div className={`px-3 py-1 text-xs font-bold rounded-full ${!isEventDateStarted ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                Status: {!isEventDateStarted ? 'Upcoming' : 'Ready'}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className={`text-xs font-semibold ${!isEventDateStarted ? 'text-amber-700/70' : 'text-emerald-700/70'}`}>Event Start</p>
                <p className={`text-sm font-bold ${!isEventDateStarted ? 'text-amber-900' : 'text-emerald-900'}`}>
                  {startDateTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')} &bull; {startDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </div>
              <div>
                <p className={`text-xs font-semibold ${!isEventDateStarted ? 'text-amber-700/70' : 'text-emerald-700/70'}`}>Current Time</p>
                <p className={`text-sm font-bold ${!isEventDateStarted ? 'text-amber-900' : 'text-emerald-900'}`}>
                  {now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')} &bull; {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </div>
            </div>

            {!isEventDateStarted ? (
              <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                <Clock size={16} /> Attendance scanning will be available when the event starts.
              </p>
            ) : (
              <div className="space-y-4 border-t border-emerald-200/60 pt-4">
                <p className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={16} /> Event has started. You can now begin the attendance session.
                </p>
                {currentConfig && isOrganizer && currentConfig.session1Status === 'NotStarted' && (
                   <button onClick={() => setSessionStartDialog({ sessionKey: 'S1' })} disabled={isProcessing} className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                     Start Session 1
                   </button>
                )}
                {!currentConfig && isOrganizer && (
                   <p className="text-xs font-bold text-emerald-700/70 italic">Please save the configuration above to unlock the session controls.</p>
                )}
              </div>
            )}
          </div>
        </div>
        ) : null;
      })()}
      {/* Attendance Active Dashboard — shown once Session 1 is started */}
      {currentConfig && currentConfig.session1Status !== 'NotStarted' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            {/* Config Locked Banner */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-100 border border-slate-300 text-slate-600 text-sm font-semibold">
              <span className="text-slate-400">🔒</span>
              <span>Attendance Configuration Locked — cannot be modified after Session 1 has started.</span>
            </div>

            {/* Controls */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Attendance Type: {currentConfig.attendanceType}</h3>
                  <p className="text-sm text-slate-500">Manage sessions for this day.</p>
                </div>
              </div>
              
              <div className="space-y-4">
                {/* Session 1 */}
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50">
                  <div>
                    <h4 className="font-bold text-slate-800">Session 1</h4>
                    <p className="text-xs font-semibold mt-1">Status: <span className={currentConfig.session1Status === 'Running' ? 'text-emerald-600' : 'text-slate-500'}>{currentConfig.session1Status}</span></p>
                  </div>
                  {isOrganizer && currentConfig.session1Status === 'NotStarted' && !currentConfig.attendanceFinalized && (
                     <button onClick={() => setSessionStartDialog({ sessionKey: 'S1' })} disabled={isProcessing} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Start Session 1</button>
                  )}
                  {isOrganizer && currentConfig.session1Status === 'Running' && (
                     <button onClick={() => handleSessionAction('S1', 'END')} disabled={isProcessing} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700">End Session 1</button>
                  )}
                </div>

                {/* Session 2 */}
                {currentConfig.attendanceType === 'Both Sessions' && (() => {
                  const resolvedS2Status = (currentConfig.session1Status === 'Closed' && currentConfig.session2Status === 'Disabled')
                    ? 'NotStarted'
                    : currentConfig.session2Status;
                  return (
                    <div className={`flex items-center justify-between p-4 border border-slate-200 rounded-xl ${resolvedS2Status === 'Disabled' ? 'bg-slate-100 opacity-60' : 'bg-slate-50'}`}>
                      <div>
                        <h4 className="font-bold text-slate-800">Session 2</h4>
                        <p className="text-xs font-semibold mt-1">Status: <span className={resolvedS2Status === 'Running' ? 'text-emerald-600' : 'text-slate-500'}>{resolvedS2Status}</span></p>
                      </div>
                      {isOrganizer && resolvedS2Status === 'NotStarted' && !currentConfig.attendanceFinalized && (
                         <button onClick={() => setSessionStartDialog({ sessionKey: 'S2' })} disabled={isProcessing} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Start Session 2</button>
                      )}
                      {isOrganizer && resolvedS2Status === 'Running' && (
                         <button onClick={() => handleSessionAction('S2', 'END')} disabled={isProcessing} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700">End Session 2</button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            
            {/* Scanner */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <QrCode size={20} className="text-slate-700" />
                  <h4 className="font-bold text-slate-800">
                    {activeSessionKey ? `Scanning for ${activeSessionKey === 'S1' ? 'Session 1' : 'Session 2'}` : 'Scanner Inactive'}
                  </h4>
                </div>
                {activeSessionKey && !isScannerOpen && isOrganizer && (
                   <button onClick={() => setIsScannerOpen(true)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 border border-indigo-200 transition-colors">Open Scanner</button>
                )}
                {isScannerOpen && isOrganizer && (
                   <button onClick={() => setIsScannerOpen(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 border border-slate-200 transition-colors">Close Scanner</button>
                )}
              </div>

              <div className="mb-6">
                {activeSessionKey ? (
                  isOrganizer ? (
                    isScannerOpen ? (
                      <QRScanner onScanSuccess={handleScan} />
                    ) : (
                      <div className="p-10 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                        <QrCode size={36} className="mb-3 opacity-50" />
                        <p className="font-semibold text-sm">Scanner is closed.</p>
                        <p className="text-xs mt-1">Click "Open Scanner" to resume scanning.</p>
                      </div>
                    )
                  ) : (
                    <div className="p-10 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                      <QrCode size={36} className="mb-3 opacity-50" />
                      <p className="font-semibold text-sm">Scanner is for organizers only.</p>
                    </div>
                  )
                ) : (
                  <div className="p-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                    <QrCode size={40} className="mb-3 opacity-50" />
                    <p className="font-semibold text-sm">Scanner is disabled.</p>
                    <p className="text-xs mt-1 text-center max-w-sm">You must start a session to begin scanning attendance.</p>
                  </div>
                )}
              </div>

              {scanResult && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${scanResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  {scanResult.success
                    ? <CheckCircle2 size={24} className="shrink-0 text-emerald-500 mt-0.5" />
                    : <XCircle     size={24} className="shrink-0 text-red-500 mt-0.5" />}
                  <div className="whitespace-pre-line font-semibold text-sm leading-relaxed">{scanResult.message}</div>
                </div>
              )}
            </div>
          </div>
          
          {/* Sidebar Stats */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm h-fit">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
              <Users size={20} className="text-slate-700" />
              <h4 className="font-bold text-slate-800">Live Statistics</h4>
            </div>

            <div className="space-y-3 mb-6">
               <Stat label="Total Approved" value={totalApproved} color="slate" />
               <Stat label="Students Checked In" value={studentsCheckedIn} color="emerald" />
               <Stat label="Fully Attended" value={fullyAttended} color="indigo" />
               
               <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between shadow-sm">
                 <div>
                   <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Attendance Progress</p>
                   <p className="font-bold text-slate-800">{fullyAttended} / {totalApproved}</p>
                 </div>
                 <div className="text-2xl font-black text-indigo-600">
                   {attendanceProgressPercent}%
                 </div>
               </div>

               <Stat label="Current Session" value={currentSessionStatus} color="amber" />
            </div>

            {currentConfig?.attendanceType === 'Both Sessions' && (
              <div className="mb-6 p-4 rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
                 <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider text-center">Session Breakdown</p>
                 <div className="space-y-3 text-sm">
                   <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                      <span className="font-semibold text-slate-700">Session 1</span>
                      <div className="text-xs font-bold flex gap-4">
                         <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded">P: {currentS1Present}</span>
                         <span className="text-red-500 bg-red-50 px-2 py-1 rounded">A: {totalApproved - currentS1Present}</span>
                      </div>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-700">Session 2</span>
                      <div className="text-xs font-bold flex gap-4">
                         <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded">P: {currentS2Present}</span>
                         <span className="text-red-500 bg-red-50 px-2 py-1 rounded">A: {totalApproved - currentS2Present}</span>
                      </div>
                   </div>
                 </div>
              </div>
            )}

            {isOrganizer && (
              <div className="space-y-3">
                {currentConfig.attendanceFinalized && (
                  <div className="flex gap-2">
                    <button onClick={() => handleExport('excel')} disabled={isProcessing}
                      className="flex-1 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-bold text-indigo-700 hover:bg-indigo-100 shadow-sm transition-colors text-center">
                      Export Excel
                    </button>
                    <button onClick={() => handleExport('csv')} disabled={isProcessing}
                      className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-100 shadow-sm transition-colors text-center">
                      Export CSV
                    </button>
                  </div>
                )}
                {!currentConfig.attendanceFinalized && (
                  <button onClick={() => setShowCorrectionModal(true)}
                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors">
                    Manual Attendance Correction
                  </button>
                )}
                {currentConfig.attendanceFinalized && (
                  <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                    Manual correction disabled — attendance is finalized.
                  </div>
                )}
                {currentConfig.session1Status !== 'Running' && currentConfig.session2Status !== 'Running' && (
                   <button onClick={handleFinalize} disabled={currentConfig.attendanceFinalized || isProcessing}
                     className={`w-full px-4 py-2 rounded-lg text-sm font-bold transition-colors ${currentConfig.attendanceFinalized ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'}`}>
                     {currentConfig.attendanceFinalized ? finalizedBtnText : finalizeBtnText}
                   </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Roster Table */}
      {currentConfig && (
         <AttendanceTable event={event} odRequests={odRequests} eventDates={eventDates} />
      )}

      {showCorrectionModal && (
        <ManualCorrectionModal
          event={event}
          odRequests={odRequests}
          targetDate={selectedDate}
          onClose={() => setShowCorrectionModal(false)}
          onCorrect={(res) => {
            // Refresh stats in-place without page reload
            if (res.attendanceStats) setLocalStats(res.attendanceStats);
            if (res.attendanceConfigs) setLocalConfigs(res.attendanceConfigs);
            setShowCorrectionModal(false);
          }}
        />
      )}

      {beforeStartModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
            <Clock size={48} className="mx-auto text-amber-500 mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">Attendance Cannot Start Yet</h3>
            <p className="text-sm text-slate-600 mb-6">Attendance sessions can only begin after the scheduled event start time.</p>
            <div className="bg-slate-50 rounded-lg p-3 mb-6 border border-slate-100">
              <p className="text-xs text-slate-500 font-semibold mb-1">Event Start</p>
              <p className="text-sm font-bold text-slate-800">{startDateTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')} &bull; {startDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <button onClick={() => setBeforeStartModal(false)} className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors">Close</button>
          </div>
        </div>
      )}

      {sessionStartDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
             <div className="p-6 border-b border-slate-100 text-center">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Start Attendance Session?</h3>
                <p className="text-sm text-slate-600">Attendance recording will begin immediately.</p>
                <p className="text-sm text-slate-600 mt-1">Students can now scan their QR codes.</p>
             </div>
             <div className="p-4 bg-slate-50 flex gap-3">
                <button 
                  onClick={() => setSessionStartDialog(null)} 
                  disabled={isProcessing}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                     handleSessionAction(sessionStartDialog.sessionKey, 'START');
                     setSessionStartDialog(null);
                  }} 
                  disabled={isProcessing}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors"
                >
                  Start Session
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Stat Row ────────────────────────────────────────────────────────────────
const colorMap = {
  slate:   'bg-slate-50  border-slate-100  text-slate-500',
  emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  indigo:  'bg-indigo-50  border-indigo-100  text-indigo-700',
  amber:   'bg-amber-50   border-amber-100   text-amber-700',
};
const Stat = ({ label, value, color }) => (
  <div className={`rounded-lg p-3 border flex items-center justify-between ${colorMap[color] || colorMap.slate}`}>
    <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
    <span className="text-lg font-extrabold text-slate-800">{value}</span>
  </div>
);

export default AttendanceTab;
