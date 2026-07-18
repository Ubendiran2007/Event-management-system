import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, Search, Users, Activity, Loader2, Printer, FileText, LayoutList } from 'lucide-react';
import Layout from '../components/Layout';
import { useAppContext } from '../context/AppContext';
import { UserRole } from '../types';
import * as XLSX from 'xlsx';

const EventTracking = () => {
    const { currentUser, events, odRequests, loading } = useAppContext();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedEventId, setExpandedEventId] = useState(null);

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

    const assignedClasses = currentUser.assignedClasses;

    // Filter OD Requests for APPROVED students in assigned classes
    const relevantRequests = useMemo(() => {
        if (!odRequests) return [];
        return odRequests.filter(req => 
            req.status === 'APPROVED' &&
            req.class && assignedClasses.includes(req.class)
        );
    }, [odRequests, assignedClasses]);

    // Group requests by event
    const eventStats = useMemo(() => {
        const stats = {};
        relevantRequests.forEach(req => {
            const eventId = req.eventId;
            if (!eventId) return;

            if (!stats[eventId]) {
                const eventObj = events.find(e => e.id === eventId);
                stats[eventId] = {
                    eventId,
                    eventTitle: req.eventTitle || eventObj?.title || 'Unknown Event',
                    organizer: eventObj?.organizerName || eventObj?.organizerEmail || 'Unknown Organizer',
                    date: req.eventDate || eventObj?.date || '',
                    requests: []
                };
            }
            stats[eventId].requests.push(req);
        });

        const sortedStats = Object.values(stats).sort((a, b) => new Date(b.date) - new Date(a.date));

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return sortedStats.filter(s => 
                s.eventTitle.toLowerCase().includes(q) || 
                s.organizer.toLowerCase().includes(q)
            );
        }

        return sortedStats;
    }, [relevantRequests, events, searchQuery]);

    const handleDownloadExcel = (eventId, eventTitle, requests) => {
        const data = requests.map((req, idx) => ({
            'S.No': idx + 1,
            'Roll No': req.rollNo,
            'Name': req.studentName,
            'Class': req.class,
            'Registration Status': req.status,
            'Attendance': req.attendanceStatus || 'Pending'
        }));
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Students");
        XLSX.writeFile(wb, `${eventTitle}_Tracking_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <Layout>
                <div className="flex-1 flex justify-center py-20 min-h-0 relative">
                    <Loader2 className="animate-spin text-blue-600" size={36} />
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="flex-1 flex flex-col min-h-0 relative">
                {/* Header */}
                <div className="bg-[#f8fafc] border-b border-slate-200 px-6 pt-6 z-30 shrink-0 print:hidden">
                    <div className="max-w-5xl mx-auto w-full">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight flex items-center gap-2">
                                    <Activity className="text-blue-600" size={28} />
                                    Event Tracking
                                </h2>
                                <p className="text-slate-500 mt-1 text-sm font-medium">Monitor participation for your assigned classes: <span className="font-bold text-slate-700">{assignedClasses.join(', ')}</span></p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => navigate('/dashboard')} className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-sm whitespace-nowrap">
                                    <ChevronLeft size={16} /> Back
                                </button>
                                <button onClick={handlePrint} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-all flex items-center gap-1.5 shadow-sm shadow-slate-200">
                                    <Printer size={16} /> Print Report
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-8">
                    <div className="max-w-5xl mx-auto w-full">
                        
                        {/* Search & Stats */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8 print:hidden">
                            <div className="relative w-full md:flex-1">
                                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search events or organizers..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-sm shadow-sm"
                                />
                            </div>
                            <div className="w-full md:w-auto min-w-[280px] p-4 rounded-2xl flex items-center gap-4 bg-white border border-slate-200 shadow-sm">
                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                                    <LayoutList size={24} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-900 leading-none mb-1">{eventStats.length}</p>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Active Events</p>
                                </div>
                            </div>
                        </div>

                        {/* Events List */}
                        <div className="space-y-4">
                            {eventStats.map(stat => {
                                const isExpanded = expandedEventId === stat.eventId;
                                const attendanceCount = stat.requests.filter(r => r.attendanceStatus === 'PRESENT').length;
                                const totalCount = stat.requests.length;

                                return (
                                    <div key={stat.eventId} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                        {/* Event Header - Click to expand */}
                                        <div 
                                            onClick={() => setExpandedEventId(isExpanded ? null : stat.eventId)}
                                            className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-lg text-slate-900 truncate">{stat.eventTitle}</h3>
                                                <p className="text-sm text-slate-500 mt-0.5">Organizer: <span className="font-medium text-slate-700">{stat.organizer}</span> • {new Date(stat.date).toLocaleDateString()}</p>
                                            </div>
                                            
                                            <div className="flex items-center gap-6">
                                                <div className="text-center px-4 border-r border-slate-100 hidden sm:block">
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Approved</p>
                                                    <p className="text-xl font-bold text-slate-800">{totalCount}</p>
                                                </div>
                                                <div className="text-center px-4">
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Attendance</p>
                                                    <div className="flex items-center justify-center gap-1 text-xl font-bold">
                                                        <span className="text-emerald-600">{attendanceCount}</span>
                                                        <span className="text-slate-300 text-sm">/</span>
                                                        <span className="text-slate-800">{totalCount}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className="border-t border-slate-100 bg-slate-50/50 p-5">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h4 className="font-bold text-slate-700">Student List</h4>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleDownloadExcel(stat.eventId, stat.eventTitle, stat.requests); }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors shadow-sm"
                                                        >
                                                            <Download size={14} /> Excel
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                                            <tr>
                                                                <th className="px-4 py-3 font-semibold">Roll No</th>
                                                                <th className="px-4 py-3 font-semibold">Name</th>
                                                                <th className="px-4 py-3 font-semibold">Class</th>
                                                                <th className="px-4 py-3 font-semibold">Reg Status</th>
                                                                <th className="px-4 py-3 font-semibold">Attendance</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {stat.requests.map(req => (
                                                                <tr key={req.id} className="hover:bg-slate-50/50">
                                                                    <td className="px-4 py-3 font-medium text-slate-700">{req.rollNo}</td>
                                                                    <td className="px-4 py-3 font-medium text-slate-900">{req.studentName}</td>
                                                                    <td className="px-4 py-3">
                                                                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">{req.class}</span>
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700">{req.status}</span>
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        {req.attendanceStatus === 'PRESENT' ? (
                                                                            <span className="text-emerald-600 font-bold flex items-center gap-1"><Users size={14}/> Present</span>
                                                                        ) : req.attendanceStatus === 'ABSENT' ? (
                                                                            <span className="text-rose-600 font-bold">Absent</span>
                                                                        ) : (
                                                                            <span className="text-slate-400 font-semibold italic">Pending</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            
                            {eventStats.length === 0 && (
                                <div className="p-12 text-center bg-white border border-slate-200 border-dashed rounded-3xl">
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <Search className="text-slate-300" size={32} />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-700 mb-1">No tracked events found</h3>
                                    <p className="text-sm text-slate-500">None of your assigned students have approved event registrations.</p>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
            
            {/* Print Styles */}
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .glass-panel, button, input { display: none !important; }
                    .space-y-4 > div { border: none !important; box-shadow: none !important; page-break-inside: avoid; margin-bottom: 20px; }
                    .space-y-4 > div > div { border: none !important; display: block !important; padding: 0 !important; }
                    .space-y-4 > div * { visibility: visible; }
                    .space-y-4 { position: absolute; left: 0; top: 0; width: 100%; }
                }
            `}</style>
        </Layout>
    );
};

export default EventTracking;
