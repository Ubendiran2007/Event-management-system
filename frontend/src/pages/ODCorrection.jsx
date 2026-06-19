import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    AlertCircle, 
    CheckCircle2, 
    Clock, 
    FileText, 
    ArrowLeft, 
    Send, 
    ShieldCheck, 
    XCircle, 
    Loader2,
    MessageSquare,
    User,
    ChevronRight,
    HelpCircle
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { UserRole } from '../types';
import Navbar from '../components/Navbar';

const ODCorrection = () => {
    const { currentUser } = useAppContext();
    const navigate = useNavigate();
    
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [processingId, setProcessingId] = useState(null);
    
    // New Request Form
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        description: '',
        requestedCount: currentUser?.odUsed || 0,
        requestedLimit: currentUser?.odLimit || 7
    });

    const isStudent = currentUser?.role === UserRole.STUDENT_GENERAL || currentUser?.role === UserRole.STUDENT_ORGANIZER;
    const isStaff = [UserRole.FACULTY, UserRole.HOD, UserRole.IQAC_TEAM].includes(currentUser?.role);

    useEffect(() => {
        if (!currentUser) {
            navigate('/');
            return;
        }
        fetchRequests();
    }, [currentUser]);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const res = await fetch(`http://localhost:5001/api/correction-requests?role=${currentUser.role}&department=${currentUser.department}&userId=${currentUser.id}`);
            const data = await res.json();
            if (data.success) setRequests(data.requests);
        } catch (err) {
            console.error('Failed to fetch requests:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('http://localhost:5001/api/correction-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: currentUser.id,
                    studentName: currentUser.name,
                    rollNo: currentUser.rollNo,
                    className: currentUser.className,
                    department: currentUser.department,
                    ...formData
                })
            });
            const data = await res.json();
            if (data.success) {
                setShowForm(false);
                setFormData({ description: '', requestedCount: currentUser.odUsed, requestedLimit: currentUser.odLimit });
                fetchRequests();
            }
        } catch (err) {
            console.error('Failed to submit request:', err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAction = async (requestId, status) => {
        const remarks = `${status} by ${currentUser.name}`;

        setProcessingId(requestId);
        try {
            const res = await fetch(`http://localhost:5001/api/correction-requests/${requestId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status,
                    remarks,
                    approvedBy: currentUser.name,
                    role: currentUser.role
                })
            });
            const data = await res.json();
            if (data.success) {
                fetchRequests();
            }
        } catch (err) {
            console.error('Failed to update request:', err.message);
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            
            <main className="max-w-4xl mx-auto px-6 py-10">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">OD Count Corrections</h1>
                        <p className="text-slate-500 mt-1 font-medium">Manage and track OD participation adjustments</p>
                    </div>
                    {isStudent && !showForm && (
                        <button 
                            onClick={() => setShowForm(true)}
                            className="bg-cse-accent text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-cse-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                        >
                            <Send size={18} /> New Request
                        </button>
                    )}
                    <button onClick={() => navigate('/dashboard')} className="text-slate-500 hover:text-slate-800 font-bold flex items-center gap-2 transition-colors">
                        <ArrowLeft size={18} /> Back
                    </button>
                </div>

                {showForm && (
                    <div className="glass-panel p-8 rounded-3xl mb-10 border-2 border-cse-accent/10 animate-in fade-in slide-in-from-top-4 duration-500">
                        <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <FileText className="text-cse-accent" /> Submit Correction Request
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Requested OD Used Count</label>
                                    <input 
                                        type="number"
                                        required
                                        value={formData.requestedCount}
                                        onChange={e => setFormData({...formData, requestedCount: e.target.value})}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cse-accent/20 focus:border-cse-accent outline-none font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Requested OD Limit</label>
                                    <input 
                                        type="number"
                                        required
                                        value={formData.requestedLimit}
                                        onChange={e => setFormData({...formData, requestedLimit: e.target.value})}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Reason / Description</label>
                                <textarea 
                                    required
                                    rows="4"
                                    placeholder="Briefly explain why you need this correction..."
                                    value={formData.description}
                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cse-accent/20 focus:border-cse-accent outline-none font-medium"
                                ></textarea>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button 
                                    type="submit" 
                                    disabled={submitting}
                                    className="bg-cse-accent text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 flex items-center gap-2"
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />} 
                                    Submit to Faculty
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-8 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Loader2 className="animate-spin mb-4" size={40} />
                            <p className="font-bold">Loading requests...</p>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="glass-panel p-16 rounded-3xl text-center border-2 border-dashed border-slate-200">
                            <HelpCircle size={48} className="mx-auto text-slate-300 mb-4" />
                            <h3 className="text-xl font-bold text-slate-900">No requests found</h3>
                            <p className="text-slate-500 mt-2">Any OD correction requests will appear here.</p>
                        </div>
                    ) : (
                        requests.map(req => (
                            <div key={req.id} className="glass-panel p-6 rounded-3xl border border-slate-200 hover:border-cse-accent/30 transition-all shadow-sm group">
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                                                {req.studentName.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900">{req.studentName}</h4>
                                                <p className="text-xs text-slate-500 font-bold font-mono tracking-wider">{req.rollNo} • {req.className}</p>
                                            </div>
                                            <div className={`ml-auto px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border ${
                                                req.status.includes('PENDING') ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                req.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                'bg-red-50 text-red-600 border-red-100'
                                            }`}>
                                                {req.status.replace(/_/g, ' ')}
                                            </div>
                                        </div>
                                        
                                        <div className="bg-slate-50/80 rounded-2xl p-4 mb-4 border border-slate-100">
                                            <p className="text-sm text-slate-700 font-medium leading-relaxed italic">"{req.description}"</p>
                                        </div>

                                        <div className="flex flex-wrap gap-4 text-xs font-bold">
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <Clock size={14} /> {new Date(req.createdAt).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                                                <FileText size={14} /> Requested: {req.requestedCount} Used / {req.requestedLimit} Limit
                                            </div>
                                        </div>
                                    </div>

                                    {isStaff && req.status.includes(currentUser.role.replace('_TEAM', '')) && (
                                        <div className="flex flex-row md:flex-col gap-2 justify-end min-w-[140px]">
                                            <button 
                                                onClick={() => handleAction(req.id, 'APPROVED')}
                                                disabled={processingId === req.id}
                                                className="flex-1 bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20"
                                            >
                                                {processingId === req.id ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                                Approve
                                            </button>
                                            <button 
                                                onClick={() => handleAction(req.id, 'REJECTED')}
                                                disabled={processingId === req.id}
                                                className="flex-1 bg-red-50 text-red-500 px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-all"
                                            >
                                                <XCircle size={16} /> Reject
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Timeline / History */}
                                <div className="mt-6 pt-6 border-t border-slate-100">
                                    <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        <MessageSquare size={12} /> Status Timeline
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        {req.history.map((h, i) => (
                                            <div key={i} className="flex items-center gap-2 text-[11px] font-bold text-slate-500 bg-white border border-slate-100 px-3 py-1.5 rounded-xl shadow-sm">
                                                <span className={`w-2 h-2 rounded-full ${h.status.includes('REJECTED') ? 'bg-red-400' : h.status === 'COMPLETED' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                                                {h.status.replace(/_/g, ' ')} by {h.user}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
};

export default ODCorrection;
