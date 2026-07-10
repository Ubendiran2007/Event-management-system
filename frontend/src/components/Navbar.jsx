import { LogOut, LayoutDashboard, Calendar, CalendarDays, Compass, Ticket, CheckCircle2, FileEdit, ClipboardList, Users, UserCog, Shield } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import seceLogo from '../assets/sece logo.jpeg';
import { UserRole } from '../types';
import { getRolePath } from '../utils/routeUtils';

const Navbar = () => {
  const { currentUser, handleLogout, students, events } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  const isLoginPage = location.pathname === '/' || location.pathname === '/login';
  if (isLoginPage || !currentUser) return null;

  const onLogout = () => {
    handleLogout();
    navigate('/');
  };

  const rolePrefix = getRolePath(currentUser.role);

  // Derive active tab logic from URL
  let currentActive = 'dashboard';
  const feature = location.pathname.split('/').filter(Boolean).pop();
  if (['dashboard', 'events', 'approvals', 'registrations', 'modifications', 'available', 'my-registrations'].includes(feature)) {
    currentActive = feature;
  } else if (location.pathname.includes('/security')) {
    currentActive = 'security';
  } else if (location.pathname.includes('/manage-students')) {
    currentActive = 'manage-students';
  } else if (feature === 'iqac') {
    currentActive = 'approvals';
  }

  const handleNavClick = (view, path) => {
    if (path) {
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      navigate(`/${rolePrefix}/${cleanPath}`);
    } else {
      navigate(`/${rolePrefix}/${view}`);
    }
  };

  // Helper for badges
  const getBadgeCount = (view) => {
    if (view === 'events') {
      const hasOrgEvents = (events || []).some(e => (String(e.organizerId) === String(currentUser.id) || e.organizerEmail === currentUser.email));
      if (currentUser.role === UserRole.FACULTY || currentUser.role === UserRole.STUDENT_ORGANIZER || hasOrgEvents) {
         return (events || []).filter(e => (String(e.organizerId) === String(currentUser.id) || e.organizerEmail === currentUser.email)).length;
      }
      return 0;
    }
    if (view === 'approvals') {
       if (currentUser.role === UserRole.FACULTY) {
          return (events || []).filter(e => e.status === 'PENDING_FACULTY').length;
       }
       if (currentUser.role === UserRole.HOD) {
          return (events || []).filter(e => e.status === 'PENDING_HOD').length;
       }
       if (currentUser.role === UserRole.IQAC_TEAM) {
          return (events || []).filter(e => e.status === 'PENDING_IQAC').length;
       }
       // For department roles, calculating the exact badge count requires looking inside departmentApprovals.
       // We'll return 0 for now to avoid the placeholder 21.
       return 0;
    }
    if (view === 'registrations') {
       return 400; // Placeholder from screenshot
    }
    return 0;
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' }
  ];

  const excludedRoles = [
    UserRole.HOD, UserRole.HR_TEAM, UserRole.MEDIA, 
    UserRole.AUDIO_TEAM, UserRole.BOYS_WARDEN, UserRole.GIRLS_WARDEN, 
    UserRole.SYSTEM_ADMIN, UserRole.IQAC_TEAM
  ];

  const hasOrganizedEvents = (events || []).some(e => (String(e.organizerId) === String(currentUser.id) || e.organizerEmail === currentUser.email));
  const canSeeMyEvents = !excludedRoles.includes(currentUser.role) && 
    (currentUser.role === UserRole.FACULTY || currentUser.role === UserRole.STUDENT_ORGANIZER || hasOrganizedEvents);

  if (canSeeMyEvents) {
    navItems.push({ id: 'events', label: 'My Events', icon: CalendarDays, path: '/events' });
  }
  
  if (currentUser.role === UserRole.STUDENT_GENERAL || currentUser.role === UserRole.STUDENT_ORGANIZER) {
    navItems.push({ id: 'available', label: 'Available Events', icon: Compass, path: '/available' });
    navItems.push({ id: 'my-registrations', label: 'My Registrations', icon: Ticket, path: '/my-registrations' });
  }

  const approvalRoles = [
    UserRole.FACULTY, UserRole.HOD, UserRole.IQAC_TEAM,
    UserRole.HR_TEAM, UserRole.AUDIO_TEAM, UserRole.SYSTEM_ADMIN,
    UserRole.TRANSPORT_TEAM, UserRole.BOYS_WARDEN, UserRole.GIRLS_WARDEN,
    UserRole.MEDIA
  ];
  if (approvalRoles.includes(currentUser.role)) {
    navItems.push({ id: 'approvals', label: 'Approvals', icon: CheckCircle2, badge: getBadgeCount('approvals'), path: '/approvals' });
  }

  if (canSeeMyEvents) {
    navItems.push({ id: 'registrations', label: 'Manage Registrations', icon: ClipboardList, path: '/registrations' });
  }

  if ([UserRole.FACULTY, UserRole.HOD, UserRole.IQAC_TEAM].includes(currentUser.role)) {
    navItems.push({ id: 'manage-students', label: 'User Management', icon: UserCog, path: '/manage-students' });
  }

  navItems.push({ id: 'security', label: 'Security', icon: Shield, path: '/security' });

  const liveStudent = (students || []).find(s => s.id === currentUser.id);
  const displayData = liveStudent || currentUser;

  return (
    <aside className="w-72 h-full bg-white border-r border-slate-100 flex flex-col shrink-0">
      {/* Header */}
      <div className="p-6 pb-8 border-b border-slate-50/50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/${rolePrefix}/dashboard`)}>
          <img
            src={seceLogo}
            alt="SECE Logo"
            className="w-10 h-10 rounded-lg object-contain border border-slate-100 p-0.5 shadow-sm"
          />
          <div>
            <h1 className="font-extrabold text-[15px] leading-tight text-slate-900 tracking-tight">SECE EVENT HUB</h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Institution Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200">
        {navItems.map((item) => {
          const isActive = currentActive === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id, item.path)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 font-semibold text-[15px] ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <item.icon size={20} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} strokeWidth={isActive ? 2.5 : 2} />
                <span className="whitespace-nowrap truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-blue-500/30 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* User Profile Footer */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 mb-3 border border-slate-100">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
            {displayData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-slate-900 truncate">{displayData.name}</p>
            <p className="text-[11px] text-slate-500 font-medium truncate capitalize">
              {(displayData.role || 'GUEST').replace('_', ' ').toLowerCase()}
            </p>
          </div>
        </div>
        
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors text-[14px]"
        >
          <LogOut size={18} className="text-slate-500" />
          Log Out
        </button>
      </div>
    </aside>
  );
};

export default Navbar;
