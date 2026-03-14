import { LogOut, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import cseLogo from '../assets/cse_b.jpg';

const Navbar = () => {
  const { currentUser, handleLogout } = useAppContext();
  const navigate = useNavigate();

  const onLogout = () => {
    handleLogout();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-3 flex justify-between items-center">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(currentUser ? '/dashboard' : '/')}>
        <img
          src={cseLogo}
          alt="CSE Department"
          className="w-10 h-10 rounded-lg object-cover border border-slate-200"
        />
        <div>
          <h1 className="font-bold text-base sm:text-lg leading-tight">CSE Event Management</h1>
          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Department of Computer Science</p>
        </div>
      </div>
      {currentUser && (
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cse-accent/10 text-cse-accent hover:bg-cse-accent hover:text-white rounded-lg transition-colors text-xs font-semibold"
            title="Dashboard"
          >
            <LayoutDashboard size={16} />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">{currentUser.name}</p>
            <p className="text-xs text-slate-500">{currentUser.role.replace('_', ' ')}</p>
          </div>
          <button
            onClick={onLogout}
            className="p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
