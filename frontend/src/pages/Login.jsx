import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { UserRole } from '../types';
import { getRolePath } from '../utils/routeUtils';

import Navbar from '../components/Navbar';
import ForgotPasswordModal from '../components/ForgotPasswordModal';
import AlertCard from '../components/AlertCard';



const Login = () => {
  const { handleLogin } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [unlockInputs, setUnlockInputs] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const alertRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (alertRef.current && !alertRef.current.contains(event.target)) {
        setAlert(null);
      }
    };

    if (alert) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [alert]);

  const enableInputEditing = () => {
    if (!unlockInputs) setUnlockInputs(true);
  };

  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);
    setLoading(true);

    try {
      // Authenticate against the backend API (Firestore)
      const response = await fetch((import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com') + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username.trim(), password }),
      });



      const data = await response.json();

      if (data.success) {
        // Store session token for all subsequent API calls
        if (data.token) {
          localStorage.setItem('sessionToken', data.token);
        }
        localStorage.setItem('user', JSON.stringify(data.user));
        const userRole = data.user.role || UserRole.STUDENT_GENERAL;
        handleLogin({
          ...data.user,
          role: userRole,
          isApprovedOrganizer: data.user.isApprovedOrganizer || false,
        });
        const rolePrefix = getRolePath(userRole);
        
        // Redirect to the originally requested URL, or fallback to the dashboard
        const from = location.state?.from?.pathname || `/${rolePrefix}/dashboard`;
        navigate(from, { replace: true });

      } else {
        if (data.message && (data.message.toLowerCase().includes('lock') || data.message.toLowerCase().includes('too many'))) {
          setAlert({
            type: 'error',
            title: 'Account Temporarily Locked',
            message: 'Multiple unsuccessful login attempts have been detected.\nFor security reasons, your account has been temporarily locked for 15 minutes.'
          });
        } else {
          setAlert({
            type: 'error',
            title: 'Authentication Failed',
            message: 'The email or password entered is incorrect.\nPlease verify your credentials and try again.'
          });
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setAlert({
        type: 'error',
        title: 'Connection Error',
        message: 'Unable to connect to the server. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full glass-panel p-8 rounded-2xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Welcome Back</h2>
            <p className="text-slate-500 mt-2">Sign in to access the portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off" noValidate>
            {/* Hidden fields help prevent password managers from forcing stale autofill values */}
            <input
              type="text"
              name="fake-username"
              autoComplete="username"
              tabIndex={-1}
              aria-hidden="true"
              className="absolute opacity-0 pointer-events-none h-0 w-0"
            />
            <input
              type="password"
              name="fake-password"
              autoComplete="current-password"
              tabIndex={-1}
              aria-hidden="true"
              className="absolute opacity-0 pointer-events-none h-0 w-0"
            />

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Email Address or Username</label>
              <input
                type="text"
                name="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={enableInputEditing}
                onClick={enableInputEditing}
                className="input-field"
                placeholder="Enter your email or username"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                readOnly={!unlockInputs}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={enableInputEditing}
                  onClick={enableInputEditing}
                  className="input-field pr-10"
                  placeholder="Enter your password"
                  autoComplete="new-password"
                  readOnly={!unlockInputs}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {alert && (
              <div ref={alertRef}>
                <AlertCard 
                  type={alert.type} 
                  title={alert.title} 
                  message={alert.message} 
                  onClose={() => setAlert(null)} 
                />
              </div>
            )}

            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2 py-3"
            >
              <LogIn size={18} />
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
             
           
          </form>
        </div>
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
};

export default Login;
