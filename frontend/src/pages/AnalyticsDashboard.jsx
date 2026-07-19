import React from 'react';
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
  BarChart2, BookOpen, GraduationCap, FileCheck
} from 'lucide-react';
import { UserRole } from '../types';

const ExecutiveDashboard = ({ metrics, events }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Events" value={metrics.kpis.totalEvents} icon={Calendar} color="blue" />
        <KPICard title="Approved Events" value={metrics.kpis.approvedEvents} icon={CheckCircle} color="green" />
        <KPICard title="Pending Events" value={metrics.kpis.pendingEvents} icon={Clock} color="orange" />
        <KPICard title="Total Students" value={metrics.kpis.totalStudents} icon={Users} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EventTrendChart events={events} />
        <CategoryPieChart data={metrics.charts.deptEvents} title="Department-wise Events" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ApprovalPipelineChart events={events} />
        <div className="space-y-4">
          <KPICard title="Avg Attendance" value={metrics.kpis.avgAttendance} icon={Users} color="blue" />
          <KPICard title="Avg Feedback Rating" value={`${metrics.kpis.avgFeedback} / 5.0`} icon={BarChart2} color="green" />
          <ExportPanel reportName="Institution_Report" data={metrics.kpis} />
        </div>
      </div>
    </div>
  );
};

const DepartmentDashboard = ({ metrics, events, department }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="Total Events" value={metrics.kpis.totalEvents} icon={Calendar} color="blue" />
        <KPICard title="Completed Events" value={metrics.kpis.completedEvents} icon={CheckCircle} color="green" />
        <KPICard title="Student Participation" value={metrics.kpis.studentParticipation} icon={Users} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EventTrendChart events={events.filter(e => e.department === department)} />
        <CategoryPieChart data={metrics.charts.categoryEvents} title="Event Categories" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard title="Avg Attendance" value={metrics.kpis.avgAttendance} icon={Users} color="blue" />
        <KPICard title="Avg Feedback" value={`${metrics.kpis.avgFeedback} / 5.0`} icon={BarChart2} color="green" />
      </div>
      <ExportPanel reportName={`Department_Report_${department}`} data={metrics.kpis} />
    </div>
  );
};

const ClassAdvisorDashboard = ({ metrics }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Students" value={metrics.kpis.totalStudents} icon={GraduationCap} color="blue" />
        <KPICard title="Event Registrations" value={metrics.kpis.eventRegistrations} icon={FileCheck} color="purple" />
        <KPICard title="Participation" value={metrics.kpis.eventParticipation} icon={CheckCircle} color="green" />
        <KPICard title="Attendance Rate" value={metrics.kpis.attendancePercentage} icon={BarChart2} color="orange" />
      </div>
      <ExportPanel reportName="Class_Advisor_Report" data={metrics.kpis} />
    </div>
  );
};

const OrganizerDashboard = ({ metrics }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Events Organized" value={metrics.kpis.eventsOrganized} icon={BookOpen} color="blue" />
        <KPICard title="Total Registrations" value={metrics.kpis.registrations} icon={Users} color="purple" />
        <KPICard title="Total Attendance" value={metrics.kpis.attendance} icon={CheckCircle} color="green" />
        <KPICard title="Avg Feedback" value={`${metrics.kpis.avgFeedback} / 5.0`} icon={BarChart2} color="orange" />
      </div>
      <ExportPanel reportName="Organizer_Report" data={metrics.kpis} />
    </div>
  );
};

const PersonalDashboard = ({ metrics }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Registered Events" value={metrics.kpis.registeredEvents} icon={FileCheck} color="blue" />
        <KPICard title="Attended Events" value={metrics.kpis.attendedEvents} icon={CheckCircle} color="green" />
        <KPICard title="Participation %" value={metrics.kpis.participationPercentage} icon={BarChart2} color="purple" />
        <KPICard title="Feedback Submitted" value={metrics.kpis.feedbackSubmitted} icon={BookOpen} color="orange" />
      </div>
      <ExportPanel reportName="Student_Personal_Report" data={metrics.kpis} />
    </div>
  );
};

const AnalyticsDashboard = () => {
  const { currentUser, events } = useAppContext();
  const { metrics } = useAnalyticsContext();

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
      DashboardComponent = <ExecutiveDashboard metrics={metrics} events={events} />;
      break;
    case UserRole.HOD:
      title = "Department Analytics";
      DashboardComponent = <DepartmentDashboard metrics={metrics} events={events} department={currentUser.department} />;
      break;
    case UserRole.CLASS_ADVISOR:
      title = "Class Analytics";
      DashboardComponent = <ClassAdvisorDashboard metrics={metrics} />;
      break;
    case UserRole.FACULTY:
      title = "Organizer Analytics";
      DashboardComponent = <OrganizerDashboard metrics={metrics} />;
      break;
    case UserRole.STUDENT:
      title = "Personal Analytics";
      DashboardComponent = <PersonalDashboard metrics={metrics} />;
      break;
    default:
      DashboardComponent = <div>No analytics available for this role.</div>;
  }

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-slate-500 mt-1">Real-time insights and reports based on operational data.</p>
        </div>
        {DashboardComponent}
      </div>
    </Layout>
  );
};

export default AnalyticsDashboard;
