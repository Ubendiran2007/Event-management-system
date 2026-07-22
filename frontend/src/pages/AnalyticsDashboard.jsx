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
  BarChart2, BookOpen, GraduationCap, FileCheck, Filter, ArrowLeft
} from 'lucide-react';
import { UserRole } from '../types';

const FilterBar = ({ filters, setFilters, role }) => {
  const handleChange = (e) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  
  return (
    <div className="flex flex-wrap items-center gap-1 justify-end">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Filter size={14} className="text-indigo-500" />
        <select name="academicYear" value={filters.academicYear} onChange={handleChange} className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none cursor-pointer hover:text-indigo-600 transition-colors">
          <option value="">All Academic Years</option>
          <option value="2023-2024">2023-2024</option>
          <option value="2024-2025">2024-2025</option>
        </select>
      </div>
      
      {['IQAC_TEAM', 'PRINCIPAL', 'SYSTEM_ADMIN'].includes(role) && (
        <div className="flex items-center gap-2 px-3 py-1.5">
          <select name="department" value={filters.department} onChange={handleChange} className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none cursor-pointer hover:text-indigo-600 transition-colors">
            <option value="">All Departments</option>
            <option value="CSE">CSE</option>
            <option value="IT">IT</option>
            <option value="ECE">ECE</option>
            <option value="EEE">EEE</option>
            <option value="MECH">MECH</option>
          </select>
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-1.5">
        <select name="category" value={filters.category} onChange={handleChange} className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none cursor-pointer hover:text-indigo-600 transition-colors">
          <option value="">All Categories</option>
          <option value="Symposium">Symposium</option>
          <option value="Workshop">Workshop</option>
          <option value="Guest Lecture">Guest Lecture</option>
          <option value="Seminar">Seminar</option>
          <option value="Hackathon">Hackathon</option>
        </select>
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5">
        <select name="status" value={filters.status} onChange={handleChange} className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none cursor-pointer hover:text-indigo-600 transition-colors">
          <option value="">All Statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      <button 
        onClick={() => setFilters({ academicYear: '', department: '', category: '', status: '' })}
        className="text-xs text-slate-500 hover:text-red-600 font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
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
