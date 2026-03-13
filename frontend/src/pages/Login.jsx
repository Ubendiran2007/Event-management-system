import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { UserRole } from '../types';

import Navbar from '../components/Navbar';

const Login = () => {
  const { handleLogin } = useAppContext();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [unlockInputs, setUnlockInputs] = useState(false);

  const enableInputEditing = () => {
    if (!unlockInputs) setUnlockInputs(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Authenticate against the backend API (Firestore)
      const response = await fetch('http://localhost:5001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username.trim(), password }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('user', JSON.stringify(data.user));
        handleLogin({
          ...data.user,
          role: data.user.role || UserRole.STUDENT_GENERAL,
          isApprovedOrganizer: data.user.isApprovedOrganizer || false,
        });
        navigate('/dashboard');
      } else {
        setError(data.message || 'Invalid username or password');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Unable to connect to the server. Please try again.');
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
              <label className="text-sm font-semibold text-slate-700">Username / Email</label>
              <input
                type="text"
                name="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={enableInputEditing}
                onClick={enableInputEditing}
                className="input-field"
                placeholder="Username or Email"
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
                  placeholder="Password or Roll No"
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

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm text-center">
                {error}
              </div>
            )}

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
    </div>
  );
};

export default Login;
