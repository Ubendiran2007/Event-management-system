import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, ChevronRight, ChevronLeft, ShieldCheck, UserCheck, UserX, ArrowLeft, Search, Loader2,
    Plus, Trash2, Edit, Upload, FileSpreadsheet, X, Building2
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { UserRole } from '../types';
import Layout from '../components/Layout';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatRollNo, formatStudentNameWithRoll } from '../utils/formatters';
import * as XLSX from 'xlsx';

const ALL_CLASSES = [
  'CSE-B', 'CSE-D', 'ECE-A', 'ECE-B', 'CCE-A', 'CSBS-A', 'MECH-A', 'CYBER-A', 'EEE-A', 'AIML-A', 'AIDS-A'
];

const STAFF_ROLES = [
  'FACULTY', 'HOD', 'HR_TEAM', 'AUDIO_TEAM', 'SYSTEM_ADMIN', 
  'TRANSPORT_TEAM', 'BOYS_WARDEN', 'GIRLS_WARDEN', 'MEDIA', 'IQAC_TEAM'
];

const ManageStudents = () => {
    const { currentUser, students, staffUsers, loading } = useAppContext();
    const navigate = useNavigate();
    
    // Tabs & View State
    const [activeTab, setActiveTab] = useState('students'); // 'students' | 'staff'
    const [selectedDepartment, setSelectedDepartment] = useState(null); // e.g. 'CSE'
    const [selectedClass, setSelectedClass] = useState(null); // e.g. 'CSE-B'
    const [searchQuery, setSearchQuery] = useState('');
    const [staffSearchQuery, setStaffSearchQuery] = useState('');
    const [togglingId, setTogglingId] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Modal States
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    
    const [deletingStudent, setDeletingStudent] = useState(null);
    const [deletingStaff, setDeletingStaff] = useState(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    // Form States
    const [studentForm, setStudentForm] = useState({ name: '', rollNo: '', email: '', class: '', section: '', department: '', phone: '', password: '', odLimit: '' });
    const [staffForm, setStaffForm] = useState({ name: '', email: '', role: 'FACULTY', department: '', password: '', assignedClasses: [] });
    
    // Bulk Import State
    const [bulkData, setBulkData] = useState([]);
    const [bulkError, setBulkError] = useState('');
    const fileInputRef = useRef(null);

    // Security Check
    useEffect(() => {
        if (!currentUser) navigate('/');
        else if (![UserRole.FACULTY, UserRole.HOD, UserRole.IQAC_TEAM].includes(currentUser.role)) navigate('/dashboard');
    }, [currentUser, navigate]);

    if (!currentUser || ![UserRole.FACULTY, UserRole.HOD, UserRole.IQAC_TEAM].includes(currentUser.role)) return null;
    const isIQAC = currentUser.role === UserRole.IQAC_TEAM;

    // --- Students Logic ---
    const mergedStudents = students || [];
    
    const isDeptRestricted = [UserRole.FACULTY, UserRole.HOD].includes(currentUser.role);
    const accessibleStudents = isDeptRestricted 
        ? mergedStudents.filter(s => {
            if (currentUser.role === UserRole.FACULTY) {
                if (!currentUser.assignedClasses || currentUser.assignedClasses.length === 0) return false;
                const sClass = s.class?.replace(/-/g, ' ').toUpperCase() || '';
                const assigned = currentUser.assignedClasses.map(c => c.replace(/-/g, ' ').toUpperCase());
                return assigned.includes(sClass);
            }
            if (!currentUser.department) return false;
            const sDept = (s.department || '').toUpperCase();
            const uDept = (currentUser.department || '').toUpperCase();
            if (uDept === 'AI&DS' || uDept === 'AIDS') return sDept === 'AI&DS' || sDept === 'AIDS';
            return sDept === uDept;
        })
        : mergedStudents;

    const classMap = {};
    accessibleStudents.forEach(student => {
        const cls = student.class || 'Unknown Class';
        if (!classMap[cls]) classMap[cls] = [];
        classMap[cls].push(student);
    });
    
    const classes = Object.keys(classMap).sort();

    // Group classes by department prefix (e.g. CSE-B -> CSE)
    const deptMap = {};
    classes.forEach(cls => {
        const prefix = cls.split('-')[0] || cls;
        if (!deptMap[prefix]) deptMap[prefix] = [];
        deptMap[prefix].push(cls);
    });
    const departments = Object.keys(deptMap).sort();

    const classStudents = selectedClass && classMap[selectedClass] ? classMap[selectedClass] : [];
    const filteredClassStudents = classStudents.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        formatRollNo(s.rollNo, s.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // --- Staff Logic ---
    const filteredStaff = (staffUsers || []).filter(s => 
        s.name.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
        s.role.toLowerCase().includes(staffSearchQuery.toLowerCase())
    );

    // --- API Handlers ---
    const handleSaveStudent = async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            const url = editingStudent 
                ? `https://event-management-system-dpzc.onrender.com/api/students/${editingStudent.id}`
                : `https://event-management-system-dpzc.onrender.com/api/students`;
            const method = editingStudent ? 'PUT' : 'POST';
            
            const payload = { ...studentForm, className: studentForm.class.replace(/\s+/g, '-') };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            
            setShowStudentModal(false);
            setEditingStudent(null);
            setStudentForm({ name: '', rollNo: '', email: '', class: '', section: '', department: '', phone: '', password: '', odLimit: '' });
        } catch (err) {
            console.error(err);
            alert('Failed to save student: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteStudent = async () => {
        if (!deletingStudent) return;
        setIsProcessing(true);
        try {
            const className = deletingStudent.class.replace(/\s+/g, '-');
            const res = await fetch(`https://event-management-system-dpzc.onrender.com/api/students/${deletingStudent.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
                body: JSON.stringify({ className })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
        } catch (err) {
            console.error(err);
            alert('Failed to delete student');
        } finally {
            setIsProcessing(false);
            setDeletingStudent(null);
        }
    };

    const handleSaveStaff = async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            const url = editingStaff 
                ? `https://event-management-system-dpzc.onrender.com/api/users/${editingStaff.id}`
                : `https://event-management-system-dpzc.onrender.com/api/users`;
            const method = editingStaff ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
                body: JSON.stringify(staffForm)
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            
            setShowStaffModal(false);
            setEditingStaff(null);
            setStaffForm({ name: '', email: '', role: 'FACULTY', department: '', password: '', assignedClasses: [] });
        } catch (err) {
            console.error(err);
            alert('Failed to save staff: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteStaff = async () => {
        if (!deletingStaff) return;
        setIsProcessing(true);
        try {
            const res = await fetch(`https://event-management-system-dpzc.onrender.com/api/users/${deletingStaff.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` }
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
        } catch (err) {
            console.error(err);
            alert('Failed to delete staff');
        } finally {
            setIsProcessing(false);
            setDeletingStaff(null);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                
                const formatted = data.map(row => ({
                    name: row.Name || row.name || '',
                    rollNo: String(row.RollNo || row.rollNo || row.Roll_No || row.rollno || ''),
                    email: row.Email || row.email || '',
                    className: String(row.Class || row.class || '').replace(/\s+/g, '-'),
                    section: String(row.Section || row.section || ''),
                    department: String(row.Department || row.department || ''),
                    phone: String(row.Phone || row.phone || ''),
                    password: String(row.Password || row.password || ''),
                    odLimit: row.ODLimit || row.odLimit || row['OD Limit'] || 7
                })).filter(s => s.name && s.rollNo && s.email && s.className && s.section && s.department && s.phone);
                
                if (formatted.length === 0) throw new Error('No valid students found. Check column headers.');
                setBulkData(formatted);
                setBulkError('');
            } catch (err) {
                setBulkError('Failed to parse file: ' + err.message);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleBulkSubmit = async () => {
        if (bulkData.length === 0) return;
        setIsProcessing(true);
        try {
            const res = await fetch('https://event-management-system-dpzc.onrender.com/api/students/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
                body: JSON.stringify({ students: bulkData })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            
            setShowBulkModal(false);
            setBulkData([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
            alert(`Successfully added ${data.addedCount} students!`);
        } catch (err) {
            console.error(err);
            alert('Bulk import failed: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleResetODUsage = () => setShowResetConfirm(true);
    const confirmResetODUsage = async () => {
        setIsProcessing(true);
        try {
            const res = await fetch('https://event-management-system-dpzc.onrender.com/api/students/reset-od-usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` }
            });
            const data = await res.json();
            if (data.success) window.location.reload();
            else throw new Error(data.message);
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
            setShowResetConfirm(false);
        }
    };
    
    const handleToggleOrganizer = async (student) => {
        setTogglingId(student.id);
        const newRole = student.role === UserRole.STUDENT_ORGANIZER ? UserRole.STUDENT_GENERAL : UserRole.STUDENT_ORGANIZER;
        const className = (student.class || '').replace(/\s+/g, '-');
        try {
            await fetch(`https://event-management-system-dpzc.onrender.com/api/students/${student.id}/role`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
                body: JSON.stringify({ role: newRole, className, isApprovedOrganizer: newRole === UserRole.STUDENT_ORGANIZER }),
            });
        } catch (err) {
            console.error(err);
        } finally {
            setTogglingId(null);
        }
    };

    const handleUpdateODStats = async (student, field, value) => {
        if (!isIQAC) return;
        setTogglingId(`${student.id}-${field}`);
        const className = (student.class || '').replace(/\s+/g, '-');
        try {
            await fetch(`https://event-management-system-dpzc.onrender.com/api/students/${student.id}/od-stats`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
                body: JSON.stringify({ className, [field]: value }),
            });
        } catch (err) {
            console.error(err);
        } finally {
            setTogglingId(null);
        }
    };

      return (
    <Layout>
      <div className="flex-1 flex flex-col min-h-0 relative">
                <div className="bg-[#f8fafc] border-b border-slate-200 px-6 pt-6 z-30 shrink-0">
                    <div className="max-w-6xl mx-auto w-full">
                        <div className="flex flex-row items-center justify-between gap-4 mb-4">
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">User Management</h2>
                                <p className="text-slate-500 mt-1 text-sm hidden sm:block">Manage institutional users and roles</p>
                            </div>
                            <div className="flex items-center justify-end gap-3 shrink-0 flex-wrap">
                                {isIQAC && activeTab === 'students' && (
                                    <>
                                        <button onClick={() => { setEditingStudent(null); setStudentForm({ name: '', rollNo: '', email: '', class: '', section: '', department: '', phone: '', password: '', odLimit: '' }); setShowStudentModal(true); }} className="px-4 py-2 bg-cse-accent text-white rounded-xl font-bold text-sm hover:bg-cse-accent/90 transition-all flex items-center gap-2">
                                            <Plus size={16} /> Add Student
                                        </button>
                                        <button onClick={() => { setBulkData([]); setBulkError(''); setShowBulkModal(true); }} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-all flex items-center gap-2">
                                            <Upload size={16} /> Bulk Import
                                        </button>
                                        <button onClick={handleResetODUsage} className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl font-bold text-sm hover:bg-rose-100 transition-all flex items-center gap-2">
                                            <UserX size={16} /> Reset ODs
                                        </button>
                                    </>
                                )}
                                <button onClick={() => navigate('/dashboard')} className="btn-secondary flex items-center gap-1 shrink-0 px-3 py-1.5 h-fit text-sm whitespace-nowrap ml-2">
                                    <ChevronLeft size={16} /> Back
                                </button>
                                {isIQAC && activeTab === 'staff' && (
                                    <button onClick={() => { setEditingStaff(null); setStaffForm({ name: '', email: '', role: 'FACULTY', department: '', password: '', assignedClasses: [] }); setShowStaffModal(true); }} className="px-4 py-2 bg-cse-accent text-white rounded-xl font-bold text-sm hover:bg-cse-accent/90 transition-all flex items-center gap-2">
                                        <Plus size={16} /> Add Staff
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Tabs */}
                        {isIQAC && (
                            <div className="flex space-x-6 border-b border-slate-200 mt-4">
                                <button
                                    onClick={() => setActiveTab('students')}
                                    className={`pb-3 font-semibold text-sm transition-colors relative ${activeTab === 'students' ? 'text-cse-accent' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Students
                                    {activeTab === 'students' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cse-accent rounded-t-full" />}
                                </button>
                                <button
                                    onClick={() => setActiveTab('staff')}
                                    className={`pb-3 font-semibold text-sm transition-colors relative ${activeTab === 'staff' ? 'text-cse-accent' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Staff Directory
                                    {activeTab === 'staff' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cse-accent rounded-t-full" />}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6">
                    <div className="max-w-6xl mx-auto w-full">
                        {loading ? (
                            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-cse-accent" size={36} /></div>
                        ) : activeTab === 'students' ? (
                            /* STUDENTS VIEW */
                            !selectedDepartment ? (
                                /* 1. Show Departments */
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                        <div className="glass-panel p-4 rounded-2xl flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><Building2 size={20} /></div>
                                            <div><p className="text-2xl font-bold text-slate-900">{departments.length}</p><p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Departments</p></div>
                                        </div>
                                        <div className="glass-panel p-4 rounded-2xl flex items-center gap-4">
                                            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center"><Users size={20} /></div>
                                            <div><p className="text-2xl font-bold text-slate-900">{accessibleStudents.length}</p><p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Students</p></div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {departments.map(dept => (
                                            <button key={dept} onClick={() => { setSelectedDepartment(dept); setSelectedClass(null); }} className="glass-panel p-6 rounded-2xl hover:bg-slate-50/80 transition-all hover:shadow-md group flex items-start justify-between">
                                                <div className="text-left">
                                                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-cse-accent transition-colors">{dept}</h3>
                                                    <p className="text-sm text-slate-600 mt-1"><span className="font-semibold">{deptMap[dept].length}</span> classes</p>
                                                </div>
                                                <ChevronRight size={24} className="text-slate-300 group-hover:text-cse-accent transition-colors" />
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : !selectedClass ? (
                                /* 2. Show Classes for Selected Department */
                                <>
                                    <div className="flex items-center gap-4 mb-6">
                                        <button onClick={() => setSelectedDepartment(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"><ArrowLeft size={20} /></button>
                                        <h3 className="text-xl font-bold text-slate-900">{selectedDepartment} Department Classes</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {deptMap[selectedDepartment].map(cls => (
                                            <button key={cls} onClick={() => { setSelectedClass(cls); setSearchQuery(''); }} className="glass-panel p-6 rounded-2xl hover:bg-slate-50/80 transition-all hover:shadow-md group flex items-start justify-between">
                                                <div className="text-left">
                                                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-cse-accent transition-colors">{cls}</h3>
                                                    <p className="text-sm text-slate-600 mt-1"><span className="font-semibold">{classMap[cls]?.length || 0}</span> students</p>
                                                </div>
                                                <ChevronRight size={24} className="text-slate-300 group-hover:text-cse-accent transition-colors" />
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                /* 3. Show Students for Selected Class */
                                <>
                                    <div className="flex items-center gap-4 mb-6">
                                        <button onClick={() => setSelectedClass(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"><ArrowLeft size={20} /></button>
                                        <h3 className="text-xl font-bold text-slate-900">{selectedClass}</h3>
                                        <div className="relative flex-1 max-w-md ml-auto">
                                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input type="text" placeholder="Search students..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cse-accent/30 focus:border-cse-accent transition-all" />
                                        </div>
                                    </div>
                                    
                                    <div className="glass-panel rounded-2xl overflow-hidden">
                                        <div className="divide-y divide-slate-100">
                                            {filteredClassStudents.map(student => (
                                                <div key={student.id} className="px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm shrink-0 border border-slate-200">{student.name.charAt(0)}</div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-slate-900 text-sm truncate">{formatStudentNameWithRoll(student.name, student.rollNo, student.id)}</p>
                                                            <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{student.email} · {student.department || 'No Dept'} {student.section && `· Sec: ${student.section}`}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        {isIQAC && (
                                                            <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm">
                                                                <div className="px-2 py-0.5 text-center relative">
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">Used</p>
                                                                    <input type="number" className="w-10 text-center text-xs font-bold bg-slate-50 rounded border-0 p-0 focus:ring-1 focus:ring-cse-accent" defaultValue={student.odUsed || 0} onBlur={(e) => handleUpdateODStats(student, 'odUsed', e.target.value)} />
                                                                </div>
                                                                <div className="text-slate-300 text-lg">/</div>
                                                                <div className="px-2 py-0.5 text-center relative">
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">Limit</p>
                                                                    <input type="number" className="w-10 text-center text-xs font-bold bg-slate-50 rounded border-0 p-0 focus:ring-1 focus:ring-emerald-500" defaultValue={student.odLimit || 7} onBlur={(e) => handleUpdateODStats(student, 'odLimit', e.target.value)} />
                                                                </div>
                                                            </div>
                                                        )}
                                                        <span className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${student.role === UserRole.STUDENT_ORGANIZER ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                            {student.role === UserRole.STUDENT_ORGANIZER ? <><ShieldCheck size={12}/> Organizer</> : 'General'}
                                                        </span>
                                                        <button onClick={() => handleToggleOrganizer(student)} disabled={togglingId === student.id} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">
                                                            {student.role === UserRole.STUDENT_ORGANIZER ? <UserX size={16} /> : <UserCheck size={16} />}
                                                        </button>
                                                        {isIQAC && (
                                                            <>
                                                                <button onClick={() => { setEditingStudent(student); setStudentForm({ ...student, class: student.class || selectedClass, password: '', odLimit: student.odLimit || 7 }); setShowStudentModal(true); }} className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"><Edit size={16}/></button>
                                                                <button onClick={() => setDeletingStudent(student)} className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"><Trash2 size={16}/></button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {filteredClassStudents.length === 0 && (
                                                <div className="p-8 text-center text-slate-500">No students found.</div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )
                        ) : (
                            /* STAFF VIEW */
                            <>
                                <div className="relative mb-6 max-w-md">
                                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input type="text" placeholder="Search staff..." value={staffSearchQuery} onChange={e => setStaffSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cse-accent/30 focus:border-cse-accent transition-all" />
                                </div>
                                <div className="glass-panel rounded-2xl overflow-hidden">
                                    <div className="divide-y divide-slate-100">
                                        {filteredStaff.map(staff => (
                                            <div key={staff.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">{staff.name.charAt(0)}</div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-sm">{staff.name}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">{staff.email}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">{staff.role.replace('_', ' ')}</span>
                                                    {staff.department && <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">{staff.department}</span>}
                                                    <button onClick={() => { setEditingStaff(staff); setStaffForm(staff); setShowStaffModal(true); }} className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"><Edit size={16}/></button>
                                                    <button onClick={() => setDeletingStaff(staff)} className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"><Trash2 size={16}/></button>
                                                </div>
                                            </div>
                                        ))}
                                        {filteredStaff.length === 0 && (
                                            <div className="p-8 text-center text-slate-500">No staff users found.</div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Delete Confirmations */}
            <ConfirmationModal isOpen={!!deletingStudent} onClose={() => setDeletingStudent(null)} onConfirm={handleDeleteStudent} title="Delete Student" message={`Are you sure you want to delete ${deletingStudent?.name}?`} confirmText="Delete" type="danger" isProcessing={isProcessing} />
            <ConfirmationModal isOpen={!!deletingStaff} onClose={() => setDeletingStaff(null)} onConfirm={handleDeleteStaff} title="Delete Staff" message={`Are you sure you want to delete ${deletingStaff?.name}?`} confirmText="Delete" type="danger" isProcessing={isProcessing} />
            <ConfirmationModal isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} onConfirm={confirmResetODUsage} title="Reset All Student ODs?" message="This will clear the OD usage count for EVERY student in the database." confirmText="Yes, Reset All" type="danger" isProcessing={isProcessing} />

            {/* Student Modal */}
            {showStudentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">{editingStudent ? 'Edit Student' : 'Add Student'}</h3>
                            <button onClick={() => setShowStudentModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveStudent} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Name *</label><input required value={studentForm.name} onChange={e=>setStudentForm({...studentForm, name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Roll No *</label><input required value={studentForm.rollNo} onChange={e=>setStudentForm({...studentForm, rollNo: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Email *</label><input required type="email" value={studentForm.email} onChange={e=>setStudentForm({...studentForm, email: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Phone *</label><input required value={studentForm.phone} onChange={e=>setStudentForm({...studentForm, phone: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent" /></div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Class *</label><input required placeholder="e.g. CSE-B" value={studentForm.class} onChange={e=>setStudentForm({...studentForm, class: e.target.value.toUpperCase()})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Section *</label><input required value={studentForm.section} onChange={e=>setStudentForm({...studentForm, section: e.target.value.toUpperCase()})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Department *</label><input required value={studentForm.department} onChange={e=>setStudentForm({...studentForm, department: e.target.value.toUpperCase()})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent" /></div>
                            </div>
                            
                            <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-white">
                                <button type="button" onClick={() => setShowStudentModal(false)} className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                                <button type="submit" disabled={isProcessing} className="px-6 py-2 bg-cse-accent text-white rounded-lg font-bold hover:bg-cse-accent/90 disabled:opacity-50">{isProcessing ? <Loader2 className="animate-spin" /> : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal */}
            {showBulkModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-in">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">Bulk Import Students</h3>
                            <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50 relative group hover:border-cse-accent/50 transition-colors">
                                <FileSpreadsheet size={32} className="mx-auto text-slate-400 group-hover:text-cse-accent mb-3" />
                                <p className="font-bold text-slate-700 mb-1">Upload Excel (.xlsx) or CSV file</p>
                                <p className="text-xs text-slate-500 mb-4">Required columns: Name, RollNo, Email, Class, Section, Department, Phone.</p>
                                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} ref={fileInputRef} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600">Select File</button>
                            </div>
                            {bulkError && <p className="mt-4 text-sm text-red-600 font-medium bg-red-50 p-3 rounded-lg">{bulkError}</p>}
                            {bulkData.length > 0 && (
                                <div className="mt-6">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-slate-800">Preview ({bulkData.length} students found)</h4>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500 sticky top-0">
                                                <tr><th className="px-4 py-2 font-semibold">Name</th><th className="px-4 py-2 font-semibold">Roll No</th><th className="px-4 py-2 font-semibold">Class</th><th className="px-4 py-2 font-semibold">Section</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {bulkData.slice(0, 50).map((s, i) => (
                                                    <tr key={i}>
                                                        <td className="px-4 py-2 font-medium">{s.name}</td>
                                                        <td className="px-4 py-2">{s.rollNo}</td>
                                                        <td className="px-4 py-2">{s.className}</td>
                                                        <td className="px-4 py-2">{s.section}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {bulkData.length > 50 && <div className="p-3 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-100">Showing first 50 entries...</div>}
                                    </div>
                                    <div className="mt-6 flex justify-end gap-3">
                                        <button onClick={() => { setBulkData([]); if(fileInputRef.current) fileInputRef.current.value=''; }} className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100">Clear</button>
                                        <button onClick={handleBulkSubmit} disabled={isProcessing} className="px-6 py-2 bg-cse-accent text-white rounded-lg font-bold flex items-center gap-2 hover:bg-cse-accent/90 disabled:opacity-50">
                                            {isProcessing ? <Loader2 className="animate-spin" /> : <Upload size={16} />} Import All
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Staff Modal */}
            {showStaffModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">{editingStaff ? 'Edit Staff' : 'Add Staff'}</h3>
                            <button onClick={() => setShowStaffModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveStaff} className="p-6 space-y-4">
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">Name *</label><input required value={staffForm.name} onChange={e=>setStaffForm({...staffForm, name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent" /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">Email *</label><input required type="email" value={staffForm.email} onChange={e=>setStaffForm({...staffForm, email: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Profession *</label>
                                    <select required value={staffForm.role} onChange={e=>setStaffForm({...staffForm, role: e.target.value, department: ['FACULTY', 'HOD'].includes(e.target.value) ? staffForm.department : ''})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent">
                                        {STAFF_ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                                    </select>
                                </div>
                                {['FACULTY', 'HOD'].includes(staffForm.role) && (
                                    <div><label className="block text-xs font-bold text-slate-500 mb-1">Department *</label><input required value={staffForm.department} onChange={e=>setStaffForm({...staffForm, department: e.target.value.toUpperCase()})} placeholder="e.g. CSE" className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent" /></div>
                                )}
                            </div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">Password {editingStaff && '(leave blank to keep current)'} *</label><input required={!editingStaff} type="password" value={staffForm.password} onChange={e=>setStaffForm({...staffForm, password: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent" /></div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowStaffModal(false)} className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                                <button type="submit" disabled={isProcessing} className="px-6 py-2 bg-cse-accent text-white rounded-lg font-bold hover:bg-cse-accent/90 disabled:opacity-50">{isProcessing ? <Loader2 className="animate-spin" /> : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
    </Layout>
  );
};

export default ManageStudents;
