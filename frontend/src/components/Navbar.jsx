import { LogOut, LayoutDashboard, Calendar, CalendarDays, Compass, Ticket, CheckCircle2, FileEdit, ClipboardList, Users, UserCog, Shield, X, Activity, GraduationCap, BarChart2, Building2, Bell } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useWorkflowEvents } from '../context/WorkflowEventsContext';
import seceLogo from '../assets/sece logo.jpeg';
import { UserRole } from '../types';
import { getRolePath } from '../utils/routeUtils';
import { useNotifications } from '../hooks/useNotifications';

const Navbar = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const { currentUser, handleLogout, students, staffUsers } = useAppContext();
  const { events } = useWorkflowEvents();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const isLoginPage = location.pathname === '/' || location.pathname === '/login';
  if (isLoginPage || !currentUser) return null;

  const onLogout = () => {
    handleLogout();
    navigate('/');
  };

  const rolePrefix = getRolePath(currentUser.role);

  // Derive active tab from URL — match on any segment, not just the last
  let currentActive = 'dashboard';
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const knownFeatures = ['dashboard', 'events', 'approvals', 'registrations', 'modifications', 'available', 'my-registrations', 'tracking', 'academic-calendar', 'analytics', 'venue-management', 'notifications', 'manage-students', 'security'];
  for (const seg of pathSegments) {
    if (knownFeatures.includes(seg)) { currentActive = seg; break; }
    if (seg === 'iqac') { currentActive = 'approvals'; break; }
  }
  // Also match by pathname contains for multi-segment paths
  if (location.pathname.includes('/security')) currentActive = 'security';
  if (location.pathname.includes('/manage-students')) currentActive = 'manage-students';
  if (location.pathname.includes('/venue-management')) currentActive = 'venue-management';

  const handleNavClick = (view, path) => {
    if (setIsMobileMenuOpen) setIsMobileMenuOpen(false);
    const target = path || `/${view}`;
    // Strip leading slash then rebuild cleanly
    const cleanPath = target.replace(/^\/+/, '');
    navigate(`/${rolePrefix}/${cleanPath}`);
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
    navItems.push({ id: 'my-schedule', label: 'My Schedule', icon: Calendar, path: '/my-schedule' });
  }

  const approvalRoles = [
    UserRole.FACULTY, UserRole.HOD, UserRole.IQAC_TEAM,
    UserRole.HR_TEAM, UserRole.AUDIO_TEAM, UserRole.SYSTEM_ADMIN,
    UserRole.TRANSPORT_TEAM, UserRole.BOYS_WARDEN, UserRole.GIRLS_WARDEN,
    UserRole.MEDIA
  ];
  if (approvalRoles.includes(currentUser.role)) {
    navItems.push({ id: 'approvals', label: 'Approvals', icon: CheckCircle2, path: '/approvals' });
  }

  if (canSeeMyEvents) {
    navItems.push({ id: 'registrations', label: 'Manage Registrations', icon: ClipboardList, path: '/registrations' });
  }

  if (currentUser.role === UserRole.FACULTY && currentUser.assignedClasses && currentUser.assignedClasses.length > 0) {
    navItems.push({ id: 'tracking', label: 'Event Tracking', icon: Activity, path: '/tracking' });
  }

  const isClassAdvisor = currentUser.role === UserRole.FACULTY && currentUser.assignedClasses && currentUser.assignedClasses.length > 0;
  
  if (currentUser.role === UserRole.HOD || currentUser.role === UserRole.IQAC_TEAM || isClassAdvisor) {
    const isHODorIQAC = currentUser.role === UserRole.HOD || currentUser.role === UserRole.IQAC_TEAM;
    navItems.push({ 
      id: 'manage-students', 
      label: isHODorIQAC ? 'User Management' : 'Manage Students', 
      icon: UserCog, 
      path: '/manage-students' 
    });
  }
  

  navItems.push({ id: 'academic-calendar', label: 'Academic Calendar', icon: CalendarDays, path: '/academic-calendar' });
  navItems.push({ id: 'notifications', label: 'Notifications', icon: Bell, path: '/notifications', unreadCount });

  const noAnalyticsRoles = [
    UserRole.STUDENT_GENERAL, 
    UserRole.STUDENT_ORGANIZER, 
    UserRole.FACULTY,
    UserRole.HR_TEAM, 
    UserRole.BOYS_WARDEN, 
    UserRole.GIRLS_WARDEN, 
    UserRole.TRANSPORT_TEAM, 
    UserRole.AUDIO_TEAM, 
    UserRole.MEDIA
  ];

  if (!noAnalyticsRoles.includes(currentUser.role)) {
    navItems.push({ id: 'analytics', label: 'Analytics', icon: BarChart2, path: '/analytics' });
  }

  if (currentUser.role === UserRole.HR_TEAM || currentUser.role === UserRole.SUPER_ADMIN) {
    navItems.push({ id: 'venue-management', label: 'Venue Management', icon: Building2, path: '/venue-management' });
  }

  navItems.push({ id: 'security', label: 'Security', icon: Shield, path: '/security' });


  const liveStudent = (students || []).find(s => s.id === currentUser.id);
  const displayData = liveStudent || currentUser;

  let classAdvisorName = null;
  if ((currentUser.role === UserRole.STUDENT_GENERAL || currentUser.role === UserRole.STUDENT_ORGANIZER) && displayData.class) {
    const targetClass = (displayData.class || '').replace(/-/g, ' ').toUpperCase();
    const advisor = (staffUsers || []).find(u => {
      if (u.role !== UserRole.FACULTY || !u.assignedClasses) return false;
      return u.assignedClasses.some(c => (c || '').replace(/-/g, ' ').toUpperCase() === targetClass);
    });
    if (advisor) {
      classAdvisorName = advisor.name;
    }
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`w-72 h-full bg-[#1e3a5f] border-r border-[#1e3a5f] flex flex-col shrink-0 fixed inset-y-0 left-0 z-50 md:relative md:translate-x-0 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Header */}
        <div className="p-5 pb-5 border-b border-[#162d4a] flex justify-between items-start">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavClick('dashboard')}>
            <img
              src={seceLogo}
              alt="SECE Logo"
              className="w-10 h-10 rounded-lg object-contain border border-blue-400 p-0.5 shadow-sm"
            />
            <div>
              <h1 className="font-extrabold text-[15px] leading-tight text-white tracking-tight">SECE EVENT HUB</h1>
              <p className="text-[10px] text-blue-100 font-bold tracking-wider uppercase">Institution Portal</p>
            </div>
          </div>
          {isMobileMenuOpen && (
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-blue-100 hover:text-white">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 scrollbar-thin scrollbar-thumb-[#162d4a]">
          {navItems.map((item) => {
            const isActive = currentActive === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id, item.path)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 font-semibold text-[14px] ${
                  isActive
                    ? 'bg-white/20 text-white shadow-md font-bold'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <item.icon size={18} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="whitespace-nowrap truncate">{item.label}</span>
                </div>
                {item.unreadCount > 0 && (
                  <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white">
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-[#162d4a]">
          <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-[#162d4a] mb-2 border border-[#0f2035] shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                {(displayData.name || 'User').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold text-white truncate">{displayData.name}</p>
                <p className="text-[10px] text-slate-400 font-medium truncate capitalize">
                  {(displayData.role || 'GUEST').replace('_', ' ').toLowerCase()}
                </p>
              </div>
            </div>
            
            {classAdvisorName && (
              <div className="pt-1.5 mt-1 border-t border-[#0f2035]">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Class Advisor</p>
                <p className="text-[11px] font-semibold text-white truncate">{classAdvisorName}</p>
              </div>
            )}
            
            {isClassAdvisor && currentUser.assignedClasses && (
              <div className="pt-1.5 mt-1 border-t border-[#0f2035]">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Assigned Class</p>
                <p className="text-[11px] font-semibold text-white truncate">{currentUser.assignedClasses.join(', ')}</p>
              </div>
            )}
          </div>
          
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-white/20 bg-white/10 text-white font-bold hover:bg-red-500 hover:border-red-400 transition-colors text-[13px]"
          >
            <LogOut size={16} className="text-white" />
            Log Out
          </button>
        </div>
      </aside>
    </>
  );
};

export default Navbar;
