import React, { useState, useEffect } from 'react';
import { Shield, KeyRound, Clock, Activity, AlertTriangle, Monitor, Globe, Mail, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import Navbar from '../components/Navbar';
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
  const [message, setMessage] = useState({ type: '', text: '' });
  const [timer, setTimer] = useState(60);
  const [isResendActive, setIsResendActive] = useState(false);

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

  useEffect(() => {
    if (!currentUser) return;
    const fetchLogs = async () => {
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
    fetchLogs();
  }, [currentUser]);

  const handleChangePasswordRequest = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
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
        setMessage({ type: 'success', text: 'OTP sent to your email.' });
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    if (!otp) return setMessage({ type: 'error', text: 'Please enter the OTP.' });
    
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5001/api/security/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: JSON.stringify({ email: currentUser.email, otp, type: 'CHANGE' })
      });
      const data = await res.json();
      if (data.success) {
        setStep(3);
      } else {
        setMessage({ type: 'error', text: data.message || 'Invalid OTP' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    if (newPassword.length < 7) return setMessage({ type: 'error', text: 'Password must be at least 7 characters long.' });
    if (newPassword !== confirmPassword) return setMessage({ type: 'error', text: 'Passwords do not match.' });
    
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
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

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
                <div className="p-6 border-b border-slate-100">
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
                      {securityTimeline.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-800">
                            {log.activity}
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
                      {securityTimeline.length === 0 && (
                        <tr>
                          <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                            No security activities recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'password' && (
          <div className="max-w-xl mx-auto bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <KeyRound size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Change Password</h2>
              <p className="text-slate-500 mt-2">Secure your account with a strong password.</p>
            </div>

            {message.text && (
              <div className={`mb-6 p-4 rounded-xl text-sm font-medium ${
                message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
                {message.text}
              </div>
            )}

            {step === 1 && (
              <form onSubmit={handleChangePasswordRequest} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Current Password</label>
                  <input
                    type="password"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
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
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none tracking-widest font-mono text-center text-xl"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">Sent to your registered email.</p>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>

                {isResendActive && (
                  <button
                    type="button"
                    onClick={handleChangePasswordRequest}
                    disabled={loading}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 disabled:opacity-50 font-medium transition-colors text-sm"
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
                  <input
                    type="password"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div className="space-y-1.5 mt-4">
                  <label className="text-sm font-medium text-slate-700">Confirm New Password</label>
                  <input
                    type="password"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            )}

            {step === 4 && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Success!</h3>
                <p className="text-slate-600 mb-6">Your password has been changed securely.</p>
                <button
                  onClick={() => { setStep(1); setActiveTab('overview'); }}
                  className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
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
      </main>
    </div>
  );
};

export default SecurityProfile;
