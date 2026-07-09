import React, { useState, useEffect } from 'react';
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
    HelpCircle,
    Check,
    History,
    X,
    ChevronDown,
    ChevronUp,
    SlidersHorizontal
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useNotification } from '../context/NotificationContext';
import { UserRole } from '../types';
import Navbar from '../components/Navbar';
import { formatStudentNameWithRoll, fallbackValue } from '../utils/formatters';

const ODCorrection = () => {
    const { currentUser } = useAppContext();
    const navigate = useNavigate();
    const { showDialog, showToast } = useNotification();
    
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [processingId, setProcessingId] = useState(null);
    
    const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'approved', 'rejected'
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    
    // New Request Form
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        description: '',
        requestedCount: currentUser?.odUsed || 0,
        requestedLimit: currentUser?.odLimit || 7
    });

    // Action Modal State
    const [actionModal, setActionModal] = useState({ isOpen: false, requestId: null, action: null });
    const [actionData, setActionData] = useState({ comments: '', rejectionReason: '' });

    const [selectedRequest, setSelectedRequest] = useState(null);

    const isStudent = currentUser?.role === UserRole.STUDENT_GENERAL || currentUser?.role === UserRole.STUDENT_ORGANIZER;
    const isStaff = [UserRole.FACULTY, UserRole.HOD, UserRole.IQAC_TEAM].includes(currentUser?.role);

    useEffect(() => {
        if (!currentUser) {
            navigate('/');
            return;
        }

        const allowedRoles = [UserRole.STUDENT_GENERAL, UserRole.STUDENT_ORGANIZER, UserRole.FACULTY, UserRole.HOD, UserRole.IQAC_TEAM];
        if (!allowedRoles.includes(currentUser.role)) {
            navigate('/dashboard');
            return;
        }

        fetchRequests();
    }, [currentUser, activeTab]);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const viewParam = activeTab === 'pending' ? 'pending' : 'history';
            const res = await fetch(`http://localhost:5001/api/correction-requests?role=${currentUser.role}&department=${currentUser.department}&userId=${currentUser.id}&view=${viewParam}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
                }
            });
            const data = await res.json();
            if (data.success) {
                let filtered = data.requests;
                // Students get all requests back from backend. We filter them locally.
                // Staff get history from backend for history view, but we still need to filter approved vs rejected
                if (activeTab === 'pending') {
                    if (isStudent) {
                        filtered = filtered.filter(r => r.status !== 'COMPLETED' && r.status !== 'REJECTED');
                    }
                } else if (activeTab === 'approved') {
                    if (isStudent) {
                        filtered = filtered.filter(r => r.status === 'COMPLETED');
                    } else {
                        // For staff, approved means they approved it (so action was APPROVE in their decision)
                        const stage = { 'FACULTY': 'faculty', 'HOD': 'hod', 'IQAC_TEAM': 'iqac' }[currentUser.role];
                        filtered = filtered.filter(r => r[`${stage}Decision`]?.action === 'APPROVE');
                    }
                } else if (activeTab === 'rejected') {
                    if (isStudent) {
                        filtered = filtered.filter(r => r.status === 'REJECTED');
                    } else {
                        const stage = { 'FACULTY': 'faculty', 'HOD': 'hod', 'IQAC_TEAM': 'iqac' }[currentUser.role];
                        filtered = filtered.filter(r => r[`${stage}Decision`]?.action === 'REJECT');
                    }
                }
                
                // Sort by descending date
                filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setRequests(filtered);
            }
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
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
                },
                body: JSON.stringify({
                    studentId: currentUser.id,
                    studentName: currentUser.name,
                    rollNo: currentUser.rollNo,
                    className: currentUser.className,
                    department: currentUser.department,
                    currentOdUsed: currentUser.odUsed,
                    currentOdLimit: currentUser.odLimit,
                    ...formData
                })
            });
            const data = await res.json();
            if (data.success) {
                setShowForm(false);
                setFormData({ description: '', requestedCount: currentUser.odUsed, requestedLimit: currentUser.odLimit });
                setActiveTab('pending');
                fetchRequests();
            }
        } catch (err) {
            console.error('Failed to submit request:', err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const submitAction = async () => {
        if (actionModal.action === 'REJECT' && !actionData.rejectionReason.trim()) {
            await showDialog({
                title: 'Validation Error',
                message: 'Rejection reason is mandatory.',
                type: 'danger',
                hideCancel: true
            });
            return;
        }

        setProcessingId(actionModal.requestId);
        try {
            const res = await fetch(`http://localhost:5001/api/correction-requests/${actionModal.requestId}/status`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
                },
                body: JSON.stringify({
                    action: actionModal.action,
                    role: currentUser.role,
                    approverName: currentUser.name,
                    approverDept: currentUser.department,
                    comments: actionData.comments,
                    rejectionReason: actionData.rejectionReason
                })
            });
            const data = await res.json();
            if (data.success) {
                setActionModal({ isOpen: false, requestId: null, action: null });
                setActionData({ comments: '', rejectionReason: '' });
                showToast(`Request ${actionModal.action.toLowerCase()}ed successfully.`, 'success');
                fetchRequests();
            } else {
                await showDialog({
                    title: 'Operation Failed',
                    message: data.message || "Failed to process request",
                    type: 'danger',
                    hideCancel: true
                });
            }
        } catch (err) {
            console.error('Failed to update request:', err.message);
        } finally {
            setProcessingId(null);
        }
    };

    const openActionModal = (requestId, action) => {
        setActionModal({ isOpen: true, requestId, action });
        setActionData({ comments: '', rejectionReason: '' });
    };

    const getStatusBadge = (status) => {
        if (status === 'COMPLETED') return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Approved & Updated</span>;
        if (status === 'REJECTED') return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Rejected</span>;
        return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">{status.replace(/_/g, ' ')}</span>;
    };

    const renderTimelineItem = (title, decisionData, isPending = false, isRejected = false) => {
        if (!decisionData && !isPending && !isRejected) return null;
        
        const isApproved = decisionData?.action === 'APPROVE';
        const isSelfRejected = decisionData?.action === 'REJECT';
        
        let icon = <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center relative z-10 text-slate-400"><Clock size={12} /></div>;
        if (isApproved) icon = <div className="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center relative z-10 text-white"><Check size={12} /></div>;
        if (isSelfRejected || isRejected) icon = <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-white flex items-center justify-center relative z-10 text-white"><X size={12} /></div>;

        return (
            <div className="relative pl-8 pb-4 border-l-2 border-slate-100 last:border-0 last:pb-0">
                <div className="absolute -left-[13px] top-0">{icon}</div>
                <div className="flex flex-col">
                    <span className={`text-sm font-bold ${isApproved ? 'text-emerald-700' : isSelfRejected ? 'text-red-700' : isPending ? 'text-amber-600' : 'text-slate-500'}`}>
                        {title}
                    </span>
                    {decisionData && (
                        <div className="mt-1 bg-slate-50 rounded-lg p-3 text-xs text-slate-600 border border-slate-100">
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-slate-800">{decisionData.approverName} ({decisionData.approverDept})</span>
                                <span className="text-slate-400">{new Date(decisionData.decidedAt).toLocaleDateString()}</span>
                            </div>
                            {decisionData.comments && <p className="italic mt-1 text-slate-500">"{decisionData.comments}"</p>}
                            {decisionData.rejectionReason && (
                                <div className="mt-2 text-red-600 font-medium bg-red-50 p-2 rounded border border-red-100">
                                    <span className="block text-[10px] uppercase font-bold tracking-wider mb-0.5">Rejection Reason</span>
                                    {decisionData.rejectionReason}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="h-screen flex flex-row overflow-hidden bg-slate-50">
            <Navbar />
            
            <main className="flex-1 flex flex-col min-h-0 relative px-6 py-10">
                <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">OD Corrections</h1>
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

                {/* Tabs */}
                {!showForm && (
                    <div className="flex justify-end mb-6">
                        <div className="relative">
                            <button
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold text-slate-700 transition-colors shadow-sm"
                            >
                                <SlidersHorizontal size={15} className="text-slate-500" />
                                Filter: {activeTab === 'pending' ? 'Pending Requests' : activeTab === 'approved' ? 'Approved History' : 'Rejected History'}
                                <ChevronDown size={14} className="text-slate-400 ml-1" />
                            </button>
                            {isFilterOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-20 p-1">
                                    {['pending', 'approved', 'rejected'].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => { setActiveTab(tab); setIsFilterOpen(false); }}
                                            className={`w-full text-left px-4 py-2.5 text-[13px] font-bold rounded-xl transition-colors ${activeTab === tab ? 'bg-blue-50 text-blue-700' : 'text-slate-800 hover:bg-slate-50'}`}
                                        >
                                            {tab === 'pending' ? 'Pending Requests' : tab === 'approved' ? 'Approved History' : 'Rejected History'}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {showForm && (
                    <div className="glass-panel p-8 rounded-3xl mb-10 border-2 border-cse-accent/10 animate-in fade-in slide-in-from-top-4 duration-500">
                        <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <FileText className="text-cse-accent" /> Submit Correction Request
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                                <h4 className="text-sm font-bold text-blue-800 mb-2">Current Values</h4>
                                <div className="flex gap-6">
                                    <div className="text-sm text-blue-700">OD Used: <strong className="text-lg">{currentUser.odUsed}</strong></div>
                                    <div className="text-sm text-blue-700">OD Limit: <strong className="text-lg">{currentUser.odLimit}</strong></div>
                                </div>
                            </div>

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

                {!showForm && (
                    <div className="flex-1 flex flex-col min-h-0 space-y-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <Loader2 className="animate-spin mb-4" size={40} />
                                <p className="font-bold">Loading requests...</p>
                            </div>
                        ) : requests.length === 0 ? (
                            <div className="glass-panel p-16 rounded-3xl text-center border-2 border-dashed border-slate-200">
                                <History size={48} className="mx-auto text-slate-300 mb-4" />
                                <h3 className="text-xl font-bold text-slate-900">No requests found</h3>
                                <p className="text-slate-500 mt-2">No OD correction requests in this category.</p>
                            </div>
                        ) : (
                          <div className="flex flex-col flex-1 min-h-0 bg-white rounded-b-2xl overflow-hidden shadow-sm border border-slate-100">
                            <div className="w-full bg-slate-50 z-10 border-b border-slate-200 pr-[8px]">
                              <table className="w-full text-left border-collapse table-fixed">
                                <thead>
                                  <tr className="bg-slate-50/50 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
                                    <th className="py-4 px-6 w-[35%]">STUDENT DETAILS</th>
                                    <th className="py-4 px-6 w-[20%]">REQUESTED DATE</th>
                                    <th className="py-4 px-6 w-[25%]">STATUS</th>
                                    <th className="py-4 px-6 w-[20%] text-right">ACTIONS</th>
                                  </tr>
                                </thead>
                              </table>
                            </div>
                            <div className="flex-1 overflow-y-scroll overflow-x-hidden min-h-0 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                              <table className="w-full text-left border-collapse table-fixed">
                                <tbody className="bg-white">
                                {requests.map(req => (
                                  <React.Fragment key={req.id}>
                                   <tr className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => setSelectedRequest(req)}>
                                      <td className="py-4 px-6 w-[35%]">
                                         <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0 border border-blue-100">
                                               {req.studentName.charAt(0)}
                                            </div>
                                            <div>
                                               <h4 className="font-bold text-slate-900 text-sm">
                                                  {formatStudentNameWithRoll(req.studentName, req.rollNo, req.studentId)}
                                               </h4>
                                               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                                                  STUDENT | {fallbackValue(req.department, 'department')}
                                               </p>
                                            </div>
                                         </div>
                                      </td>
                                      <td className="py-4 px-6 w-[20%]">
                                         <p className="text-sm font-medium text-slate-700">
                                            {new Date(req.createdAt).toLocaleDateString()}
                                         </p>
                                      </td>
                                      <td className="py-4 px-6 w-[25%]">
                                         {getStatusBadge(req.status)}
                                      </td>
                                      <td className="py-4 px-6 w-[20%] text-right">
                                         <div className="flex items-center justify-end gap-2">
                                            {isStaff && req.status.includes(currentUser.role.replace('_TEAM', '')) && activeTab === 'pending' && (
                                               <>
                                                  <button onClick={(e) => { e.stopPropagation(); openActionModal(req.id, 'APPROVE'); }} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors shadow-sm" title="Approve">
                                                     <ShieldCheck size={18} />
                                                  </button>
                                                  <button onClick={(e) => { e.stopPropagation(); openActionModal(req.id, 'REJECT'); }} className="p-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-lg transition-colors shadow-sm" title="Reject">
                                                     <XCircle size={18} />
                                                  </button>
                                               </>
                                            )}
                                            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors ml-2">
                                               <ChevronRight size={18} />
                                            </button>
                                         </div>
                                      </td>
                                   </tr>
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        )}
                    </div>
                )}
                </div>
            </main>

            {/* Details Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                                <FileText className="text-cse-accent" /> Request Details
                            </h3>
                            <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Issue / Reason</h5>
                                    <p className="text-sm font-medium text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                                        {selectedRequest.description}
                                    </p>
                                </div>
                                <div>
                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Requested OD</h5>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm flex gap-8">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Current ODs</span>
                                            <span className="text-lg font-extrabold text-slate-700">{selectedRequest.currentOdUsed ?? 0} <span className="text-sm text-slate-400 font-semibold">/ {selectedRequest.currentOdLimit ?? 7}</span></span>
                                        </div>
                                        <div className="w-px bg-slate-200 self-stretch"></div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Requested ODs</span>
                                            <span className="text-lg font-extrabold text-blue-600">{selectedRequest.requestedCount} <span className="text-sm text-blue-300 font-semibold">/ {selectedRequest.requestedLimit}</span></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-2 pt-6 border-t border-slate-200">
                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <History size={14} /> Approval Workflow Timeline
                                </h5>
                                <div className="ml-2">
                                    {renderTimelineItem('Submitted', { approverName: selectedRequest.studentName, approverDept: selectedRequest.className || selectedRequest.department, decidedAt: selectedRequest.createdAt })}
                                    
                                    {renderTimelineItem(
                                        selectedRequest.facultyDecision?.action === 'APPROVE' ? 'Faculty Approved' : selectedRequest.facultyDecision?.action === 'REJECT' ? 'Faculty Rejected' : 'Pending Faculty Verification',
                                        selectedRequest.facultyDecision,
                                        selectedRequest.status === 'PENDING_FACULTY',
                                        selectedRequest.facultyDecision?.action === 'REJECT'
                                    )}
                                    
                                    {(selectedRequest.facultyDecision?.action === 'APPROVE' || selectedRequest.hodDecision) && renderTimelineItem(
                                        selectedRequest.hodDecision?.action === 'APPROVE' ? 'HOD Approved' : selectedRequest.hodDecision?.action === 'REJECT' ? 'HOD Rejected' : 'Pending HOD Verification',
                                        selectedRequest.hodDecision,
                                        selectedRequest.status === 'PENDING_HOD',
                                        selectedRequest.hodDecision?.action === 'REJECT'
                                    )}
                                    
                                    {(selectedRequest.hodDecision?.action === 'APPROVE' || selectedRequest.iqacDecision) && renderTimelineItem(
                                        selectedRequest.iqacDecision?.action === 'APPROVE' ? 'IQAC Approved (Completed)' : selectedRequest.iqacDecision?.action === 'REJECT' ? 'IQAC Rejected' : 'Pending IQAC Review',
                                        selectedRequest.iqacDecision,
                                        selectedRequest.status === 'PENDING_IQAC',
                                        selectedRequest.iqacDecision?.action === 'REJECT'
                                    )}
                                </div>
                                {selectedRequest.status === 'COMPLETED' && (
                                    <div className="mt-4 bg-emerald-50 text-emerald-800 p-3 rounded-lg text-xs font-medium flex items-center gap-2 border border-emerald-100">
                                        <CheckCircle2 size={16} className="text-emerald-500"/>
                                        OD values updated successfully on {new Date(selectedRequest.odUpdatedAt).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* Action Modal */}
            {actionModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100">
                        <div className={`px-6 py-4 border-b ${actionModal.action === 'APPROVE' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                            <h3 className={`font-bold text-lg flex items-center gap-2 ${actionModal.action === 'APPROVE' ? 'text-emerald-800' : 'text-red-800'}`}>
                                {actionModal.action === 'APPROVE' ? <ShieldCheck /> : <XCircle />}
                                Confirm {actionModal.action === 'APPROVE' ? 'Approval' : 'Rejection'}
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            {actionModal.action === 'REJECT' && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Rejection Reason <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text"
                                        required
                                        placeholder="e.g. Invalid OD count, Evidence missing"
                                        value={actionData.rejectionReason}
                                        onChange={e => setActionData({...actionData, rejectionReason: e.target.value})}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-sm"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Additional Comments (Optional)</label>
                                <textarea 
                                    rows="3"
                                    placeholder="Any notes for the student or next approver..."
                                    value={actionData.comments}
                                    onChange={e => setActionData({...actionData, comments: e.target.value})}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none text-sm"
                                ></textarea>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button 
                                onClick={() => setActionModal({ isOpen: false, requestId: null, action: null })}
                                className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={submitAction}
                                disabled={processingId !== null}
                                className={`px-6 py-2.5 rounded-xl font-bold text-white flex items-center gap-2 transition-all disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none ${
                                    actionModal.action === 'APPROVE' 
                                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20' 
                                        : 'bg-red-600 hover:bg-red-700 shadow-md shadow-red-500/20'
                                }`}
                            >
                                {processingId !== null ? <Loader2 size={18} className="animate-spin" /> : actionModal.action === 'APPROVE' ? <Check size={18} /> : <X size={18} />}
                                Confirm {actionModal.action === 'APPROVE' ? 'Approval' : 'Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ODCorrection;
