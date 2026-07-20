import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Upload, Trash2, CheckCircle, Download, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAppContext } from '../context/AppContext';
import { useCalendarContext } from '../context/CalendarContext';
import * as XLSX from 'xlsx';

const AcademicCalendar = () => {
  const navigate = useNavigate();
  const { currentUser, events: allEvents } = useAppContext();
  const {
    academicYears, semesters, holidays, exams, workingDays, departmentCalendar, loading
  } = useCalendarContext();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar', 'manage_iqac', 'manage_hod'
  
  const isIQAC = currentUser?.role === 'IQAC_TEAM' || currentUser?.role === 'SYSTEM_ADMIN';
  const isHOD = currentUser?.role === 'HOD';

  // --- Date Math for Calendar ---
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDay = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();
  const calendarCells = [];
  
  for (let i = 0; i < startDay; i++) calendarCells.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarCells.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  // --- Aggregate Data ---
  const activeAY = academicYears.find(ay => ay.status === 'ACTIVE');
  const approvedEvents = useMemo(() => {
    // Only display approved events for the Active AY bounds (optimization)
    if (!activeAY) return [];
    return allEvents.filter(e => e.status === 'APPROVED' && e.startDate >= activeAY.startDate && e.startDate <= activeAY.endDate);
  }, [allEvents, activeAY]);

  const getDayEvents = (date) => {
    if (!date) return [];
    const dateStr = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
    const dayEvents = [];

    holidays.forEach(h => {
      if (h.date === dateStr) dayEvents.push({ type: 'holiday', title: h.name, color: 'bg-red-100 text-red-800 border-red-200' });
    });
    exams.forEach(e => {
      if (dateStr >= e.startDate && dateStr <= e.endDate) dayEvents.push({ type: 'exam', title: e.name, color: 'bg-orange-100 text-orange-800 border-orange-200' });
    });
    departmentCalendar.forEach(d => {
      if (d.date === dateStr) dayEvents.push({ type: 'dept', title: `[${d.department}] ${d.title}`, color: 'bg-purple-100 text-purple-800 border-purple-200' });
    });
    approvedEvents.forEach(e => {
      if (dateStr >= e.startDate && dateStr <= (e.endDate || e.startDate)) dayEvents.push({ type: 'event', title: e.title || e.eventName, color: 'bg-blue-100 text-blue-800 border-blue-200' });
    });

    return dayEvents;
  };

  const checkIsSemester = (date) => {
    if (!date) return false;
    const dateStr = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
    return semesters.some(sem => sem.status === 'ACTIVE' && dateStr >= sem.startDate && dateStr <= sem.endDate);
  };

  if (loading) return <Layout><div className="p-8 text-center text-slate-500 font-medium">Loading Academic Calendar...</div></Layout>;

  return (
    <Layout>
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 sm:mb-8 gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <CalendarIcon className="text-indigo-600" size={32} />
            Academic Calendar
          </h1>
          <p className="text-slate-500 mt-1">Unified institutional and departmental scheduling.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-wrap gap-2 bg-slate-100 p-1 rounded-lg">
          <button onClick={() => setActiveTab('calendar')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'calendar' ? 'bg-white shadow text-indigo-600' : 'text-slate-600 hover:bg-slate-200'}`}>
            Calendar View
          </button>
          {isIQAC && (
            <button onClick={() => setActiveTab('manage_iqac')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'manage_iqac' ? 'bg-white shadow text-indigo-600' : 'text-slate-600 hover:bg-slate-200'}`}>
              Institution Setup (IQAC)
            </button>
          )}
          {isHOD && (
            <button onClick={() => setActiveTab('manage_hod')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'manage_hod' ? 'bg-white shadow text-indigo-600' : 'text-slate-600 hover:bg-slate-200'}`}>
              Dept Calendar (HOD)
            </button>
          )}
          </div>
          <button onClick={() => navigate(-1)} className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 font-semibold transition-colors flex items-center gap-2 text-sm bg-white shadow-sm">
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      </div>

      {activeTab === 'calendar' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center bg-slate-50 gap-4 shrink-0">
            <div className="flex items-center gap-4">
              <button onClick={prevMonth} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><ChevronLeft size={20}/></button>
              <h2 className="text-xl font-bold text-slate-800 w-48 text-center">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={nextMonth} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><ChevronRight size={20}/></button>
            </div>
            <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500 justify-center">
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-400"></div> Events</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-orange-400"></div> Exams</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-400"></div> Holidays</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-purple-400"></div> Dept</span>
            </div>
          </div>
          
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 shrink-0">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-3 text-center text-xs sm:text-sm font-bold text-slate-500 border-r border-slate-200 last:border-0 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 flex-1" style={{ gridTemplateRows: `repeat(${calendarCells.length / 7}, minmax(0, 1fr))` }}>
            {calendarCells.map((date, idx) => {
              const dayEvents = getDayEvents(date);
              const isSem = checkIsSemester(date);
              const isToday = date && date.toDateString() === new Date().toDateString();
              
              return (
                <div key={idx} className={`border-r border-b border-slate-100 p-1 sm:p-2 overflow-y-auto ${!date ? 'bg-slate-50/50' : (isSem ? 'bg-green-50/20' : '')} ${isToday ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/10' : ''}`}>
                  {date && (
                    <>
                      <div className={`text-right text-xs sm:text-sm font-bold mb-1 ${isToday ? 'text-indigo-600' : 'text-slate-600'}`}>{date.getDate()}</div>
                      <div className="space-y-1">
                        {dayEvents.map((evt, eIdx) => (
                          <div key={eIdx} className={`text-[9px] sm:text-[10px] font-semibold px-1 sm:px-2 py-0.5 sm:py-1 rounded border leading-tight truncate ${evt.color}`} title={evt.title}>
                            {evt.title}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'manage_iqac' && isIQAC && <IQACManagementTab />}
      {activeTab === 'manage_hod' && isHOD && <HODManagementTab />}

    </div>
    </Layout>
  );
};

// ===============================================
// IQAC MANAGEMENT TAB
// ===============================================
const IQACManagementTab = () => {
  const { academicYears, semesters, holidays, exams, workingDays } = useCalendarContext();
  const [subTab, setSubTab] = useState('years'); // 'years', 'semesters', 'holidays', 'exams', 'workingDays'

  const [form, setForm] = useState({});
  const [loadingAction, setLoadingAction] = useState(false);
  const token = localStorage.getItem('sessionToken');
  const API_BASE = import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com';

  const handleApi = async (endpoint, method, body) => {
    setLoadingAction(true);
    try {
      const res = await fetch(`${API_BASE}/api/academic-calendar/${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : null
      });
      const data = await res.json();
      if (!res.ok) alert(data.message || 'Action failed');
    } catch (err) {
      alert('Network error');
    } finally {
      setLoadingAction(false);
      setForm({});
    }
  };

  const Input = ({ label, type, field, required = true }) => (
    <div className="space-y-1">
      <label className="text-xs font-bold text-slate-700 uppercase">{label}</label>
      <input type={type} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm" value={form[field] || ''} onChange={e => setForm({...form, [field]: e.target.value})} required={required} />
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar */}
      <div className="w-full md:w-64 shrink-0 bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2 h-max">
        {[
          { id: 'years', label: 'Academic Years' },
          { id: 'semesters', label: 'Semesters' },
          { id: 'holidays', label: 'College Holidays' },
          { id: 'exams', label: 'Examination Schedules' },
          { id: 'workingDays', label: 'Working Days' }
        ].map(t => (
          <button key={t.id} onClick={() => { setSubTab(t.id); setForm({}); }} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${subTab === t.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        
        {/* ACADEMIC YEARS */}
        {subTab === 'years' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-2">Manage Academic Years</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
              <Input label="Name (e.g. 2026-2027)" type="text" field="name" />
              <Input label="Start Date" type="date" field="startDate" />
              <Input label="End Date" type="date" field="endDate" />
              <button disabled={loadingAction} onClick={() => handleApi('academic-years', 'POST', form)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors h-[38px]">
                Create Year
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-sm font-bold text-slate-600">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Start</th>
                    <th className="py-3 px-4">End</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {academicYears.map(ay => (
                    <tr key={ay.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-sm font-medium">
                      <td className="py-3 px-4">{ay.name}</td>
                      <td className="py-3 px-4 text-slate-500">{ay.startDate}</td>
                      <td className="py-3 px-4 text-slate-500">{ay.endDate}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${ay.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{ay.status}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {ay.status !== 'ACTIVE' && (
                          <button onClick={() => handleApi(`academic-years/${ay.id}/activate`, 'PUT')} className="text-indigo-600 hover:text-indigo-800 text-xs font-bold px-2 py-1 rounded bg-indigo-50 transition-colors">
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SEMESTERS */}
        {subTab === 'semesters' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-2">Manage Semesters</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
              <Input label="Name" type="text" field="name" />
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase">Academic Year</label>
                <select className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm" value={form.academicYear || ''} onChange={e => setForm({...form, academicYear: e.target.value})}>
                  <option value="">Select...</option>
                  {academicYears.map(ay => <option key={ay.id} value={ay.name}>{ay.name}</option>)}
                </select>
              </div>
              <Input label="Start Date" type="date" field="startDate" />
              <Input label="End Date" type="date" field="endDate" />
              <button disabled={loadingAction} onClick={() => handleApi('semesters', 'POST', form)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 h-[38px]">
                Add
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-sm font-bold text-slate-600">
                    <th className="py-3 px-4">Semester</th>
                    <th className="py-3 px-4">Academic Year</th>
                    <th className="py-3 px-4">Dates</th>
                    <th className="py-3 px-4 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {semesters.map(s => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 text-sm font-medium">
                      <td className="py-3 px-4">{s.name}</td>
                      <td className="py-3 px-4">{s.academicYear}</td>
                      <td className="py-3 px-4 text-slate-500">{s.startDate} to {s.endDate}</td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => handleApi(`semesters/${s.id}`, 'DELETE')} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* HOLIDAYS */}
        {subTab === 'holidays' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-2">College Holidays</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
              <Input label="Name" type="text" field="name" />
              <Input label="Date" type="date" field="date" />
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase">Type</label>
                <select className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm" value={form.type || ''} onChange={e => setForm({...form, type: e.target.value})}>
                  <option value="">Select...</option>
                  <option value="National Holiday">National Holiday</option>
                  <option value="College Holiday">College Holiday</option>
                  <option value="Festival Holiday">Festival Holiday</option>
                  <option value="Local Holiday">Local Holiday</option>
                </select>
              </div>
              <button disabled={loadingAction} onClick={() => handleApi('holidays', 'POST', form)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 h-[38px]">
                Add Holiday
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-sm font-bold text-slate-600">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map(h => (
                    <tr key={h.id} className="border-b border-slate-100 hover:bg-slate-50 text-sm font-medium">
                      <td className="py-3 px-4">{h.name}</td>
                      <td className="py-3 px-4">{h.date}</td>
                      <td className="py-3 px-4"><span className="bg-red-50 text-red-700 px-2 py-1 rounded-md text-xs">{h.type}</span></td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => handleApi(`holidays/${h.id}`, 'DELETE')} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EXAMS */}
        {subTab === 'exams' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-2">Examination Schedules</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
              <Input label="Name (e.g. Model Exam 1)" type="text" field="name" />
              <Input label="Start Date" type="date" field="startDate" />
              <Input label="End Date" type="date" field="endDate" />
              <Input label="Department (or ALL)" type="text" field="department" />
              <button disabled={loadingAction} onClick={() => handleApi('exams', 'POST', form)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 h-[38px]">
                Add Exam
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-sm font-bold text-slate-600">
                    <th className="py-3 px-4">Exam Name</th>
                    <th className="py-3 px-4">Dept</th>
                    <th className="py-3 px-4">Dates</th>
                    <th className="py-3 px-4 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map(e => (
                    <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 text-sm font-medium">
                      <td className="py-3 px-4">{e.name}</td>
                      <td className="py-3 px-4">{e.department}</td>
                      <td className="py-3 px-4">{e.startDate} to {e.endDate}</td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => handleApi(`exams/${e.id}`, 'DELETE')} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* WORKING DAYS */}
        {subTab === 'workingDays' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-2">Global Working Days</h2>
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-6">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                const isWorking = workingDays[day] !== false; // Default true if undefined
                return (
                  <label key={day} className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                      checked={isWorking}
                      onChange={(e) => {
                        handleApi('working-days', 'POST', { ...workingDays, [day]: e.target.checked });
                      }}
                    />
                    <span className="font-bold text-sm text-slate-700">{day}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">Changes to working days are instantly saved globally.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ===============================================
// HOD MANAGEMENT TAB
// ===============================================
const HODManagementTab = () => {
  const { departmentCalendar } = useCalendarContext();
  const { currentUser } = useAppContext();
  const [fileData, setFileData] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const token = localStorage.getItem('sessionToken');
  const API_BASE = import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com';

  const myDeptEvents = departmentCalendar.filter(d => d.department === currentUser.department);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      const mapped = data.map(row => ({
        title: row.Title || row.title || row.Name || row.name,
        date: row.Date || row.date,
        type: row.Type || row.type || 'Department Activity',
        description: row.Description || row.description || ''
      })).filter(r => r.title && r.date);
      
      setFileData(mapped);
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!fileData || fileData.length === 0) return;
    setLoadingAction(true);
    try {
      const res = await fetch(`${API_BASE}/api/academic-calendar/department-events/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ records: fileData })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully imported ${data.data.imported} records. (Skipped ${data.data.duplicates} duplicates, ${data.data.invalid} invalid)`);
        setFileData(null);
      } else {
        alert(data.message || 'Import failed');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await fetch(`${API_BASE}/api/academic-calendar/department-events/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) { }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-end border-b pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Department Calendar Management</h2>
          <p className="text-slate-500 text-sm mt-1">Manage activities exclusively for {currentUser.department}.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Import Section */}
        <div className="lg:col-span-1 space-y-4">
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Upload size={18} className="text-indigo-600"/> Import via Excel</h3>
            <p className="text-xs text-slate-500 mb-4">Ensure your Excel contains columns: <strong>Title</strong>, <strong>Date</strong> (YYYY-MM-DD), and <strong>Type</strong>.</p>
            
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
            
            {fileData && (
              <div className="mt-6 space-y-4">
                <div className="bg-white p-3 rounded border border-slate-200 text-sm font-medium">
                  Found {fileData.length} valid rows to import.
                </div>
                <button onClick={handleImport} disabled={loadingAction} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors">
                  {loadingAction ? 'Importing...' : 'Confirm Import'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Existing Records Section */}
        <div className="lg:col-span-2">
          <h3 className="font-bold text-slate-800 mb-4">Current Department Activities</h3>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Delete</th>
                </tr>
              </thead>
              <tbody>
                {myDeptEvents.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-8 text-slate-500 text-sm">No department activities found.</td></tr>
                ) : myDeptEvents.map(d => (
                  <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50 text-sm font-medium">
                    <td className="py-3 px-4">{d.title}</td>
                    <td className="py-3 px-4 text-slate-500">{d.date}</td>
                    <td className="py-3 px-4"><span className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs">{d.type}</span></td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleDelete(d.id)} className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcademicCalendar;
