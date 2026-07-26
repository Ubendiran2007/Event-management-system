import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, FileText, Activity, Loader2, Calendar } from 'lucide-react';
import Layout from '../components/Layout';
import { useAppContext } from '../context/AppContext';
import { UserRole } from '../types';
import DataTable from '../components/DataTable';
import { usePaginatedApi } from '../hooks/usePaginatedApi';
import StatusBadge from '../components/StatusBadge';

const EventTracking = () => {
    const { currentUser } = useAppContext();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    const assignedClasses = currentUser?.assignedClasses || [];

    // Redirect if not a faculty with assigned classes
    if (!currentUser || currentUser.role !== UserRole.FACULTY || !currentUser.assignedClasses || currentUser.assignedClasses.length === 0) {
        return (
            <Layout>
                <div className="flex-1 p-8 text-center text-slate-500 flex flex-col items-center justify-center min-h-0 relative">
                    <Activity size={48} className="text-slate-300 mb-4" />
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">No Access</h2>
                    <p>You must be assigned as a Class Advisor to view this page.</p>
                    <button onClick={() => navigate('/dashboard')} className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold">Go Back</button>
                </div>
            </Layout>
        );
    }

    const filters = useMemo(() => {
        // Pass the first assigned class for now, or you could support multiple classes
        // The backend `class` filter handles one class. If they have multiple, they'd need a dropdown
        // For simplicity we will query all approved requests for the first assigned class.
        return {
            status: 'APPROVED',
            class: assignedClasses[0] // Uses the first class
        };
    }, [assignedClasses]);

    const { data, loading, pagination, actions } = usePaginatedApi('/api/od-requests', filters, { limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });

    // Filter by search query client side for simplicity on the current page if backend search isn't available
    const displayData = useMemo(() => {
        if (!searchQuery) return data;
        const q = searchQuery.toLowerCase();
        return data.filter(d => 
            (d.eventTitle || '').toLowerCase().includes(q) ||
            (d.studentName || '').toLowerCase().includes(q) ||
            (d.rollNo || '').toLowerCase().includes(q)
        );
    }, [data, searchQuery]);

    const columns = [
        {
            key: 'event',
            label: 'EVENT DETAILS',
            render: (req) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                        <Calendar size={18} />
                    </div>
                    <div>
                        <p className="font-bold text-slate-900 text-sm">{req.eventTitle || 'Unknown Event'}</p>
                        <p className="text-xs text-slate-500">{req.eventDate || 'No date'}</p>
                    </div>
                </div>
            )
        },
        {
            key: 'student',
            label: 'STUDENT',
            render: (req) => (
                <div>
                    <p className="font-bold text-slate-800 text-sm">{req.studentName}</p>
                    <div className="flex items-center gap-2 text-xs mt-0.5">
                        <span className="font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{req.rollNo}</span>
                        <span className="text-slate-500 font-medium">{req.class}</span>
                    </div>
                </div>
            )
        },
        {
            key: 'status',
            label: 'REGISTRATION',
            render: (req) => <StatusBadge status={req.status} />
        },
        {
            key: 'attendance',
            label: 'ATTENDANCE',
            render: (req) => {
                const isPresent = req.attendanceStatus === 'PRESENT';
                const isAbsent = req.attendanceStatus === 'ABSENT';
                
                return (
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${isPresent ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isAbsent ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {isPresent ? 'Present' : isAbsent ? 'Absent' : 'Pending'}
                    </span>
                );
            }
        }
    ];

    return (
        <Layout>
            <div className="flex-1 flex flex-col min-h-0 relative bg-[#f8fafc]">
                {/* Header */}
                <div className="border-b border-slate-200 px-6 pt-6 pb-6 bg-white z-10 shrink-0">
                    <div className="max-w-6xl mx-auto w-full">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight flex items-center gap-2">
                                    <Activity className="text-blue-600" size={28} />
                                    Event Tracking
                                </h2>
                                <p className="text-slate-500 mt-1 text-sm font-medium">Monitor participation for: <span className="font-bold text-slate-700">{assignedClasses.join(', ')}</span></p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5 shadow-sm">
                                    <ChevronLeft size={16} /> Back
                                </button>
                                <button className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-sm">
                                    <FileText size={16} /> Export View
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 min-h-0">
                    <div className="max-w-6xl mx-auto w-full h-full flex flex-col min-h-0">
                        <DataTable 
                            columns={columns}
                            data={displayData}
                            loading={loading}
                            pagination={pagination}
                            onNextPage={actions.nextPage}
                            onPrevPage={actions.prevPage}
                            hasPrevPage={pagination.hasPrevPage}
                            onSearch={setSearchQuery}
                            searchPlaceholder="Search event or student..."
                        />
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default EventTracking;
