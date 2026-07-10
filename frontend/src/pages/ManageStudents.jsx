import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    ChevronRight,
    ShieldCheck,
    UserCheck,
    UserX,
    ArrowLeft,
    Search,
    Loader2,
    Home
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { UserRole } from '../types';
import Navbar from '../components/Navbar';
import ConfirmationModal from '../components/ConfirmationModal';
import { STUDENTS } from '../studentData';
import { formatRollNo, formatStudentNameWithRoll, fallbackValue } from '../utils/formatters';

const ManageStudents = () => {
    const { currentUser, students, loading } = useAppContext();
    const navigate = useNavigate();
    const [selectedClass, setSelectedClass] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [togglingId, setTogglingId] = useState(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    // Redirect if not logged in or not staff
    useEffect(() => {
        if (!currentUser) {
            navigate('/');
        } else {
            const isStaff = [UserRole.FACULTY, UserRole.HOD, UserRole.IQAC_TEAM].includes(currentUser.role);
            if (!isStaff) {
                navigate('/dashboard');
            }
        }
    }, [currentUser, navigate]);

    if (!currentUser) {
        return null;
    }

    // Only allow faculty, hod, principal, iqac
    const isStaff = [UserRole.FACULTY, UserRole.HOD, UserRole.IQAC_TEAM].includes(currentUser.role);
    if (!isStaff) {
        return null;
    }

    // Merge Firebase students with static studentData
    // Firebase students take precedence, and include all Firebase students (CSE D)
    const mergedStudents = [];
    const seenIds = new Set();
    
    const getDeptFromClass = (cls) => {
        if (!cls) return null;
        const normalized = cls.toUpperCase();
        if (normalized.includes('CSE')) return 'CSE';
        if (normalized.includes('ECE')) return 'ECE';
        if (normalized.includes('CCE')) return 'CCE';
        if (normalized.includes('CSBS')) return 'CSBS';
        if (normalized.includes('MECH')) return 'MECH';
        if (normalized.includes('CYBER')) return 'Cyber';
        if (normalized.includes('EEE')) return 'EEE';
        if (normalized.includes('AIML')) return 'AIML';
        if (normalized.includes('AI&DS') || normalized.includes('AIDS')) return 'AI&DS';
        if (normalized.includes('IT')) return 'IT';
        return null;
    };

    // First, add all Firebase students
    students.forEach(s => {
        const normalizedClass = s.class?.replace(/-/g, ' ') || 'Unknown Class';
        const dept = s.department || getDeptFromClass(normalizedClass);
        mergedStudents.push({ ...s, class: normalizedClass, department: dept });
        seenIds.add(s.id);
    });
    
    // Then add any students from STUDENTS that aren't in Firebase
    STUDENTS.forEach(s => {
        if (!seenIds.has(s.id)) {
            const normalizedClass = s.class?.replace(/-/g, ' ') || 'Unknown Class';
            const dept = s.department || getDeptFromClass(normalizedClass);
            mergedStudents.push({ ...s, class: normalizedClass, department: dept });
        }
    });

    // Filter students based on role-based department restriction
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
            // Handle AI&DS / AIDS mapping
            if (uDept === 'AI&DS' || uDept === 'AIDS') {
                return sDept === 'AI&DS' || sDept === 'AIDS';
            }
            return sDept === uDept;
        })
        : mergedStudents;

    // Group by class first
    const classMap = {};
    accessibleStudents.forEach(student => {
        const cls = student.class || 'Unknown Class';
        if (!classMap[cls]) classMap[cls] = [];
        classMap[cls].push(student);
    });

    // Filter to show all classes that have students
    const classes = Object.keys(classMap).sort();
    
    // Get students for selected class
    const classStudents = selectedClass && classMap[selectedClass] ? classMap[selectedClass] : [];
    
    // Filter students by search query
    const filteredClassStudents = classStudents.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        formatRollNo(s.rollNo, s.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleToggleOrganizer = async (student) => {
        setTogglingId(student.id);
        const newRole = student.role === UserRole.STUDENT_ORGANIZER
            ? UserRole.STUDENT_GENERAL
            : UserRole.STUDENT_ORGANIZER;
        const isApprovedOrganizer = newRole === UserRole.STUDENT_ORGANIZER;
        // Convert display format "CSE B" → Firestore path format "CSE-B"
        const className = (student.class || '').replace(/\s+/g, '-');
        try {
            const res = await fetch(`https://event-management-system-dpzc.onrender.com/api/students/${student.id}/role`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
                },
                body: JSON.stringify({ role: newRole, className, isApprovedOrganizer }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
        } catch (err) {
            console.error('Error updating student role:', err);
        } finally {
            setTogglingId(null);
        }
    };

    const handleUpdateODStats = async (student, field, value) => {
        if (currentUser.role !== UserRole.IQAC_TEAM) {
            console.error('Only IQAC members can modify OD stats.');
            return;
        }
        setTogglingId(`${student.id}-${field}`);
        const className = (student.class || '').replace(/\s+/g, '-');
        try {
            const res = await fetch(`https://event-management-system-dpzc.onrender.com/api/students/${student.id}/od-stats`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
                },
                body: JSON.stringify({ className, [field]: value }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
        } catch (err) {
            console.error('Error updating OD stats:', err);
        } finally {
            setTogglingId(null);
        }
    };

    const handleResetODUsage = async () => {
        setShowResetConfirm(true);
    };

    const confirmResetODUsage = async () => {
        setIsResetting(true);
        try {
            const res = await fetch('https://event-management-system-dpzc.onrender.com/api/students/reset-od-usage', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
                }
            });
            const data = await res.json();
            if (data.success) {
                window.location.reload();
            } else throw new Error(data.message);
        } catch (err) {
            console.error('Reset failed:', err);
        } finally {
            setIsResetting(false);
            setShowResetConfirm(false);
        }
    };

    // Get class-specific stats - count all students
    const totalInClass = selectedClass ? classMap[selectedClass].length : accessibleStudents.length;
    const organizersInClass = selectedClass 
        ? classMap[selectedClass].filter(s => s.role === UserRole.STUDENT_ORGANIZER).length
        : accessibleStudents.filter(s => s.role === UserRole.STUDENT_ORGANIZER).length;

    return (
        <div className="h-screen flex flex-row overflow-hidden bg-[#f8fafc]">
            <Navbar />

            <main className="flex-1 flex flex-col min-h-0 relative">
                {/* Header (Sticky) */}
                <div className="bg-[#f8fafc] border-b border-slate-200 px-6 py-6 z-30 shrink-0">
                    <div className="max-w-5xl mx-auto w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900">Manage Students</h2>
                            <p className="text-slate-500 mt-1">
                                {selectedClass ? `Viewing students in ${selectedClass}` : 'Select a class to manage students'}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 md:order-2">
                            {currentUser.role === UserRole.IQAC_TEAM && (
                                <button onClick={handleResetODUsage} className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl font-bold text-sm hover:bg-rose-100 transition-all flex items-center gap-2">
                                    <UserX size={16} /> Reset All OD Usage
                                </button>
                            )}
                            {selectedClass ? (
                                <button
                                    onClick={() => {
                                        setSelectedClass(null);
                                        setSearchQuery('');
                                    }}
                                    className="btn-secondary whitespace-nowrap flex items-center gap-2"
                                >
                                    <ArrowLeft size={16} />
                                    Back to Classes
                                </button>
                            ) : (
                                <button onClick={() => navigate('/dashboard')} className="btn-secondary whitespace-nowrap">
                                    Back to Dashboard
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-8">
                    <div className="max-w-5xl mx-auto w-full">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-cse-accent" size={36} />
                    </div>
                ) : !selectedClass ? (
                    // CLASS SELECTION VIEW
                    <>
                        {/* Stats Summary */}
                        <div className="grid grid-cols-3 gap-4 mb-8">
                            {[
                                { label: 'Total Classes', value: classes.length, color: 'text-blue-600', bg: 'bg-blue-50' },
                                { label: 'Total Students', value: totalInClass, color: 'text-purple-600', bg: 'bg-purple-50' },
                                { label: 'Event Organizers', value: organizersInClass, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                            ].map((stat, i) => (
                                <div key={i} className="glass-panel p-4 rounded-2xl flex items-center gap-4">
                                    <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center`}>
                                        <Users size={20} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{stat.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Classes Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {classes.map(cls => {
                                const classStudents = classMap[cls];
                                const organizersInThisClass = classStudents.filter(s => s.role === UserRole.STUDENT_ORGANIZER).length;
                                
                                return (
                                    <button
                                        key={cls}
                                        onClick={() => {
                                            setSelectedClass(cls);
                                            setSearchQuery('');
                                        }}
                                        className="glass-panel p-6 rounded-2xl hover:bg-slate-50/80 transition-all hover:shadow-md group"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="text-left">
                                                <h3 className="font-bold text-lg text-slate-900 group-hover:text-cse-accent transition-colors">
                                                    {cls}
                                                </h3>
                                                <div className="mt-2 space-y-1">
                                                    <p className="text-sm text-slate-600">
                                                        <span className="font-semibold">{classStudents.length}</span> students
                                                    </p>
                                                    {organizersInThisClass > 0 && (
                                                        <p className="text-sm text-emerald-600">
                                                            <span className="font-semibold">{organizersInThisClass}</span> organizer{organizersInThisClass > 1 ? 's' : ''}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <ChevronRight size={24} className="text-slate-300 group-hover:text-cse-accent transition-colors" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    // STUDENTS VIEW (Class Selected)
                    <>
                        {/* Search Bar */}
                        <div className="relative mb-6">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by name or roll number..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cse-accent/30 focus:border-cse-accent transition-all"
                            />
                        </div>

                        {/* Stats Summary */}
                        <div className="grid grid-cols-3 gap-4 mb-8">
                            {[
                                { label: 'Total Students', value: totalInClass, color: 'text-blue-600', bg: 'bg-blue-50' },
                                { label: 'Event Organizers', value: organizersInClass, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                { label: 'Regular Students', value: totalInClass - organizersInClass, color: 'text-purple-600', bg: 'bg-purple-50' },
                            ].map((stat, i) => (
                                <div key={i} className="glass-panel p-4 rounded-2xl flex items-center gap-4">
                                    <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center`}>
                                        <Users size={20} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{stat.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Student List */}
                        {filteredClassStudents.length === 0 ? (
                            <div className="glass-panel rounded-2xl p-12 text-center">
                                <Users size={40} className="mx-auto text-slate-300 mb-4" />
                                <p className="text-slate-500 font-medium">
                                    {searchQuery ? 'No students match your search.' : `No students found in ${selectedClass}.`}
                                </p>
                            </div>
                        ) : (
                            <div className="glass-panel rounded-2xl overflow-hidden">
                                <div className="divide-y divide-slate-100">
                                    {filteredClassStudents.map(student => {
                                        const isOrganizer = student.role === UserRole.STUDENT_ORGANIZER;
                                        const isToggling = togglingId === student.id || (typeof togglingId === 'string' && togglingId.startsWith(student.id));
                                        return (
                                            <div
                                                key={student.id}
                                                className="px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm shrink-0 border border-slate-200">
                                                        {student.name.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-slate-900 text-sm truncate">
                                                            {formatStudentNameWithRoll(student.name, student.rollNo, student.id)}
                                                        </p>
                                                        <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                                                            {fallbackValue(student.department, 'department')} · {fallbackValue(student.class, 'general')}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-4">
                                                    {/* OD Stats View/Edit (Visible to Staff/IQAC) */}
                                                    <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm">
                                                        <div className="px-2 py-0.5 text-center relative">
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">Used</p>
                                                            {togglingId === `${student.id}-odUsed` ? (
                                                                <Loader2 size={10} className="animate-spin mx-auto text-cse-accent" />
                                                            ) : (
                                                                <input 
                                                                    type="number" 
                                                                    className={`w-10 text-center text-xs font-bold bg-slate-50 rounded border-0 p-0 focus:ring-1 focus:ring-cse-accent ${currentUser.role !== UserRole.IQAC_TEAM ? 'cursor-not-allowed text-slate-400' : ''}`}
                                                                    defaultValue={student.odUsed || 0}
                                                                    readOnly={currentUser.role !== UserRole.IQAC_TEAM}
                                                                    onBlur={(e) => {
                                                                        if (currentUser.role === UserRole.IQAC_TEAM && Number(e.target.value) !== (student.odUsed || 0)) {
                                                                            handleUpdateODStats(student, 'odUsed', e.target.value);
                                                                        }
                                                                    }}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="text-slate-300 text-lg">/</div>
                                                        <div className="px-2 py-0.5 text-center relative">
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">Limit</p>
                                                            {togglingId === `${student.id}-odLimit` ? (
                                                                <Loader2 size={10} className="animate-spin mx-auto text-emerald-500" />
                                                            ) : (
                                                                <input 
                                                                    type="number" 
                                                                    className={`w-10 text-center text-xs font-bold bg-slate-50 rounded border-0 p-0 focus:ring-1 focus:ring-emerald-500 ${currentUser.role !== UserRole.IQAC_TEAM ? 'cursor-not-allowed text-slate-400' : ''}`}
                                                                    defaultValue={student.odLimit || 7}
                                                                    readOnly={currentUser.role !== UserRole.IQAC_TEAM}
                                                                    onBlur={(e) => {
                                                                        if (currentUser.role === UserRole.IQAC_TEAM && Number(e.target.value) !== (student.odLimit || 7)) {
                                                                            handleUpdateODStats(student, 'odLimit', e.target.value);
                                                                        }
                                                                    }}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {/* Role Badge */}
                                                        <span className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${isOrganizer
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                            }`}>
                                                            {isOrganizer ? (
                                                                <><ShieldCheck size={12} /> Organizer</>
                                                            ) : (
                                                                'General'
                                                            )}
                                                        </span>

                                                        {/* Toggle Button */}
                                                        {(currentUser.role === UserRole.HOD || currentUser.role === UserRole.FACULTY || currentUser.role === UserRole.IQAC_TEAM) && (
                                                            <button
                                                                onClick={() => handleToggleOrganizer(student)}
                                                                disabled={isToggling}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-60 shadow-sm ${isOrganizer
                                                                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'
                                                                    : 'bg-cse-accent text-white hover:bg-cse-accent/90 border border-transparent'
                                                                    }`}
                                                            >
                                                                {isToggling ? (
                                                                    <Loader2 size={12} className="animate-spin" />
                                                                ) : isOrganizer ? (
                                                                    <><UserX size={12} /> Revoke</>
                                                                ) : (
                                                                    <><UserCheck size={12} /> Make Organizer</>
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}
                    </div>
                </div>
            </main>

            <ConfirmationModal
                isOpen={showResetConfirm}
                onClose={() => setShowResetConfirm(false)}
                onConfirm={confirmResetODUsage}
                title="Reset All Student ODs?"
                message="This will clear the OD usage count for EVERY student in the database. This action is irreversible and should only be done at the start of a new semester."
                confirmText="Yes, Reset All"
                type="danger"
                isProcessing={isResetting}
            />
        </div>
    );
};

export default ManageStudents;
