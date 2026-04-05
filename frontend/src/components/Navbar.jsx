import { LogOut, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import seceLogo from '../assets/sece logo.jpeg';

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
          src={seceLogo}
          alt="SECE Logo"
          className="w-10 h-10 rounded-lg object-contain border border-slate-200 bg-white"
        />
        <div>
          <h1 className="font-extrabold text-lg sm:text-xl leading-tight text-slate-800 tracking-tight">SECE Event Hub</h1>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        {currentUser && (
          <>
            <div className="text-right hidden sm:block border-l border-slate-200 pl-4 ml-1">
              <p className="text-sm font-semibold">{currentUser.name}</p>
              <p className="text-xs text-slate-500 uppercase tracking-tight">{(currentUser.role || 'GUEST').replace('_', ' ')}</p>
            </div>
            <button
              onClick={onLogout}
              className="p-2 hover:bg-slate-100 text-slate-500 hover:text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </>
        )}
        {!currentUser && (
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-1.5 bg-cse-primary text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-all border border-transparent shadow-sm hover:shadow-md"
          >
            Login
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
