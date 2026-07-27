import React, { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getRolePath } from '../utils/routeUtils';
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
  BarChart2, BookOpen, GraduationCap, FileCheck, Filter, ArrowLeft, SlidersHorizontal,
  RefreshCw, Building2, TrendingUp, Activity, ShieldCheck, AlertTriangle, ClipboardCheck, ChevronRight
} from 'lucide-react';
import { UserRole } from '../types';
import { motion } from 'framer-motion';

const departmentLabel = (department) => ({
  CSE: 'Computer Science and Engineering',
  IT: 'Information Technology',
  ECE: 'Electronics and Communication Engineering',
  EEE: 'Electrical and Electronics Engineering',
  MECH: 'Mechanical Engineering'
}[department] || department || 'Department');

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


const EnterpriseKpi = ({ title, value, icon: Icon, tone = 'blue', caption = 'Selected reporting period' }) => {
  const tones = { blue: 'from-blue-600 to-indigo-600 bg-blue-50 text-blue-600', green: 'from-emerald-500 to-teal-600 bg-emerald-50 text-emerald-600', amber: 'from-amber-500 to-orange-500 bg-amber-50 text-amber-600', rose: 'from-rose-500 to-red-600 bg-rose-50 text-rose-600', violet: 'from-violet-500 to-purple-600 bg-violet-50 text-violet-600' };
  const [gradient, iconBg, iconColor] = tones[tone].split(' ');
  return <motion.div whileHover={{ y: -3 }} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${gradient}`} /><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p><p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p></div><span className={`rounded-xl p-3 ${iconBg} ${iconColor}`}><Icon size={20} /></span></div><p className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-500"><TrendingUp size={13} className="text-emerald-500" /> {caption}</p></motion.div>;
};

const SectionHeading = ({ icon: Icon, title, description }) => <div className="mb-4 flex items-start gap-3"><span className="rounded-xl bg-slate-100 p-2.5 text-slate-700"><Icon size={19} /></span><div><h2 className="font-extrabold text-slate-900">{title}</h2><p className="mt-0.5 text-sm text-slate-500">{description}</p></div></div>;

const ExecutiveDashboard = ({ metrics, filteredEvents, currentUser, filters, odRequests = [] }) => {
  const intelligence = useMemo(() => {
    const events = filteredEvents || [];
    const groups = events.reduce((result, event) => { const key = event.department || 'Unassigned'; (result[key] ||= []).push(event); return result; }, {});
    const departments = Object.entries(groups).map(([department, rows]) => {
      const ids = new Set(rows.map((event) => event.id));
      const requests = odRequests.filter((request) => ids.has(request.eventId));
      const attended = requests.filter((request) => request.attendanceStatus && request.attendanceStatus !== 'NOT_ATTENDED').length;
      const feedback = requests.filter((request) => request.feedback).length;
      const approved = rows.filter((event) => ['APPROVED', 'COMPLETED', 'POSTED'].includes(event.status)).length;
      return { department, events: rows.length, participants: requests.length, attendance: requests.length ? Math.round((attended / requests.length) * 100) : 0, feedback: requests.length ? Math.round((feedback / requests.length) * 100) : 0, approval: Math.round((approved / rows.length) * 100) };
    }).sort((a, b) => b.events - a.events);
    const approvalRate = events.length ? Math.round(((metrics.kpis.approvedEvents + metrics.kpis.completedEvents) / events.length) * 100) : 0;
    const documentation = events.filter((event) => event.postEventReport || event.reportUrl || event.completionReport).length;
    const statusData = Object.entries(events.reduce((result, event) => { const key = event.status || 'DRAFT'; result[key] = (result[key] || 0) + 1; return result; }, {})).map(([name, count]) => ({ name, count }));
    return { departments, approvalRate, documentation, statusData, recent: [...events].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)).slice(0, 5) };
  }, [metrics, filteredEvents, odRequests]);

  const kpis = [
    ['Total Events', metrics.kpis.totalEvents, Calendar, 'blue'], ['Approved Events', metrics.kpis.approvedEvents, CheckCircle, 'green'], ['Pending Events', metrics.kpis.pendingEvents, Clock, 'amber'], ['Completed Events', metrics.kpis.completedEvents, ClipboardCheck, 'violet'],
    ['Total Students', metrics.kpis.totalStudents, Users, 'blue'], ['Total Faculty', metrics.kpis.totalFaculty, GraduationCap, 'violet'], ['Average Attendance', metrics.kpis.avgAttendance, Activity, 'green'], ['Average Feedback', `${metrics.kpis.avgFeedback} / 5`, BarChart2, 'amber']
  ];

  return <div className="space-y-7">
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Approval rate</p><p className="mt-1 text-3xl font-extrabold text-slate-900">{intelligence.approvalRate}%</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Attendance</p><p className="mt-1 text-3xl font-extrabold text-slate-900">{metrics.kpis.avgAttendance}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Top department</p><p className="mt-1 truncate text-3xl font-extrabold text-slate-900">{intelligence.departments[0]?.department || '-'}</p></div></div></section>
    <section><SectionHeading icon={Activity} title="Executive indicators" description="Key institutional measures for the selected reporting filters." /><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(([title, value, icon, tone]) => <EnterpriseKpi key={title} title={title} value={value} icon={icon} tone={tone} />)}</div></section>
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3"><div className="xl:col-span-2"><EventTrendChart events={filteredEvents} /></div><CategoryPieChart data={intelligence.statusData} title="Event Status Distribution" /></section>
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3"><div className="xl:col-span-2"><ApprovalPipelineChart events={filteredEvents} /></div><CategoryPieChart data={metrics.charts.categoryEvents} title="Event Category Distribution" /></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><SectionHeading icon={Building2} title="Department performance" description="Activity, participation, attendance, feedback and governance comparison." /><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Department</th><th className="px-4 py-3">Events</th><th className="px-4 py-3">Participants</th><th className="px-4 py-3">Attendance</th><th className="px-4 py-3">Feedback</th><th className="px-4 py-3">Approval</th></tr></thead><tbody className="divide-y divide-slate-100">{intelligence.departments.map((row) => <tr key={row.department} className="transition hover:bg-slate-50"><td className="px-4 py-3 font-bold text-slate-800">{row.department}</td><td className="px-4 py-3">{row.events}</td><td className="px-4 py-3">{row.participants}</td><td className="px-4 py-3 text-emerald-600">{row.attendance}%</td><td className="px-4 py-3">{row.feedback}%</td><td className="px-4 py-3"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{row.approval}%</span></td></tr>)}{!intelligence.departments.length && <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">No department data matches the selected filters.</td></tr>}</tbody></table></div></section>
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><SectionHeading icon={ShieldCheck} title="Accreditation readiness" description="Operational evidence available for IQAC review." />{[['Event documentation', intelligence.documentation, metrics.kpis.totalEvents], ['Attendance completion', odRequests.filter((request) => request.attendanceStatus && request.attendanceStatus !== 'NOT_ATTENDED').length, odRequests.length], ['Feedback completion', odRequests.filter((request) => request.feedback).length, odRequests.length], ['Post-event completion', metrics.kpis.completedEvents, metrics.kpis.totalEvents]].map(([label, completed, total]) => { const value = total ? Math.round((completed / total) * 100) : 0; return <div key={label} className="mb-5 last:mb-0"><div className="mb-2 flex justify-between text-sm"><span className="font-semibold text-slate-700">{label}</span><span className="font-bold">{value}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600" style={{ width: `${value}%` }} /></div></div>; })}</div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><SectionHeading icon={AlertTriangle} title="Smart insights" description="Automated signals for management attention." /><div className="space-y-3"><div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><strong>Highest activity:</strong> {intelligence.departments[0]?.department || 'No department'} leads with {intelligence.departments[0]?.events || 0} events.</div><div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800"><strong>Institutional governance:</strong> approval rate is currently {intelligence.approvalRate}%.</div><div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><strong>Documentation:</strong> {metrics.kpis.totalEvents - intelligence.documentation} event records may still need post-event evidence.</div></div></div></section>
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3"><div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><SectionHeading icon={Clock} title="Recent activity" description="Latest event workflow records in the selected data set." /><div className="space-y-3">{intelligence.recent.map((event) => <div key={event.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{event.title || event.eventName || 'Untitled event'}</p><p className="text-xs text-slate-500">{event.department || 'Institution'} - {event.status || 'Draft'}</p></div><ChevronRight size={16} className="text-slate-400" /></div>)}{!intelligence.recent.length && <p className="py-8 text-center text-sm text-slate-500">No recent activities found.</p>}</div></div><ExportPanel reportName="Institution_Report" data={[metrics.kpis]} currentUser={currentUser} filters={filters} /></section>
  </div>;
};

const DepartmentDashboard = ({ metrics, filteredEvents, department, currentUser, filters, odRequests = [], staffUsers = [] }) => {
  const intelligence = useMemo(() => {
    const events = filteredEvents.filter((event) => event.department === department);
    const eventIds = new Set(events.map((event) => event.id));
    const requests = odRequests.filter((request) => eventIds.has(request.eventId));
    const attended = requests.filter((request) => request.attendanceStatus && request.attendanceStatus !== 'NOT_ATTENDED').length;
    const feedbackCount = requests.filter((request) => request.feedback).length;
    const faculty = Object.values(events.reduce((all, event) => {
      const key = event.organizerEmail || event.organizerName || event.facultyCoordinator || 'Not assigned';
      all[key] ||= { name: event.organizerName || event.facultyCoordinator || event.organizerEmail || 'Not assigned', events: 0, pending: 0, approved: 0, completed: 0, ids: new Set() };
      all[key].events += 1; all[key].pending += String(event.status || '').startsWith('PENDING') ? 1 : 0; all[key].approved += ['APPROVED', 'POSTED', 'COMPLETED'].includes(event.status) ? 1 : 0; all[key].completed += event.status === 'COMPLETED' ? 1 : 0; all[key].ids.add(event.id); return all;
    }, {})).map((row) => {
      const related = requests.filter((request) => row.ids.has(request.eventId));
      const attended = related.filter((request) => request.attendanceStatus && request.attendanceStatus !== 'NOT_ATTENDED').length;
      const feedback = related.filter((request) => request.feedback).length;
      return { ...row, participants: related.length, attendance: related.length ? Math.round((attended / related.length) * 100) : 0, feedback: related.length ? Math.round((feedback / related.length) * 100) : 0 };
    }).sort((a, b) => b.events - a.events);
    const pending = events.filter((event) => String(event.status || '').startsWith('PENDING')).length;
    const active = events.filter((event) => ['APPROVED', 'POSTED', 'ONGOING'].includes(event.status)).length;
    const rejected = events.filter((event) => event.status === 'REJECTED').length;
    const approvalRate = events.length ? Math.round((events.filter((event) => ['APPROVED', 'POSTED', 'COMPLETED'].includes(event.status)).length / events.length) * 100) : 0;
    const completionRate = events.length ? Math.round((events.filter((event) => event.status === 'COMPLETED').length / events.length) * 100) : 0;
    const categoryData = Object.entries(events.reduce((all, event) => { const key = event.eventType || event.category || 'Other'; all[key] = (all[key] || 0) + 1; return all; }, {})).map(([name, count]) => ({ name, count }));
    const categoryRows = categoryData.map((category) => {
      const categoryEvents = events.filter((event) => (event.eventType || event.category || 'Other') === category.name);
      const ids = new Set(categoryEvents.map((event) => event.id));
      const categoryRequests = requests.filter((request) => ids.has(request.eventId));
      const categoryAttendance = categoryRequests.filter((request) => request.attendanceStatus && request.attendanceStatus !== 'NOT_ATTENDED').length;
      return { ...category, participants: categoryRequests.length, attendance: categoryRequests.length ? Math.round((categoryAttendance / categoryRequests.length) * 100) : 0 };
    });
    const feedbackRatings = requests.map((request) => request.feedback).filter(Boolean).map((feedback) => ['q1', 'q2', 'q3', 'q4', 'q5'].reduce((sum, key) => sum + Number(feedback[key] || 0), 0) / 5).filter(Boolean);
    const highParticipation = [...events].sort((a, b) => (b.registrationCount || b.participants || 0) - (a.registrationCount || a.participants || 0))[0];
    const departmentFaculty = staffUsers.filter((staff) => staff.department === department && ['FACULTY', 'HOD'].includes(staff.role));
    const eventPerformance = events.map((event) => {
      const eventRequests = requests.filter((request) => request.eventId === event.id);
      const eventAttendance = eventRequests.filter((request) => request.attendanceStatus && request.attendanceStatus !== 'NOT_ATTENDED').length;
      const eventFeedback = eventRequests.filter((request) => request.feedback).length;
      return { ...event, registrations: eventRequests.length || event.registrationCount || event.participants || 0, attendance: eventRequests.length ? Math.round((eventAttendance / eventRequests.length) * 100) : 0, feedback: eventRequests.length ? Math.round((eventFeedback / eventRequests.length) * 100) : 0 };
    }).sort((a, b) => new Date(b.startDate || b.date || 0) - new Date(a.startDate || a.date || 0));
    return { events, faculty, pending, active, rejected, approvalRate, completionRate, categoryData, categoryRows, highParticipation, eventPerformance, registrations: requests.length, attended, feedbackCount, feedbackAverage: feedbackRatings.length ? (feedbackRatings.reduce((sum, rating) => sum + rating, 0) / feedbackRatings.length).toFixed(1) : '—', attendanceRate: requests.length ? Math.round((attended / requests.length) * 100) : 0, departmentFaculty };
  }, [filteredEvents, department, odRequests, staffUsers]);

  const kpis = [
    ['Total Events', metrics.kpis.totalEvents, Calendar, 'blue'], ['Active Events', intelligence.active, Activity, 'green'], ['Pending Approval', intelligence.pending, Clock, 'amber'], ['Completed Events', metrics.kpis.completedEvents, ClipboardCheck, 'violet'],
    ['Student Registrations', intelligence.registrations, Users, 'blue'], ['Participation Rate', `${intelligence.attendanceRate}%`, TrendingUp, 'green'], ['Average Attendance', `${intelligence.attendanceRate}%`, Activity, 'green'], ['Average Feedback', intelligence.feedbackAverage === '—' ? '—' : `${intelligence.feedbackAverage} / 5`, BarChart2, 'violet'], ['Approval Success', `${intelligence.approvalRate}%`, CheckCircle, 'violet'], ['Requires Action', intelligence.pending + intelligence.rejected, AlertTriangle, 'rose']
  ];

  return <div className="space-y-7">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Departmental Executive Summary</p><h2 className="mt-1 text-2xl font-extrabold text-slate-900">{departmentLabel(department)} decision-support overview</h2><p className="mt-1 text-sm text-slate-500">Governance, faculty activity and student engagement for the selected reporting filters.</p></div><div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5"><div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs font-bold text-slate-500">Completion rate</p><p className="mt-1 text-2xl font-extrabold">{intelligence.completionRate}%</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs font-bold text-slate-500">Approval rate</p><p className="mt-1 text-2xl font-extrabold">{intelligence.approvalRate}%</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs font-bold text-slate-500">Active faculty</p><p className="mt-1 text-2xl font-extrabold">{intelligence.faculty.length}{intelligence.departmentFaculty.length ? ` / ${intelligence.departmentFaculty.length}` : ''}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs font-bold text-slate-500">Participation</p><p className="mt-1 text-2xl font-extrabold">{intelligence.attendanceRate}%</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs font-bold text-slate-500">Avg. feedback</p><p className="mt-1 text-2xl font-extrabold">{intelligence.feedbackAverage === '—' ? '—' : `${intelligence.feedbackAverage} / 5`}</p></div></div></section>
    <section><SectionHeading icon={Activity} title="Department KPI scorecard" description="Core event governance and student engagement measures." /><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(([title, value, icon, tone]) => <EnterpriseKpi key={title} title={title} value={value} icon={icon} tone={tone} />)}</div></section>
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3"><div className="xl:col-span-2"><EventTrendChart events={intelligence.events} /></div><CategoryPieChart data={intelligence.categoryData} title="Event Category Distribution" /></section>
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3"><div className="xl:col-span-2"><ApprovalPipelineChart events={intelligence.events} /></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><SectionHeading icon={AlertTriangle} title="Approval analytics" description="Workflow focus areas for HOD review." /><div className="space-y-4"><div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><strong>{intelligence.pending}</strong> event(s) are currently awaiting approval.</div><div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><strong>{intelligence.approvalRate}%</strong> approval success rate in this department.</div><div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">Keep post-event evidence current for completed events.</div></div></div></section>
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><SectionHeading icon={GraduationCap} title="Student engagement" description="Participation evidence from registrations, attendance and feedback." /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Registrations</p><p className="mt-1 text-xl font-extrabold">{intelligence.registrations}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Participants</p><p className="mt-1 text-xl font-extrabold">{intelligence.attended}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Attendance rate</p><p className="mt-1 text-xl font-extrabold">{intelligence.attendanceRate}%</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Feedback completion</p><p className="mt-1 text-xl font-extrabold">{intelligence.registrations ? Math.round((intelligence.feedbackCount / intelligence.registrations) * 100) : 0}%</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Average feedback</p><p className="mt-1 text-xl font-extrabold">{intelligence.feedbackAverage === '—' ? '—' : `${intelligence.feedbackAverage} / 5`}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Certificates</p><p className="mt-1 text-xl font-extrabold">—</p></div></div></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><SectionHeading icon={BarChart2} title="Category analysis" description="Event mix, participation and average attendance by category." /><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">Category</th><th className="px-3 py-3">Events</th><th className="px-3 py-3">Participants</th><th className="px-3 py-3">Attendance</th></tr></thead><tbody className="divide-y divide-slate-100">{intelligence.categoryRows.map((row) => <tr key={row.name}><td className="px-3 py-3 font-semibold text-slate-800">{row.name}</td><td className="px-3 py-3">{row.count}</td><td className="px-3 py-3">{row.participants}</td><td className="px-3 py-3 text-emerald-700">{row.attendance}%</td></tr>)}{!intelligence.categoryRows.length && <tr><td colSpan="4" className="px-3 py-8 text-center text-slate-500">No category data matches the current filters.</td></tr>}</tbody></table></div></div></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><SectionHeading icon={Users} title="Organizer performance" description="Event organizer contribution and workflow workload from current departmental records." /><div className="overflow-x-auto"><table className="min-w-[800px] w-full text-left text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Organizer</th><th className="px-4 py-3">Events</th><th className="px-4 py-3">Pending</th><th className="px-4 py-3">Approved</th><th className="px-4 py-3">Completed</th><th className="px-4 py-3">Participation</th><th className="px-4 py-3">Attendance</th><th className="px-4 py-3">Approval time</th></tr></thead><tbody className="divide-y divide-slate-100">{intelligence.faculty.map((row) => <tr key={row.name} className="hover:bg-slate-50"><td className="px-4 py-3 font-bold text-slate-800">{row.name}</td><td className="px-4 py-3">{row.events}</td><td className="px-4 py-3 text-amber-700">{row.pending}</td><td className="px-4 py-3">{row.approved}</td><td className="px-4 py-3">{row.completed}</td><td className="px-4 py-3">{row.participants}</td><td className="px-4 py-3 text-emerald-600">{row.attendance}%</td><td className="px-4 py-3 text-slate-500">Not available</td></tr>)}{!intelligence.faculty.length && <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-500">No organizer event records are available.</td></tr>}</tbody></table></div></section>
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3"><div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><SectionHeading icon={Calendar} title="Event performance" description="Recent department events with engagement and workflow indicators." /><div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">Event</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Registrations</th><th className="px-3 py-3">Attendance</th><th className="px-3 py-3">Feedback</th><th className="px-3 py-3">Approval stage</th></tr></thead><tbody className="divide-y divide-slate-100">{intelligence.eventPerformance.slice(0, 8).map((event) => <tr key={event.id} className="hover:bg-slate-50"><td className="px-3 py-3 font-semibold text-slate-800">{event.title || event.eventName || 'Untitled event'}</td><td className="px-3 py-3">{event.eventType || event.category || '-'}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{event.status || '-'}</span></td><td className="px-3 py-3">{event.registrations}</td><td className={`px-3 py-3 font-semibold ${event.attendance < 60 && event.registrations ? 'text-amber-700' : 'text-emerald-700'}`}>{event.attendance}%</td><td className={`px-3 py-3 font-semibold ${event.feedback < 60 && event.registrations ? 'text-amber-700' : 'text-slate-700'}`}>{event.feedback}%</td><td className="px-3 py-3">{String(event.status || '').startsWith('PENDING') ? String(event.status).replace('PENDING_', '') : event.status || '-'}</td></tr>)}{!intelligence.eventPerformance.length && <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">No event data matches the selected filters.</td></tr>}</tbody></table></div></div><div className="space-y-6"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><SectionHeading icon={TrendingUp} title="Department health" description="Signals to focus the next review." /><div className="space-y-3"><div className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800"><strong>Most active faculty:</strong> {intelligence.faculty[0]?.name || 'No record'}.</div><div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><strong>Highest participation:</strong> {intelligence.highParticipation?.title || intelligence.highParticipation?.eventName || 'No event data'}.</div><div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><strong>Needs attention:</strong> {intelligence.pending} approval(s) remain pending.</div></div></div><ExportPanel reportName={`Department_Report_${department}`} data={[metrics.kpis]} currentUser={currentUser} filters={filters} /></div></section>
  </div>;
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
  const { currentUser, staffUsers } = useAppContext();
  const { metrics, filters, setFilters, filteredEvents, odRequests } = useAnalyticsContext();

  if (!currentUser || !metrics) {
    return (
      <Layout>
        <div className="p-8">Loading analytics...</div>
      </Layout>
    );
  }

  const role = currentUser.role;

  if (role === UserRole.STUDENT_GENERAL || role === UserRole.STUDENT_ORGANIZER || role === UserRole.FACULTY) {
    const rolePrefix = getRolePath ? getRolePath(role) : 'student';
    return <Navigate to={`/${rolePrefix}/dashboard`} replace />;
  }

  let DashboardComponent = null;
  let title = "Analytics Dashboard";

  switch (role) {
    case UserRole.IQAC_TEAM:
    case UserRole.PRINCIPAL:
    case UserRole.SYSTEM_ADMIN:
      title = "Institutional Analytics";
      DashboardComponent = <ExecutiveDashboard metrics={metrics} filteredEvents={filteredEvents} currentUser={currentUser} filters={filters} odRequests={odRequests} />;
      break;
    case UserRole.HOD:
      title = `${departmentLabel(currentUser.department)} Analytics`;
      DashboardComponent = <DepartmentDashboard metrics={metrics} filteredEvents={filteredEvents} department={currentUser.department} currentUser={currentUser} filters={filters} odRequests={odRequests} staffUsers={staffUsers} />;
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
        <div className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6 z-30 shrink-0">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <FilterBar filters={filters} setFilters={setFilters} role={role} />
              <Link to="/" className="btn-secondary flex h-fit shrink-0 items-center gap-1 px-4 py-2 text-sm whitespace-nowrap">
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
