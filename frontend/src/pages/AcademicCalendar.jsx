import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Upload, Trash2, CheckCircle, Download, ArrowLeft, ChevronDown } from 'lucide-react';
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
      if (dateStr >= d.date && dateStr <= (d.endDate || d.date)) dayEvents.push({ type: 'dept', title: `[${d.department}] ${d.title}`, color: 'bg-purple-100 text-purple-800 border-purple-200' });
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
    <div className="w-full mx-auto p-4 sm:p-6 lg:p-8 h-full flex flex-col">
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
  const [importData, setImportData] = useState(null);
  
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

  const CustomSelect = ({ label, field, options, required = true }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const ref = React.useRef(null);
    React.useEffect(() => {
      const handleClickOutside = (event) => {
        if (ref.current && !ref.current.contains(event.target)) setIsOpen(false);
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref]);

    return (
      <div className="space-y-1 relative" ref={ref}>
        <label className="text-xs font-bold text-slate-700 uppercase">{label}</label>
        <div 
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm flex justify-between items-center cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{form[field] || 'Select...'}</span>
          <ChevronDown size={16} className="text-slate-400" />
        </div>
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <div 
              className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer text-slate-500"
              onClick={() => { setForm({...form, [field]: ''}); setIsOpen(false); }}
            >
              Select...
            </div>
            {options.map(opt => (
              <div 
                key={opt.value}
                className={`px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer ${form[field] === opt.value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}
                onClick={() => { setForm({...form, [field]: opt.value}); setIsOpen(false); }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleFileUpload = (e, mappingFn) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      const mapped = data.map(mappingFn).filter(row => row !== null);
      setImportData(mapped);
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const handleBulkImport = async (endpoint) => {
    if (!importData || importData.length === 0) return;
    setLoadingAction(true);
    try {
      const res = await fetch(`${API_BASE}/api/academic-calendar/${endpoint}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ records: importData })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully imported ${data.data.imported} records. (Skipped ${data.data.duplicates || 0} duplicates, ${data.data.invalid || 0} invalid)`);
        setImportData(null);
      } else {
        alert(data.message || 'Import failed');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setLoadingAction(false);
    }
  };

  // Import Section Component
  const ImportSection = ({ title, columnsInfo, exampleData, endpoint, mappingFn }) => (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
      <div>
        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Upload size={18} className="text-indigo-600"/> Import {title}</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-2xl">Ensure Excel contains columns: {columnsInfo}</p>
      </div>
      
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <details className="relative group">
          <summary className="bg-white border border-slate-200 text-slate-600 text-xs font-bold px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 list-none flex items-center gap-1 shadow-sm transition-colors">
            Example Format <ChevronDown size={14}/>
          </summary>
          <div className="absolute right-0 top-full mt-2 w-max bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  {Object.keys(exampleData[0]).map((key, i) => <th key={i} className="px-3 py-2 font-semibold border-r border-slate-200 last:border-0">{key}</th>)}
                </tr>
              </thead>
              <tbody className="text-slate-600">
                {exampleData.map((row, rIdx) => (
                  <tr key={rIdx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    {Object.values(row).map((val, cIdx) => <td key={cIdx} className="px-3 py-2 border-r border-slate-100 font-mono text-[10px] last:border-0">{val}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        {!importData ? (
          <input type="file" accept=".xlsx, .xls, .csv" onChange={(e) => handleFileUpload(e, mappingFn)} className="block text-sm text-slate-500 file:mr-0 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer transition-colors" />
        ) : (
          <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
             <span className="text-sm font-bold text-indigo-700">{importData.length} rows</span>
             <button onClick={() => handleBulkImport(endpoint)} disabled={loadingAction} className="px-3 py-1.5 bg-indigo-600 text-white rounded font-bold text-xs hover:bg-indigo-700 transition-colors shadow-sm">
               {loadingAction ? 'Importing...' : 'Confirm'}
             </button>
             <button onClick={() => setImportData(null)} className="px-3 py-1.5 bg-white text-slate-600 rounded border border-slate-200 font-bold text-xs hover:bg-slate-50 transition-colors shadow-sm">
               Cancel
             </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Filter */}
      <div className="flex justify-end mb-2">
        <select 
          value={subTab} 
          onChange={(e) => { setSubTab(e.target.value); setForm({}); setImportData(null); }} 
          className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none min-w-[250px] shadow-sm"
        >
          <option value="years">Academic Years</option>
          <option value="semesters">Semesters</option>
          <option value="holidays">College Holidays</option>
          <option value="exams">Examination Schedules</option>
          <option value="workingDays">Working Days</option>
        </select>
      </div>

      {/* Main Content */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        
        {/* ACADEMIC YEARS */}
        {subTab === 'years' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-2">Manage Academic Years</h2>
              <ImportSection 
                title="Academic Years"
                columnsInfo={<><strong>Name</strong>, <strong>StartDate</strong>, <strong>EndDate</strong> (YYYY-MM-DD)</>}
                exampleData={[{ Name: '2026-2027', StartDate: '2026-06-01', EndDate: '2027-05-31' }]}
                endpoint="academic-years"
                mappingFn={row => row.Name || row.name ? { name: row.Name || row.name, startDate: row.StartDate || row.startDate, endDate: row.EndDate || row.endDate } : null}
              />
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <Input label="Name (e.g. 2026-2027)" type="text" field="name" />
                  <Input label="Start Date" type="date" field="startDate" />
                  <Input label="End Date" type="date" field="endDate" />
                  <button disabled={loadingAction} onClick={() => handleApi('academic-years', 'POST', form)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors h-[38px]">
                    Create Year
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-600">
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
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-2">Manage Semesters</h2>
              <ImportSection 
                title="Semesters"
                columnsInfo={<><strong>Name</strong>, <strong>AcademicYear</strong>, <strong>StartDate</strong>, <strong>EndDate</strong></>}
                exampleData={[{ Name: 'Odd Sem', AcademicYear: '2026-2027', StartDate: '2026-06-01', EndDate: '2026-12-15' }]}
                endpoint="semesters"
                mappingFn={row => row.Name || row.name ? { name: row.Name || row.name, academicYear: row.AcademicYear || row.academicYear, startDate: row.StartDate || row.startDate, endDate: row.EndDate || row.endDate } : null}
              />
              <div className="space-y-6">
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
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-600">
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
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-2">College Holidays</h2>
              <ImportSection 
                title="Holidays"
                columnsInfo={<><strong>Name</strong>, <strong>Date</strong> (YYYY-MM-DD), <strong>Type</strong></>}
                exampleData={[{ Name: 'Diwali', Date: '2026-11-04', Type: 'Festival Holiday' }]}
                endpoint="holidays"
                mappingFn={row => (row.Name || row.name) ? { name: row.Name || row.name, date: row.Date || row.date, type: row.Type || row.type || 'College Holiday' } : null}
              />
              <div className="space-y-6">
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
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-600">
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holidays.length === 0 ? (
                        <tr><td colSpan="4" className="text-center py-8 text-slate-500 text-sm">No holidays found.</td></tr>
                      ) : holidays.map(h => (
                        <tr key={h.id} className="border-b border-slate-100 hover:bg-slate-50 text-sm font-medium">
                          <td className="py-3 px-4">{h.name}</td>
                          <td className="py-3 px-4">{h.date}</td>
                          <td className="py-3 px-4"><span className="bg-red-50 text-red-700 px-2 py-1 rounded-md text-xs">{h.type}</span></td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => handleApi(`holidays/${h.id}`, 'DELETE')} className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50"><Trash2 size={16}/></button>
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
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-2">Examination Schedules</h2>
              <ImportSection 
                title="Exams"
                columnsInfo={<><strong>Name</strong>, <strong>StartDate</strong>, <strong>EndDate</strong>, <strong>Department</strong>, <strong>Semester</strong> (Optional)</>}
                exampleData={[{ Name: 'Model Exam', StartDate: '2026-10-10', EndDate: '2026-10-15', Department: 'CSE', Semester: 'Odd Sem' }]}
                endpoint="exams"
                mappingFn={row => (row.Name || row.name) ? { name: row.Name || row.name, startDate: row.StartDate || row.startDate, endDate: row.EndDate || row.endDate, department: row.Department || row.department, semester: row.Semester || row.semester } : null}
              />
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <Input label="Name (e.g. Model Exam 1)" type="text" field="name" />
                  <Input label="Start Date" type="date" field="startDate" />
                  <Input label="End Date" type="date" field="endDate" />
                  <CustomSelect 
                    label="Department (or ALL)" 
                    field="department" 
                    options={[
                      { value: 'ALL', label: 'ALL' },
                      { value: 'CSE', label: 'CSE' },
                      { value: 'ECE', label: 'ECE' },
                      { value: 'IT', label: 'IT' },
                      { value: 'AIDS', label: 'AIDS' },
                      { value: 'AIML', label: 'AIML' },
                      { value: 'CCE', label: 'CCE' },
                      { value: 'CSBS', label: 'CSBS' },
                      { value: 'MECH', label: 'MECH' },
                      { value: 'CIVIL', label: 'CIVIL' },
                      { value: 'MTR', label: 'MTR' },
                      { value: 'BME', label: 'BME' },
                      { value: 'CYBER', label: 'CYBER' },
                      { value: 'EEE', label: 'EEE' }
                    ]}
                  />
                  <button disabled={loadingAction} onClick={() => handleApi('exams', 'POST', form)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 h-[38px]">
                    Add Exam
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-600">
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
            <div className="space-y-6">
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', endDate: '', type: 'event' });

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

  const handleAddEvent = async (e) => {
    e.preventDefault();
    setLoadingAction(true);
    try {
      const res = await fetch(`${API_BASE}/api/academic-calendar/department-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newEvent)
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddModal(false);
        setNewEvent({ title: '', date: '', endDate: '', type: 'event' });
      } else {
        alert(data.message || 'Failed to add event');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-end border-b pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Department Calendar Management</h2>
          <p className="text-slate-500 text-sm mt-1">Manage activities exclusively for {currentUser.department}.</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        
        {/* Import Section */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Upload size={18} className="text-indigo-600"/> Import Department Activities</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">Ensure Excel contains columns: <strong>Title</strong>, <strong>Date</strong> (YYYY-MM-DD), <strong>EndDate</strong> (Optional), and <strong>Type</strong>.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <details className="relative group">
              <summary className="bg-white border border-slate-200 text-slate-600 text-xs font-bold px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 list-none flex items-center gap-1 shadow-sm transition-colors">
                Example Format <ChevronDown size={14}/>
              </summary>
              <div className="absolute right-0 top-full mt-2 w-max bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-semibold border-r border-slate-200">Title</th>
                      <th className="px-3 py-2 font-semibold border-r border-slate-200">Date</th>
                      <th className="px-3 py-2 font-semibold border-r border-slate-200">EndDate</th>
                      <th className="px-3 py-2 font-semibold">Type</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-600">
                    <tr className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 border-r border-slate-100">Project Review 1</td>
                      <td className="px-3 py-2 border-r border-slate-100 font-mono text-[10px]">2026-08-15</td>
                      <td className="px-3 py-2 border-r border-slate-100 font-mono text-[10px]">2026-08-17</td>
                      <td className="px-3 py-2 text-indigo-600 font-medium">exam</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="px-3 py-2 border-r border-slate-100">Guest Lecture</td>
                      <td className="px-3 py-2 border-r border-slate-100 font-mono text-[10px]">2026-08-20</td>
                      <td className="px-3 py-2 border-r border-slate-100 font-mono text-[10px]"></td>
                      <td className="px-3 py-2 text-indigo-600 font-medium">event</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>

            {!fileData ? (
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="block text-sm text-slate-500 file:mr-0 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer transition-colors" />
            ) : (
              <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                 <span className="text-sm font-bold text-indigo-700">{fileData.length} rows</span>
                 <button onClick={handleImport} disabled={loadingAction} className="px-3 py-1.5 bg-indigo-600 text-white rounded font-bold text-xs hover:bg-indigo-700 transition-colors shadow-sm">
                   {loadingAction ? 'Importing...' : 'Confirm'}
                 </button>
                 <button onClick={() => setFileData(null)} className="px-3 py-1.5 bg-white text-slate-600 rounded border border-slate-200 font-bold text-xs hover:bg-slate-50 transition-colors shadow-sm">
                   Cancel
                 </button>
              </div>
            )}
          </div>
        </div>

        {/* Existing Records Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800">Current Department Activities</h3>
            <button 
              onClick={() => setShowAddModal(true)} 
              className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors"
            >
              <Plus size={16} /> Add Event
            </button>
          </div>
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
                    <td className="py-3 px-4 text-slate-500">{d.date} {d.endDate && d.endDate !== d.date ? ` to ${d.endDate}` : ''}</td>
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

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Add Department Event</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={handleAddEvent} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Event Title *</label>
                <input required type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border" placeholder="e.g. Guest Lecture on AI" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
                  <input required type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date (Optional)</label>
                  <input type="date" value={newEvent.endDate} min={newEvent.date} onChange={e => setNewEvent({...newEvent, endDate: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Event Type *</label>
                <select required value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border bg-white">
                  <option value="event">Event</option>
                  <option value="exam">Exam</option>
                  <option value="holiday">Holiday</option>
                  <option value="dept">Department Activity</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Cancel</button>
                <button type="submit" disabled={loadingAction} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {loadingAction ? 'Adding...' : 'Add Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicCalendar;
