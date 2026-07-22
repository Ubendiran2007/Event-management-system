import React from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAppContext } from '../context/AppContext';
import { useAnalyticsContext } from '../context/AnalyticsContext';
import KPICard from '../components/analytics/KPICard';
import EventTrendChart from '../components/analytics/EventTrendChart';
import CategoryPieChart from '../components/analytics/CategoryPieChart';
import ApprovalPipelineChart from '../components/analytics/ApprovalPipelineChart';
import ExportPanel from '../components/analytics/ExportPanel';
import { 
  Users, Calendar, CheckCircle, XCircle, Clock, 
  BarChart2, BookOpen, GraduationCap, FileCheck, Filter, ArrowLeft, SlidersHorizontal
} from 'lucide-react';
import { UserRole } from '../types';

const FilterBar = ({ filters, setFilters, role }) => {
  const [openDropdown, setOpenDropdown] = React.useState(null);

  const handleSelect = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    setOpenDropdown(null);
  };

  const getLabel = (value, options) => {
    const opt = options.find(o => o.value === value);
    return opt ? opt.label : '';
  };

  const academicOptions = [
    { value: '', label: 'All Academic Years' },
    { value: '2023-2024', label: '2023-2024' },
    { value: '2024-2025', label: '2024-2025' }
  ];

  const deptOptions = [
    { value: '', label: 'All Departments' },
    { value: 'CSE', label: 'CSE' },
    { value: 'IT', label: 'IT' },
    { value: 'ECE', label: 'ECE' },
    { value: 'EEE', label: 'EEE' },
    { value: 'MECH', label: 'MECH' }
  ];

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    { value: 'Symposium', label: 'Symposium' },
    { value: 'Workshop', label: 'Workshop' },
    { value: 'Guest Lecture', label: 'Guest Lecture' },
    { value: 'Seminar', label: 'Seminar' },
    { value: 'Hackathon', label: 'Hackathon' }
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' }
  ];

  const renderDropdown = (name, options, currentValue) => (
    <div className="relative">
      <button 
        onClick={() => setOpenDropdown(openDropdown === name ? null : name)}
        className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 rounded-2xl font-extrabold transition-all text-[13px]"
      >
        <SlidersHorizontal size={16} className="text-slate-600" />
        <span>{getLabel(currentValue, options)}</span>
      </button>
      
      {openDropdown === name && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
          <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200">
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSelect(name, opt.value)}
                className={`px-4 py-2.5 text-left text-[14px] font-bold transition-colors ${currentValue === opt.value ? 'bg-indigo-600 text-white' : 'text-slate-800 hover:bg-slate-50'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 justify-end z-20 relative">
      {renderDropdown('academicYear', academicOptions, filters.academicYear)}
      {['IQAC_TEAM', 'PRINCIPAL', 'SYSTEM_ADMIN'].includes(role) && renderDropdown('department', deptOptions, filters.department)}
      {renderDropdown('category', categoryOptions, filters.category)}
      {renderDropdown('status', statusOptions, filters.status)}
      <button 
        onClick={() => setFilters({ academicYear: '', department: '', category: '', status: '' })}
        className="text-[13px] text-slate-500 hover:text-red-600 font-bold px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
      >
        Clear All
      </button>
    </div>
  );
};


const ExecutiveDashboard = ({ metrics, filteredEvents, currentUser, filters }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Events" value={metrics.kpis.totalEvents} icon={Calendar} color="blue" />
        <KPICard title="Approved Events" value={metrics.kpis.approvedEvents} icon={CheckCircle} color="green" />
        <KPICard title="Pending Events" value={metrics.kpis.pendingEvents} icon={Clock} color="orange" />
        <KPICard title="Total Students" value={metrics.kpis.totalStudents} icon={Users} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EventTrendChart events={filteredEvents} />
        <CategoryPieChart data={metrics.charts.deptEvents} title="Department-wise Events" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ApprovalPipelineChart events={filteredEvents} />
        <div className="space-y-4">
          <KPICard title="Avg Attendance" value={metrics.kpis.avgAttendance} icon={Users} color="blue" />
          <KPICard title="Avg Feedback Rating" value={`${metrics.kpis.avgFeedback} / 5.0`} icon={BarChart2} color="green" />
          <ExportPanel reportName="Institution_Report" data={[metrics.kpis]} currentUser={currentUser} filters={filters} />
        </div>
      </div>
    </div>
  );
};

const DepartmentDashboard = ({ metrics, filteredEvents, department, currentUser, filters }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="Total Events" value={metrics.kpis.totalEvents} icon={Calendar} color="blue" />
        <KPICard title="Completed Events" value={metrics.kpis.completedEvents} icon={CheckCircle} color="green" />
        <KPICard title="Student Participation" value={metrics.kpis.studentParticipation} icon={Users} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EventTrendChart events={filteredEvents.filter(e => e.department === department)} />
        <CategoryPieChart data={metrics.charts.categoryEvents} title="Event Categories" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard title="Avg Attendance" value={metrics.kpis.avgAttendance} icon={Users} color="blue" />
        <KPICard title="Avg Feedback" value={`${metrics.kpis.avgFeedback} / 5.0`} icon={BarChart2} color="green" />
      </div>
      <ExportPanel reportName={`Department_Report_${department}`} data={[metrics.kpis]} currentUser={currentUser} filters={filters} />
    </div>
  );
};

const ClassAdvisorDashboard = ({ metrics, currentUser, filters }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Students" value={metrics.kpis.totalStudents} icon={GraduationCap} color="blue" />
        <KPICard title="Event Registrations" value={metrics.kpis.eventRegistrations} icon={FileCheck} color="purple" />
        <KPICard title="Participation" value={metrics.kpis.eventParticipation} icon={CheckCircle} color="green" />
        <KPICard title="Attendance Rate" value={metrics.kpis.attendancePercentage} icon={BarChart2} color="orange" />
      </div>
      <ExportPanel reportName="Class_Advisor_Report" data={[metrics.kpis]} currentUser={currentUser} filters={filters} />
    </div>
  );
};

const OrganizerDashboard = ({ metrics, currentUser, filters }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Events Organized" value={metrics.kpis.eventsOrganized} icon={BookOpen} color="blue" />
        <KPICard title="Total Registrations" value={metrics.kpis.registrations} icon={Users} color="purple" />
        <KPICard title="Total Attendance" value={metrics.kpis.attendance} icon={CheckCircle} color="green" />
        <KPICard title="Avg Feedback" value={`${metrics.kpis.avgFeedback} / 5.0`} icon={BarChart2} color="orange" />
      </div>
      <ExportPanel reportName="Organizer_Report" data={[metrics.kpis]} currentUser={currentUser} filters={filters} />
    </div>
  );
};

const PersonalDashboard = ({ metrics, currentUser, filters }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Registered Events" value={metrics.kpis.registeredEvents} icon={FileCheck} color="blue" />
        <KPICard title="Attended Events" value={metrics.kpis.attendedEvents} icon={CheckCircle} color="green" />
        <KPICard title="Participation %" value={metrics.kpis.participationPercentage} icon={BarChart2} color="purple" />
        <KPICard title="Feedback Submitted" value={metrics.kpis.feedbackSubmitted} icon={BookOpen} color="orange" />
      </div>
      <ExportPanel reportName="Student_Personal_Report" data={[metrics.kpis]} currentUser={currentUser} filters={filters} />
    </div>
  );
};

const AnalyticsDashboard = () => {
  const { currentUser } = useAppContext();
  const { metrics, filters, setFilters, filteredEvents } = useAnalyticsContext();

  if (!currentUser || !metrics) {
    return (
      <Layout>
        <div className="p-8">Loading analytics...</div>
      </Layout>
    );
  }

  const role = currentUser.role;

  let DashboardComponent = null;
  let title = "Analytics Dashboard";

  switch (role) {
    case UserRole.IQAC_TEAM:
    case UserRole.PRINCIPAL:
    case UserRole.SYSTEM_ADMIN:
      title = "Institutional Analytics";
      DashboardComponent = <ExecutiveDashboard metrics={metrics} filteredEvents={filteredEvents} currentUser={currentUser} filters={filters} />;
      break;
    case UserRole.HOD:
      title = "Department Analytics";
      DashboardComponent = <DepartmentDashboard metrics={metrics} filteredEvents={filteredEvents} department={currentUser.department} currentUser={currentUser} filters={filters} />;
      break;
    case UserRole.CLASS_ADVISOR:
      title = "Class Analytics";
      DashboardComponent = <ClassAdvisorDashboard metrics={metrics} currentUser={currentUser} filters={filters} />;
      break;
    case UserRole.FACULTY:
      title = "Organizer Analytics";
      DashboardComponent = <OrganizerDashboard metrics={metrics} currentUser={currentUser} filters={filters} />;
      break;
    case UserRole.STUDENT:
      title = "Personal Analytics";
      DashboardComponent = <PersonalDashboard metrics={metrics} currentUser={currentUser} filters={filters} />;
      break;
    default:
      DashboardComponent = <div>No analytics available for this role.</div>;
  }

  return (
    <Layout>
      <div className="flex-1 flex flex-col min-h-0 relative">
        <div className="bg-[#f8fafc] border-b border-slate-200 px-6 py-4 z-30 shrink-0">
          <div className="max-w-6xl mx-auto w-full flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                  {title}
                </h1>
                <p className="text-slate-500 mt-1">Real-time insights and reports based on operational data.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <FilterBar filters={filters} setFilters={setFilters} role={role} />
              <Link to="/" className="btn-secondary flex items-center gap-1 shrink-0 px-3 py-1.5 h-fit text-sm whitespace-nowrap ml-2">
                  <ArrowLeft size={16} /> Back
              </Link>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-6xl mx-auto w-full">
            {DashboardComponent}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AnalyticsDashboard;
