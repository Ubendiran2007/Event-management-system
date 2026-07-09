import React, { useState, useEffect } from 'react';
import { Shield, KeyRound, Clock, Activity, AlertTriangle, Monitor, Globe, Mail, CheckCircle2, Eye, EyeOff, X, Search, Filter, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import Navbar from '../components/Navbar';
import AlertCard from '../components/AlertCard';
import { formatStudentNameWithRoll, fallbackValue } from '../utils/formatters';

const SecurityProfile = () => {
  const { currentUser, events } = useAppContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [loginHistory, setLoginHistory] = useState([]);
  const [securityTimeline, setSecurityTimeline] = useState([]);
  const [iqacLogs, setIqacLogs] = useState([]);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [timer, setTimer] = useState(60);
  const [isResendActive, setIsResendActive] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [timelineFilter, setTimelineFilter] = useState('All');
  const [isTimelineFilterOpen, setIsTimelineFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const [iqacRoleFilter, setIqacRoleFilter] = useState('All');
  const [iqacStatusFilter, setIqacStatusFilter] = useState('All');
  const [iqacTimeFilter, setIqacTimeFilter] = useState('All Time');
  const [iqacPage, setIqacPage] = useState(1);
  const IQAC_ITEMS_PER_PAGE = 10;
  const [isIqacRoleOpen, setIsIqacRoleOpen] = useState(false);
  const [isIqacStatusOpen, setIsIqacStatusOpen] = useState(false);
  const [isIqacTimeOpen, setIsIqacTimeOpen] = useState(false);

  const [attendanceAuditEventId, setAttendanceAuditEventId] = useState('');
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [attendanceAuditLogs, setAttendanceAuditLogs] = useState([]);
  const [fetchingAuditLogs, setFetchingAuditLogs] = useState(false);
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditSessionFilter, setAuditSessionFilter] = useState('All');
  const [auditDateFilter, setAuditDateFilter] = useState('All');
  const [isEventSelectOpen, setIsEventSelectOpen] = useState(false);
  const [isAuditSessionOpen, setIsAuditSessionOpen] = useState(false);
  const [isAuditDateOpen, setIsAuditDateOpen] = useState(false);

  useEffect(() => {
    if (activeTab === 'attendanceAudit' && attendanceAuditEventId) {
      setFetchingAuditLogs(true);
      fetch(`http://localhost:5001/api/events/${attendanceAuditEventId}/attendance-audit`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAttendanceAuditLogs(data.logs);
        } else {
          setAttendanceAuditLogs([]);
        }
      })
      .catch(() => setAttendanceAuditLogs([]))
      .finally(() => setFetchingAuditLogs(false));
    } else {
       setAttendanceAuditLogs([]);
    }
  }, [activeTab, attendanceAuditEventId]);

  const filteredAttendanceAuditLogs = React.useMemo(() => {
    return attendanceAuditLogs.filter(log => {
      if (log.action !== 'Correction') return false;
      if (auditSessionFilter !== 'All' && log.session !== auditSessionFilter) return false;
      if (auditDateFilter !== 'All' && log.date !== auditDateFilter) return false;
      
      if (auditSearchQuery) {
        const q = auditSearchQuery.trim().toLowerCase();
        const matchesStudent = ((log.studentName || '').toLowerCase().includes(q)) || 
                               ((log.rollNo || '').toLowerCase().includes(q));
        if (!matchesStudent) return false;
      }
      return true;
    });
  }, [attendanceAuditLogs, auditSessionFilter, auditDateFilter, auditSearchQuery]);

  const selectedAuditEvent = React.useMemo(() => {
    return events?.find(e => e.id === attendanceAuditEventId);
  }, [events, attendanceAuditEventId]);

  const eventDates = React.useMemo(() => {
    if (!selectedAuditEvent) return [];
    const dates = [];
    const start = selectedAuditEvent.requisition?.step1?.eventStartDate || selectedAuditEvent.date;
    const end = selectedAuditEvent.requisition?.step1?.eventEndDate || selectedAuditEvent.endDate || start;
    if (start && end) {
      let current = new Date(start);
      const last = new Date(end);
      if (!isNaN(current.getTime()) && !isNaN(last.getTime())) {
        while (current <= last) {
          dates.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }
      }
    }
    return dates;
  }, [selectedAuditEvent]);

  const filteredEventsForAudit = React.useMemo(() => {
    if (!events) return [];
    
    let filtered = events;
    if (eventSearchQuery.trim()) {
      const q = eventSearchQuery.trim().toLowerCase();
      filtered = events.filter(ev => {
        if (ev.id === attendanceAuditEventId) return true; // Keep selected event in list so dropdown doesn't break
        const title = (ev.title || ev.requisition?.step1?.eventName || '').toLowerCase();
        const dateStr = (ev.requisition?.step1?.eventStartDate || ev.date || '').toLowerCase();
        const organizer = (ev.requisition?.step1?.organizerName || '').toLowerCase();
        return title.includes(q) || dateStr.includes(q) || organizer.includes(q);
      });
    }
    
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.requisition?.step1?.eventStartDate || a.date || 0);
      const dateB = new Date(b.requisition?.step1?.eventStartDate || b.date || 0);
      return dateB - dateA;
    });
  }, [events, eventSearchQuery, attendanceAuditEventId]);


  const filteredIqacLogs = React.useMemo(() => {
    return iqacLogs.filter(log => {
      if (iqacRoleFilter !== 'All' && log.role !== iqacRoleFilter) return false;
      if (iqacStatusFilter !== 'All' && log.status !== iqacStatusFilter) return false;
      if (iqacTimeFilter !== 'All Time') {
        const logDate = new Date(log.timestamp);
        const now = new Date();
        const diffDays = (now - logDate) / (1000 * 60 * 60 * 24);
        if (iqacTimeFilter === 'Last 24 Hours' && diffDays > 1) return false;
        if (iqacTimeFilter === 'Last 7 Days' && diffDays > 7) return false;
        if (iqacTimeFilter === 'Last 30 Days' && diffDays > 30) return false;
      }
      return true;
    });
  }, [iqacLogs, iqacRoleFilter, iqacStatusFilter, iqacTimeFilter]);

  const iqacTotalPages = Math.max(1, Math.ceil(filteredIqacLogs.length / IQAC_ITEMS_PER_PAGE));
  const currentIqacPageLogs = filteredIqacLogs.slice((iqacPage - 1) * IQAC_ITEMS_PER_PAGE, iqacPage * IQAC_ITEMS_PER_PAGE);

  useEffect(() => {
    setIqacPage(1);
  }, [iqacRoleFilter, iqacStatusFilter, iqacTimeFilter]);

  useEffect(() => {
    let interval;
    if (activeTab === 'password' && step === 2 && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setIsResendActive(true);
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [activeTab, step, timer]);

  const fetchLogs = async () => {
    if (!currentUser) return;
    try {
      const token = localStorage.getItem('sessionToken');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [loginRes, timelineRes] = await Promise.all([
        fetch('http://localhost:5001/api/security/login-history', { headers }),
        fetch('http://localhost:5001/api/security/activity-timeline', { headers })
      ]);
      
      const loginData = await loginRes.json();
      const timelineData = await timelineRes.json();
      
      if (loginData.success) setLoginHistory(loginData.logs);
      if (timelineData.success) setSecurityTimeline(timelineData.logs);

      if (currentUser.role === 'IQAC_TEAM') {
        const iqacRes = await fetch('http://localhost:5001/api/security/iqac-audit', { headers });
        const iqacData = await iqacRes.json();
        if (iqacData.success) setIqacLogs(iqacData.logs);
      }
    } catch (err) {
      console.error('Error fetching security logs:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'iqac' && currentUser?.role === 'IQAC_TEAM') {
      const token = localStorage.getItem('sessionToken');
      fetch('http://localhost:5001/api/security/iqac-audit', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) setIqacLogs(data.logs);
          else console.warn('[IQAC Audit] fetch failed:', data);
        })
        .catch(err => console.error('[IQAC Audit] error:', err));
    }
  }, [activeTab, currentUser]);

  const handleChangePasswordRequest = async (e) => {
    e.preventDefault();
    setAlert(null);
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5001/api/security/change-password/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: JSON.stringify({ currentPassword })
      });
      const data = await res.json();
      if (data.success) {
        setStep(2);
        setTimer(60);
        setIsResendActive(false);
        setAlert({ type: 'success', title: 'OTP Sent Successfully', message: 'A verification code has been sent to your registered email address.' });
      } else {
        setAlert({ type: 'error', title: 'Authentication Failed', message: data.message || 'Invalid current password' });
      }
      await fetchLogs();
    } catch (err) {
      setAlert({ type: 'error', title: 'Connection Error', message: 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setAlert(null);
    if (!otp) return setAlert({ type: 'error', title: 'Validation Error', message: 'Please enter the OTP.' });
    
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5001/api/security/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: JSON.stringify({ identifier: currentUser.email, otp, type: 'CHANGE' })
      });
      const data = await res.json();
      if (data.success) {
        setStep(3);
        setAlert(null);
      } else {
        if (data.message && data.message.toLowerCase().includes('expired')) {
          setAlert({ type: 'error', title: 'OTP Expired', message: 'Your verification code has expired.\nPlease request a new OTP and try again.' });
        } else {
          setAlert({ type: 'error', title: 'Verification Failed', message: data.message || 'The OTP entered is incorrect.' });
        }
      }
      await fetchLogs();
    } catch (err) {
      setAlert({ type: 'error', title: 'Connection Error', message: 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setAlert(null);
    if (newPassword.length < 7 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      return setAlert({ 
        type: 'error', 
        title: 'Password Requirements Not Met', 
        message: 'Your password must contain:\n✓ Minimum 7 Characters\n✓ One Uppercase Letter\n✓ One Lowercase Letter\n✓ One Number\n✓ One Special Character' 
      });
    }
    if (newPassword !== confirmPassword) {
      return setAlert({ type: 'error', title: 'Password Confirmation Failed', message: 'The New Password and Confirm Password fields do not match.' });
    }
    
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5001/api/security/change-password/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: JSON.stringify({ otp, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setStep(4);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setOtp('');
        setAlert({ type: 'success', title: 'Password Updated Successfully', message: 'Your password has been changed successfully.' });
      } else {
        setAlert({ type: 'error', title: 'Update Failed', message: data.message });
      }
      await fetchLogs();
    } catch (err) {
      setAlert({ type: 'error', title: 'Connection Error', message: 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  const getProcessedTimeline = () => {
    let filtered = securityTimeline;

    if (timelineFilter !== 'All') {
      filtered = filtered.filter(log => {
        const act = log.activity.toLowerCase();
        if (timelineFilter === 'Login') return act.includes('login');
        if (timelineFilter === 'Password') return act.includes('password') && !act.includes('otp');
        if (timelineFilter === 'OTP') return act.includes('otp');
        if (timelineFilter === 'Security Alerts') return log.status === 'WARNING' || log.status === 'FAILURE';
        if (timelineFilter === 'Account Lock') return act.includes('lock');
        return true;
      });
    }

    let grouped = [];
    let currentGroup = null;
    filtered.forEach(log => {
      const isRepetitive = log.activity.includes('OTP');
      if (currentGroup && currentGroup.activity === log.activity && currentGroup.status === log.status && isRepetitive) {
        currentGroup.count = (currentGroup.count || 1) + 1;
      } else {
        if (currentGroup) grouped.push(currentGroup);
        currentGroup = { ...log, count: 1 };
      }
    });
    if (currentGroup) grouped.push(currentGroup);

    return grouped;
  };

  const fullTimeline = getProcessedTimeline();
  const totalPages = Math.ceil(fullTimeline.length / ITEMS_PER_PAGE) || 1;
  const currentTimelinePage = fullTimeline.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="h-screen flex flex-row overflow-hidden bg-slate-50 font-sans text-slate-900">
      <Navbar />
      
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto relative [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 w-full">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <Shield size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 leading-tight">Account Security</h1>
              <p className="text-slate-500 font-medium">Manage your password, login history, and security alerts</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-b border-slate-200 mb-8 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 font-semibold text-sm whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'overview' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Security Overview
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`px-4 py-2.5 font-semibold text-sm whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'password' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Change Password
          </button>
          {currentUser.role === 'IQAC_TEAM' && (
            <button
              onClick={() => setActiveTab('iqac')}
              className={`px-4 py-2.5 font-semibold text-sm whitespace-nowrap transition-colors border-b-2 ${
                activeTab === 'iqac' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              System Audit Monitor
            </button>
          )}
          {currentUser.role === 'IQAC_TEAM' && (
            <button
              onClick={() => setActiveTab('attendanceAudit')}
              className={`px-4 py-2.5 font-semibold text-sm whitespace-nowrap transition-colors border-b-2 ${
                activeTab === 'attendanceAudit' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Attendance Audit Logs
            </button>
          )}
        </div>

        {activeTab === 'overview' && (
          <div className="w-full">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-indigo-500" />
                  Security Activity Timeline
                </h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setIsTimelineFilterOpen(!isTimelineFilterOpen)}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 rounded-2xl font-extrabold transition-all text-[13px]"
                    >
                      <SlidersHorizontal size={16} className="text-slate-600" />
                      <span>Filter: {timelineFilter}</span>
                    </button>
                    
                    {isTimelineFilterOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsTimelineFilterOpen(false)} />
                        <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                          {['All', 'Login', 'Password', 'OTP', 'Security Alerts', 'Account Lock'].map(f => (
                            <button
                              key={f}
                              onClick={() => { setTimelineFilter(f); setCurrentPage(1); setIsTimelineFilterOpen(false); }}
                              className={`px-4 py-2.5 text-left text-[14px] font-bold transition-colors ${timelineFilter === f ? 'bg-indigo-600 text-white' : 'text-slate-800 hover:bg-slate-50'}`}
                            >
                              {f === 'All' ? 'All Logs' : f}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-0 overflow-x-auto rounded-b-2xl">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Activity</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentTimelinePage.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-800">
                          {log.activity} {log.count > 1 && <span className="text-xs text-slate-500 ml-1 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">({log.count} Times)</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                            log.status === 'WARNING' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                            'bg-red-50 text-red-600 border-red-200'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 font-mono whitespace-nowrap">
                          {log.ip || '-'}
                        </td>
                      </tr>
                    ))}
                    {currentTimelinePage.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                          <AlertTriangle size={32} className="mx-auto mb-3 text-slate-300" />
                          <p className="font-semibold text-slate-600">No activity records found</p>
                          <p className="text-xs mt-1">Try adjusting your filters</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 rounded-b-2xl">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    Previous
                  </button>
                  <span className="text-sm font-medium text-slate-500">
                    Page <span className="font-bold text-slate-800">{currentPage}</span> of {totalPages}
                  </span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'password' && (
          <div className="max-w-lg mx-auto relative left-8 glass-panel p-8 rounded-2xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <KeyRound size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Change Password</h2>
              <p className="text-slate-500 mt-2">Secure your account with a strong password.</p>
            </div>

            {alert && (
              <AlertCard 
                type={alert.type} 
                title={alert.title} 
                message={alert.message} 
                onClose={() => setAlert(null)} 
              />
            )}

            {step === 1 && (
              <form onSubmit={handleChangePasswordRequest} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      className="input-field !pr-10"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                    <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary py-3"
                >
                  {loading ? 'Verifying...' : 'Continue'}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">6-Digit OTP</label>
                    <span className="text-xs font-semibold text-indigo-600">
                      {timer > 0 ? `00:${timer.toString().padStart(2, '0')}` : ''}
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    className="input-field tracking-widest font-mono text-center text-xl"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">Sent to your registered email. OTP expires in 1 minute.</p>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary py-3"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>

                {isResendActive && (
                  <button
                    type="button"
                    onClick={handleChangePasswordRequest}
                    disabled={loading}
                    className="w-full btn-secondary flex items-center justify-center gap-2 mt-3"
                  >
                    Resend OTP
                  </button>
                )}
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleChangePassword} className="space-y-5">
                <div className="space-y-1.5 mt-4">
                  <label className="text-sm font-medium text-slate-700">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      className="input-field !pr-10"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Min 7 chars, 1 Upper, 1 Lower, 1 Num, 1 Spec"
                      required
                    />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 mt-4">
                  <label className="text-sm font-medium text-slate-700">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="input-field !pr-10"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary py-3"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            )}

            {step === 4 && (
              <div className="py-2">
                <button
                  onClick={() => { setStep(1); setActiveTab('overview'); setAlert(null); }}
                  className="w-full btn-secondary py-3 mt-4"
                >
                  Back to Security
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'iqac' && currentUser.role === 'IQAC_TEAM' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-[600px] max-h-[600px]">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Globe size={18} className="text-indigo-500" />
                System Login Audit Monitor
              </h3>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Role Filter */}
                <div className="relative">
                  <button
                    onClick={() => { setIsIqacRoleOpen(!isIqacRoleOpen); setIsIqacStatusOpen(false); setIsIqacTimeOpen(false); }}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 rounded-2xl font-extrabold transition-all text-[13px]"
                  >
                    <SlidersHorizontal size={16} className="text-slate-600" />
                    <span>Role: {iqacRoleFilter === 'All' ? 'All Roles' : iqacRoleFilter === 'STUDENT_GENERAL' ? 'Student' : iqacRoleFilter === 'STUDENT_ORGANIZER' ? 'Organizer' : iqacRoleFilter === 'IQAC_TEAM' ? 'IQAC' : iqacRoleFilter === 'HR_TEAM' ? 'HR' : iqacRoleFilter === 'SYSTEM_ADMIN' ? 'ICTS' : iqacRoleFilter === 'BOYS_WARDEN' ? 'Boys Warden' : iqacRoleFilter === 'GIRLS_WARDEN' ? 'Girls Warden' : iqacRoleFilter === 'AUDIO_TEAM' ? 'Audio' : iqacRoleFilter === 'TRANSPORT_TEAM' ? 'Transport' : iqacRoleFilter}</span>
                  </button>
                  {isIqacRoleOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsIqacRoleOpen(false)} />
                      <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-y-auto max-h-[280px] flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                        {[['All', 'All Roles'], ['STUDENT_GENERAL', 'Student'], ['STUDENT_ORGANIZER', 'Organizer'], ['FACULTY', 'Faculty'], ['HOD', 'HOD'], ['IQAC_TEAM', 'IQAC'], ['HR_TEAM', 'HR'], ['SYSTEM_ADMIN', 'ICTS'], ['BOYS_WARDEN', 'Boys Warden'], ['GIRLS_WARDEN', 'Girls Warden'], ['AUDIO_TEAM', 'Audio'], ['MEDIA', 'Media'], ['TRANSPORT_TEAM', 'Transport']].map(([val, label]) => (
                          <button
                            key={val}
                            onClick={() => { setIqacRoleFilter(val); setIsIqacRoleOpen(false); }}
                            className={`px-4 py-2.5 text-left text-[14px] font-bold transition-colors ${iqacRoleFilter === val ? 'bg-indigo-600 text-white' : 'text-slate-800 hover:bg-slate-50'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Status Filter */}
                <div className="relative">
                  <button
                    onClick={() => { setIsIqacStatusOpen(!isIqacStatusOpen); setIsIqacRoleOpen(false); setIsIqacTimeOpen(false); }}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 rounded-2xl font-extrabold transition-all text-[13px]"
                  >
                    <SlidersHorizontal size={16} className="text-slate-600" />
                    <span>Status: {iqacStatusFilter === 'All' ? 'All Statuses' : iqacStatusFilter}</span>
                  </button>
                  {isIqacStatusOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsIqacStatusOpen(false)} />
                      <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                        {[['All', 'All Statuses'], ['SUCCESS', 'Success'], ['FAILURE', 'Failure']].map(([val, label]) => (
                          <button
                            key={val}
                            onClick={() => { setIqacStatusFilter(val); setIsIqacStatusOpen(false); }}
                            className={`px-4 py-2.5 text-left text-[14px] font-bold transition-colors ${iqacStatusFilter === val ? 'bg-indigo-600 text-white' : 'text-slate-800 hover:bg-slate-50'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Time Filter */}
                <div className="relative">
                  <button
                    onClick={() => { setIsIqacTimeOpen(!isIqacTimeOpen); setIsIqacRoleOpen(false); setIsIqacStatusOpen(false); }}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 rounded-2xl font-extrabold transition-all text-[13px]"
                  >
                    <SlidersHorizontal size={16} className="text-slate-600" />
                    <span>{iqacTimeFilter}</span>
                  </button>
                  {isIqacTimeOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsIqacTimeOpen(false)} />
                      <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                        {['All Time', 'Last 24 Hours', 'Last 7 Days', 'Last 30 Days'].map((f) => (
                          <button
                            key={f}
                            onClick={() => { setIqacTimeFilter(f); setIsIqacTimeOpen(false); }}
                            className={`px-4 py-2.5 text-left text-[14px] font-bold transition-colors ${iqacTimeFilter === f ? 'bg-indigo-600 text-white' : 'text-slate-800 hover:bg-slate-50'}`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>


            <div className="flex-1 overflow-y-auto no-scrollbar relative">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Role / Dept</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Login Time</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Environment</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentIqacPageLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-slate-800">{formatStudentNameWithRoll(log.name, log.rollNo, log.userId)}</p>
                        <p className="text-xs text-slate-500">{log.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-slate-700 uppercase">{log.role}</p>
                        <p className="text-xs text-slate-500">{fallbackValue(log.department, 'general')}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-700">{log.browser} on {log.os}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{log.ip}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {currentIqacPageLogs.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <AlertTriangle size={32} className="text-slate-300" />
                          <p>No login activity recorded for the current filters.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto shrink-0 rounded-b-2xl">
              <div className="text-sm text-slate-500 font-medium">
                {filteredIqacLogs.length > 0 ? (
                  <>Showing <span className="text-slate-800 font-semibold">{(iqacPage - 1) * IQAC_ITEMS_PER_PAGE + 1}–{Math.min(iqacPage * IQAC_ITEMS_PER_PAGE, filteredIqacLogs.length)}</span> of <span className="text-slate-800 font-semibold">{filteredIqacLogs.length}</span> records</>
                ) : (
                  'No records'
                )}
              </div>
              <div className="flex items-center gap-3">
                <button 
                  disabled={iqacPage === 1}
                  onClick={() => setIqacPage(prev => prev - 1)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Previous
                </button>
                <span className="px-2 text-sm font-medium text-slate-500">
                  Page {iqacPage} of {iqacTotalPages}
                </span>
                <button 
                  disabled={iqacPage === iqacTotalPages || iqacTotalPages === 0}
                  onClick={() => setIqacPage(prev => prev + 1)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}



        {activeTab === 'attendanceAudit' && currentUser.role === 'IQAC_TEAM' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-[600px] max-h-[700px]">
            <div className="p-6 border-b border-slate-100 flex flex-col gap-4 shrink-0">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Clock size={18} className="text-indigo-500" />
                  Attendance Modification Audit Log
                </h3>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  {/* Search with autocomplete */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search events..."
                      value={eventSearchQuery}
                      onChange={(e) => { setEventSearchQuery(e.target.value); setIsEventSelectOpen(false); }}
                      onFocus={() => { if (eventSearchQuery.trim()) setIsEventSelectOpen(false); }}
                      className="pl-8 pr-4 py-2 font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-indigo-400 w-full shadow-sm text-sm"
                    />
                    {eventSearchQuery.trim() && filteredEventsForAudit.length > 0 && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setEventSearchQuery('')} />
                        <div className="absolute left-0 mt-2 w-80 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-y-auto max-h-[260px] flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                          {filteredEventsForAudit.map(ev => {
                            const rawDate = ev.requisition?.step1?.eventStartDate || ev.date || ev.startDate || '';
                            const displayDate = rawDate ? rawDate.split('T')[0] : '';
                            const eventName = ev.title || ev.requisition?.step1?.eventName || 'Untitled';
                            return (
                              <button
                                key={ev.id}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => { setAttendanceAuditEventId(ev.id); setEventSearchQuery(''); }}
                                className={`px-4 py-2.5 text-left text-[13px] font-semibold transition-colors whitespace-normal leading-snug ${attendanceAuditEventId === ev.id ? 'bg-indigo-600 text-white' : 'text-slate-800 hover:bg-indigo-50'}`}
                              >
                                {eventName}
                                {displayDate && <span className="opacity-60 text-[11px] ml-1">({displayDate})</span>}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Event Select Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setIsEventSelectOpen(!isEventSelectOpen)}
                      className="flex items-center justify-between gap-2 px-4 py-2 bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 rounded-xl font-semibold transition-all text-sm w-full sm:w-80"
                    >
                      <span className="truncate text-slate-600">
                        {attendanceAuditEventId
                          ? (() => {
                              const ev = events?.find(e => e.id === attendanceAuditEventId);
                              return ev?.title || ev?.requisition?.step1?.eventName || 'Selected Event';
                            })()
                          : 'Select Event...'}
                      </span>
                      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {isEventSelectOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsEventSelectOpen(false)} />
                        <div className="absolute right-0 mt-2 w-96 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-y-auto max-h-[260px] flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                          <button
                            onClick={() => { setAttendanceAuditEventId(''); setIsEventSelectOpen(false); }}
                            className={`px-4 py-2.5 text-left text-[13px] font-bold transition-colors ${!attendanceAuditEventId ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                          >
                            Select Event...
                          </button>
                          {events?.slice().sort((a, b) => {
                            const dateA = new Date(a.requisition?.step1?.eventStartDate || a.date || 0);
                            const dateB = new Date(b.requisition?.step1?.eventStartDate || b.date || 0);
                            return dateB - dateA;
                          }).map(ev => {
                            const rawDate = ev.requisition?.step1?.eventStartDate || ev.date || ev.startDate || '';
                            const displayDate = rawDate ? rawDate.split('T')[0] : '';
                            const eventName = ev.title || ev.requisition?.step1?.eventName || 'Untitled';
                            return (
                              <button
                                key={ev.id}
                                onClick={() => { setAttendanceAuditEventId(ev.id); setIsEventSelectOpen(false); }}
                                className={`px-4 py-2.5 text-left text-[13px] font-semibold transition-colors whitespace-normal leading-snug ${attendanceAuditEventId === ev.id ? 'bg-indigo-600 text-white' : 'text-slate-800 hover:bg-slate-50'}`}
                              >
                                {eventName}
                                {displayDate && <span className="opacity-60 text-[11px] ml-1">({displayDate})</span>}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>

              {attendanceAuditEventId && (
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    placeholder="Search by Student or Roll No..."
                    value={auditSearchQuery}
                    onChange={(e) => setAuditSearchQuery(e.target.value)}
                    className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg flex-1 min-w-[200px] outline-none focus:border-indigo-400 shadow-sm"
                  />
                  {/* Session Filter */}
                  <div className="relative">
                    <button
                      onClick={() => { setIsAuditSessionOpen(!isAuditSessionOpen); setIsAuditDateOpen(false); }}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 rounded-2xl font-extrabold transition-all text-[13px]"
                    >
                      <SlidersHorizontal size={16} className="text-slate-600" />
                      <span>Session: {auditSessionFilter === 'All' ? 'All Sessions' : auditSessionFilter}</span>
                    </button>
                    {isAuditSessionOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsAuditSessionOpen(false)} />
                        <div className="absolute left-0 mt-2 w-44 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                          {[['All', 'All Sessions'], ['S1', 'Session 1'], ['S2', 'Session 2'], ['BOTH', 'Both Sessions']].map(([val, label]) => (
                            <button
                              key={val}
                              onClick={() => { setAuditSessionFilter(val); setIsAuditSessionOpen(false); }}
                              className={`px-4 py-2.5 text-left text-[14px] font-bold transition-colors ${auditSessionFilter === val ? 'bg-indigo-600 text-white' : 'text-slate-800 hover:bg-slate-50'}`}
                            >{label}</button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Date Filter */}
                  <div className="relative">
                    <button
                      onClick={() => { setIsAuditDateOpen(!isAuditDateOpen); setIsAuditSessionOpen(false); }}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 rounded-2xl font-extrabold transition-all text-[13px]"
                    >
                      <SlidersHorizontal size={16} className="text-slate-600" />
                      <span>Date: {auditDateFilter === 'All' ? 'All Dates' : auditDateFilter}</span>
                    </button>
                    {isAuditDateOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsAuditDateOpen(false)} />
                        <div className="absolute left-0 mt-2 w-44 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-y-auto max-h-[240px] flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                          <button
                            onClick={() => { setAuditDateFilter('All'); setIsAuditDateOpen(false); }}
                            className={`px-4 py-2.5 text-left text-[14px] font-bold transition-colors ${auditDateFilter === 'All' ? 'bg-indigo-600 text-white' : 'text-slate-800 hover:bg-slate-50'}`}
                          >All Dates</button>
                          {eventDates.map(d => (
                            <button
                              key={d}
                              onClick={() => { setAuditDateFilter(d); setIsAuditDateOpen(false); }}
                              className={`px-4 py-2.5 text-left text-[14px] font-bold transition-colors ${auditDateFilter === d ? 'bg-indigo-600 text-white' : 'text-slate-800 hover:bg-slate-50'}`}
                            >{d}</button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {attendanceAuditEventId ? (
              <div className="flex-1 overflow-y-auto no-scrollbar relative">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Target</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Previous</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Updated</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Reason</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Modified By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fetchingAuditLogs ? (
                      <tr><td colSpan="7" className="p-8 text-center text-slate-500">Loading audit logs...</td></tr>
                    ) : filteredAttendanceAuditLogs.length === 0 ? (
                      <tr><td colSpan="7" className="p-8 text-center text-slate-500">No attendance audit logs found for the selected filters.</td></tr>
                    ) : (
                      filteredAttendanceAuditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-slate-800 whitespace-nowrap">{log.dateStamp}</p>
                            <p className="text-xs text-slate-500 whitespace-nowrap">{log.time}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-bold tracking-wider">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {log.rollNo && log.rollNo !== 'N/A' ? (
                               <>
                                 <p className="text-sm font-semibold text-slate-800">{log.studentName}</p>
                                 <p className="text-xs text-slate-500 mb-1">{log.rollNo}</p>
                                 <p className="text-[11px] font-bold text-indigo-600 bg-indigo-50 inline-flex px-1.5 py-0.5 rounded">
                                   Target: {log.date}
                                 </p>
                               </>
                            ) : (
                               <p className="text-sm font-medium text-slate-700">{log.date} {log.session !== 'N/A' ? `(${log.session})` : ''}</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${log.previousStatus === 'N/A' ? 'text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                              {log.previousStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${log.updatedStatus === 'N/A' ? 'text-slate-400' : 'bg-emerald-50 text-emerald-700'}`}>
                              {log.updatedStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600 max-w-[200px] truncate" title={log.reason}>
                            {log.reason}
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs font-semibold text-slate-800">{log.modifiedBy}</p>
                            <p className="text-[10px] uppercase text-slate-500 tracking-wider">{log.userRole}</p>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3 p-12">
                 <Shield size={48} className="text-slate-200" />
                 <p className="font-semibold text-lg">Select an Event</p>
                 <p className="text-sm">Choose an event from the dropdown to view its attendance audit trail.</p>
               </div>
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  );
};

export default SecurityProfile;
