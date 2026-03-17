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
import { STUDENTS } from '../studentData';

const ManageStudents = () => {
    const { currentUser, students, loading } = useAppContext();
    const navigate = useNavigate();
    const [selectedClass, setSelectedClass] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [togglingId, setTogglingId] = useState(null);

    // Redirect if not logged in or not staff
    useEffect(() => {
        if (!currentUser) {
            navigate('/');
        } else {
            const isStaff = [UserRole.FACULTY, UserRole.HOD, UserRole.PRINCIPAL].includes(currentUser.role);
            if (!isStaff) {
                navigate('/dashboard');
            }
        }
    }, [currentUser, navigate]);

    if (!currentUser) {
        return null;
    }

    // Only allow faculty, hod, principal
    const isStaff = [UserRole.FACULTY, UserRole.HOD, UserRole.PRINCIPAL].includes(currentUser.role);
    if (!isStaff) {
        return null;
    }

    // Merge Firebase students with static studentData
    // Firebase students take precedence, and include all Firebase students (CSE D)
    const mergedStudents = [];
    const seenIds = new Set();
    
    // First, add all Firebase students (includes CSE D from Firebase)
    students.forEach(s => {
        // Normalize class name format: "CSE-B" -> "CSE B"
        const normalizedClass = s.class?.replace(/-/g, ' ') || 'Unknown Class';
        mergedStudents.push({ ...s, class: normalizedClass });
        seenIds.add(s.id);
    });
    
    // Then add any students from STUDENTS that aren't in Firebase
    STUDENTS.forEach(s => {
        if (!seenIds.has(s.id)) {
            mergedStudents.push(s);
        }
    });

    // Group by class first
    const classMap = {};
    mergedStudents.forEach(student => {
        const cls = student.class || 'Unknown Class';
        if (!classMap[cls]) classMap[cls] = [];
        classMap[cls].push(student);
    });

    // Filter to only show CSE-B and CSE-D classes
    const availableClasses = ['CSE B', 'CSE D'];
    const classes = Object.keys(classMap)
        .filter(cls => availableClasses.includes(cls))
        .sort();
    
    // Get students for selected class
    const classStudents = selectedClass && classMap[selectedClass] ? classMap[selectedClass] : [];
    
    // Filter students by search query
    const filteredClassStudents = classStudents.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.rollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
            const res = await fetch(`http://localhost:5001/api/students/${student.id}/role`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole, className, isApprovedOrganizer }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            // AppContext real-time listener will auto-update students state
        } catch (err) {
            console.error('Error updating student role:', err);
        } finally {
            setTogglingId(null);
        }
    };

    // Get class-specific stats - only count CSE-B and CSE-D
    const filteredStudents = mergedStudents.filter(s => availableClasses.includes(s.class));
    const totalInClass = selectedClass ? classMap[selectedClass].length : filteredStudents.length;
    const organizersInClass = selectedClass 
        ? classMap[selectedClass].filter(s => s.role === UserRole.STUDENT_ORGANIZER).length
        : filteredStudents.filter(s => s.role === UserRole.STUDENT_ORGANIZER).length;

    return (
        <div className="min-h-screen pb-20">
            <Navbar />

            <main className="max-w-5xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900">Manage Students</h2>
                        <p className="text-slate-500 mt-1">
                            {selectedClass ? `Viewing students in ${selectedClass}` : 'Select a class to manage students'}
                        </p>
                    </div>
                    <button onClick={() => navigate('/dashboard')} className="btn-secondary whitespace-nowrap md:order-2">
                        Back to Dashboard
                    </button>
                </div>

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
                                { label: 'Total Students', value: filteredStudents.length, color: 'text-purple-600', bg: 'bg-purple-50' },
                                { label: 'Event Organizers', value: filteredStudents.filter(s => s.role === UserRole.STUDENT_ORGANIZER).length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
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
                        {/* Back Button */}
                        <button
                            onClick={() => {
                                setSelectedClass(null);
                                setSearchQuery('');
                            }}
                            className="mb-6 px-4 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600 hover:text-slate-900 flex items-center gap-2 font-medium"
                        >
                            <ArrowLeft size={16} />
                            Back to Classes
                        </button>

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
                                        const isToggling = togglingId === student.id;
                                        return (
                                            <div
                                                key={student.id}
                                                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm shrink-0">
                                                        {student.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-900 text-sm">{student.name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-xs text-slate-400 font-mono">{student.rollNo}</span>
                                                            {student.email && (
                                                                <>
                                                                    <span className="text-slate-200">•</span>
                                                                    <span className="text-xs text-slate-400">{student.email}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 pl-13 sm:pl-0">
                                                    {/* Role Badge */}
                                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${isOrganizer
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                        : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                        {isOrganizer ? (
                                                            <><ShieldCheck size={12} /> Organizer</>
                                                        ) : (
                                                            'General'
                                                        )}
                                                    </span>

                                                    {/* Toggle Button */}
                                                    <button
                                                        onClick={() => handleToggleOrganizer(student)}
                                                        disabled={isToggling}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-60 ${isOrganizer
                                                            ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'
                                                            : 'bg-cse-accent text-white hover:bg-cse-accent/90'
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
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default ManageStudents;
