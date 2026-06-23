import React, { useState, useEffect } from 'react';
import { Shield, KeyRound, Clock, Activity, AlertTriangle, Monitor, Globe, Mail, CheckCircle2, Eye, EyeOff, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import Navbar from '../components/Navbar';
import AlertCard from '../components/AlertCard';
import { formatStudentNameWithRoll, fallbackValue } from '../utils/formatters';

const SecurityProfile = () => {
  const { currentUser } = useAppContext();
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
  
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

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
          setAlert({ type: 'error', title: 'Verification Failed', message: 'The OTP entered is incorrect.\nPlease check the code sent to your registered email and try again.' });
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

  const getProcessedTimeline = (isFullHistory) => {
    let filtered = securityTimeline;

    if (isFullHistory && timelineFilter !== 'All') {
      filtered = filtered.filter(log => {
        const act = log.activity.toLowerCase();
        if (timelineFilter === 'Login') return act.includes('login');
        if (timelineFilter === 'Password') return act.includes('password') && !act.includes('otp');
        if (timelineFilter === 'OTP') return act.includes('otp');
        if (timelineFilter === 'Security Alerts') return log.status === 'WARNING' || log.status === 'FAILURE';
        if (timelineFilter === 'Account Lock') return act.includes('lock');
        return true;
      });
    } else if (!isFullHistory) {
      const highValuePatterns = ['login', 'password changed', 'password reset', 'account locked', 'suspicious'];
      filtered = filtered.filter(log => {
        const act = log.activity.toLowerCase();
        return highValuePatterns.some(p => act.includes(p)) && !act.includes('otp');
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

    if (!isFullHistory) {
      grouped = grouped.slice(0, 4);
    }

    return grouped;
  };

  const previewTimeline = getProcessedTimeline(false);
  const fullTimeline = getProcessedTimeline(true);
  const totalPages = Math.ceil(fullTimeline.length / ITEMS_PER_PAGE);
  const currentTimelinePage = fullTimeline.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-12">
      <Navbar />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">Account Security</h1>
            <p className="text-slate-500 font-medium">Manage your password, login history, and security alerts</p>
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
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Activity size={18} className="text-blue-500" />
                  Security Summary
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-slate-500 text-sm font-medium">Last Login</span>
                    <span className="text-slate-800 text-sm font-semibold">{loginHistory[0] ? new Date(loginHistory[0].timestamp).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-slate-500 text-sm font-medium">Active Sessions</span>
                    <span className="text-slate-800 text-sm font-semibold">1</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-500 text-sm font-medium">Recent Activities</span>
                    <span className="text-slate-800 text-sm font-semibold">{securityTimeline.length}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Clock size={18} className="text-amber-500" />
                  Recent Login History
                </h3>
                <div className="space-y-4">
                  {loginHistory.slice(0, 3).map((log) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="mt-1"><Monitor size={16} className="text-slate-400" /></div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{log.browser} on {log.os}</p>
                        <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()} • {log.ip}</p>
                      </div>
                    </div>
                  ))}
                  {loginHistory.length === 0 && <p className="text-sm text-slate-500">No recent logins found.</p>}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-indigo-500" />
                    Security Activity Timeline
                  </h3>
                </div>
                <div className="p-0">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Date & Time</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Activity</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">IP Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewTimeline.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-800">
                            {log.activity} {log.count > 1 && <span className="text-xs text-slate-500 ml-1 font-semibold">({log.count} Times)</span>}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' :
                              log.status === 'WARNING' ? 'bg-amber-50 text-amber-600' :
                              'bg-red-50 text-red-600'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 font-mono">
                            {log.ip || '-'}
                          </td>
                        </tr>
                      ))}
                      {previewTimeline.length === 0 && (
                        <tr>
                          <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                            No high-value security activities recorded recently.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                  <button 
                    onClick={() => setShowFullHistory(true)}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors w-full text-center py-1"
                  >
                    View Full History
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'password' && (
          <div className="max-w-xl mx-auto glass-panel p-8 rounded-2xl">
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
                      className="input-field pr-10"
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
                      className="input-field pr-10"
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
                      className="input-field pr-10"
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Globe size={18} className="text-indigo-500" />
                System Login Audit Monitor
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">User</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Role / Dept</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Login Time</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Environment</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {iqacLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
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
                  {iqacLogs.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                        No login activity recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* History Modal */}
        {showFullHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-5xl h-[75vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white shrink-0">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-indigo-500" />
                  Security Activity History
                </h3>
                
                <div className="flex items-center gap-4">
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {['All', 'Login', 'Password', 'OTP', 'Security Alerts', 'Account Lock'].map(f => (
                      <button
                        key={f}
                        onClick={() => { setTimelineFilter(f); setCurrentPage(1); }}
                        className={`px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap transition-colors ${
                          timelineFilter === f ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={() => { setShowFullHistory(false); setTimelineFilter('All'); setCurrentPage(1); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-0 bg-slate-50/50">
                <table className="w-full text-left border-collapse bg-white">
                  <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Activity</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">IP Address</th>
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
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                            log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' :
                            log.status === 'WARNING' ? 'bg-amber-50 text-amber-600' :
                            'bg-red-50 text-red-600'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 font-mono">
                          {log.ip || '-'}
                        </td>
                      </tr>
                    ))}
                    {currentTimelinePage.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <AlertTriangle size={32} className="text-slate-300" />
                            <p>No security activities recorded for this filter.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Modal Footer (Sticky) */}
              <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                <div className="text-sm text-slate-500 font-medium">
                  {fullTimeline.length > 0 ? (
                    <>Showing <span className="text-slate-800 font-semibold">{(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, fullTimeline.length)}</span> of <span className="text-slate-800 font-semibold">{fullTimeline.length}</span></>
                  ) : (
                    'No results'
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-2 text-sm font-medium text-slate-400">
                    Page {currentPage} of {Math.max(1, totalPages)}
                  </span>
                  <button 
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                  >
                    Next
                  </button>
                  <div className="w-px h-6 bg-slate-200 mx-2"></div>
                  <button 
                    onClick={() => { setShowFullHistory(false); setTimelineFilter('All'); setCurrentPage(1); }}
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
                  >
                    Close History
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default SecurityProfile;
