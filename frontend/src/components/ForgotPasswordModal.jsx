import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, KeyRound, CheckCircle2, Lock, Loader2, Eye, EyeOff } from 'lucide-react';

const ForgotPasswordModal = ({ onClose }) => {
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(60);
  const [isResendActive, setIsResendActive] = useState(false);

  useEffect(() => {
    let interval;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setIsResendActive(true);
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!identifier) return setError('Please enter your Account Identifier.');
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:5001/api/security/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      const data = await res.json();
      if (data.success) {
        setMaskedEmail(data.maskedEmail);
        setStep(2);
        setTimer(60);
        setIsResendActive(false);
      } else {
        setError(data.message || 'Failed to send OTP.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) return setError('Please enter the OTP.');
    
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:5001/api/security/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otp, type: 'RESET' })
      });
      const data = await res.json();
      if (data.success) {
        setStep(3);
      } else {
        setError(data.message || 'Invalid OTP.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 7) return setError('Password must be at least 7 characters long.');
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      return setError('Password must contain uppercase, lowercase, a number, and a special character.');
    }
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');

    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:5001/api/security/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otp, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setStep(4);
      } else {
        setError(data.message || 'Failed to reset password.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Lock size={20} className="text-indigo-600" />
              Reset Password
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
                {error}
              </div>
            )}

            {step === 1 && (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <p className="text-sm text-slate-600 mb-4">
                  Enter your registered College Email, Roll Number, or Employee ID to receive a password reset OTP.
                </p>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Account Identifier</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                      placeholder="e.g. 24CS257 or faculty@sece.ac.in"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : 'Send OTP'}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <p className="text-sm text-slate-600 mb-4">
                  OTP has been sent to your registered college email address (<strong>{maskedEmail}</strong>).<br />
                  OTP expires in 1 minute.
                </p>
                
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">6-Digit OTP</label>
                    <span className="text-xs font-semibold text-indigo-600">
                      {timer > 0 ? `00:${timer.toString().padStart(2, '0')}` : ''}
                    </span>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      maxLength={6}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all tracking-widest font-mono text-lg"
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : 'Verify OTP'}
                </button>

                {isResendActive && (
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={loading}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 disabled:opacity-50 font-medium transition-colors text-sm"
                  >
                    Resend OTP
                  </button>
                )}
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-sm text-slate-600 mb-4">
                  OTP Verified. Please enter your new password.
                </p>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                      placeholder="Min 7 chars, 1 Upper, 1 Lower, 1 Num, 1 Spec"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 mt-4">
                  <label className="text-sm font-medium text-slate-700">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : 'Reset Password'}
                </button>
              </form>
            )}

            {step === 4 && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Password Reset Successful</h3>
                <p className="text-slate-600 mb-6">
                  Your password has been changed. You can now use your new password to sign in.
                </p>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                >
                  Return to Login
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ForgotPasswordModal;
