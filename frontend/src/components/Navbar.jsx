import { LogOut, LayoutDashboard, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import seceLogo from '../assets/sece logo.jpeg';

const Navbar = () => {
  const { currentUser, handleLogout, students } = useAppContext();
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
            {(() => {
              const liveStudent = (students || []).find(s => s.id === currentUser.id);
              const displayData = liveStudent || currentUser;
              const odUsed = displayData.odUsed || 0;
              const odLimit = displayData.odLimit || 7;
              const isOverLimit = odUsed >= odLimit;
              const isWarning = odUsed >= 5;

              return (
                <div className="text-right hidden sm:block border-l border-slate-200 pl-4 ml-1">
                  <div className="flex flex-col items-end">
                    <p className="text-sm font-semibold">{displayData.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-slate-500 uppercase tracking-tight">
                        {(displayData.role || 'GUEST').replace('_', ' ')}
                      </p>
                      {(displayData.role === 'STUDENT_GENERAL' || displayData.role === 'STUDENT_ORGANIZER') && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isOverLimit 
                            ? 'bg-red-50 text-red-600 border-red-100' 
                            : isWarning 
                              ? 'bg-amber-50 text-amber-600 border-amber-100'
                              : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        }`}>
                          {odUsed} / {odLimit} ODs Used
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
            <button
              onClick={() => navigate('/security')}
              className="p-2 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
              title="Account Security"
            >
              <Shield size={20} />
            </button>
            <button
              onClick={onLogout}
              className="p-2 hover:bg-slate-100 text-slate-500 hover:text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
