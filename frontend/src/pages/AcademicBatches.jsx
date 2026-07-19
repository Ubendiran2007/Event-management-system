import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    GraduationCap, Users, Plus, Edit, X, Archive, PlayCircle, Loader2, Search, CheckCircle
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import Layout from '../components/Layout';
import ConfirmationModal from '../components/ConfirmationModal';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com';

export default function AcademicBatches() {
    const { currentUser, students } = useAppContext();
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [actionModal, setActionModal] = useState({ isOpen: false, type: '', batch: null }); 
    const [selectedBatchDetails, setSelectedBatchDetails] = useState(null);
    
    // Form state
    const [formData, setFormData] = useState({ name: '', admissionYear: '', graduationYear: '' });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    const fetchBatches = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/api/academic-batches`);
            const data = await res.json();
            if (data.success) {
                setBatches(data.data.sort((a, b) => b.name.localeCompare(a.name)));
            } else {
                setError('Failed to fetch academic batches.');
            }
        } catch (err) {
            console.error(err);
            setError('Error connecting to the server.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBatches();
    }, []);

    const filteredBatches = batches.filter(b => 
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        b.status.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getBatchStats = (batchName) => {
        const batchStudents = students.filter(s => s.academicBatch === batchName);
        const total = batchStudents.length;
        const graduated = batchStudents.filter(s => s.studentStatus === 'GRADUATED').length;
        const departments = new Set(batchStudents.map(s => s.department)).size;
        
        return { total, graduated, departments };
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        
        try {
            const res = await fetch(`${API_BASE}/api/academic-batches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    admissionYear: formData.admissionYear,
                    graduationYear: formData.graduationYear
                })
            });
            const data = await res.json();
            
            if (data.success) {
                setSuccessMsg('Academic Batch created successfully!');
                setShowCreateModal(false);
                setFormData({ name: '', admissionYear: '', graduationYear: '' });
                fetchBatches();
            } else {
                setError(data.message || 'Failed to create batch');
            }
        } catch (err) {
            setError('Error creating batch');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        
        try {
            const res = await fetch(`${API_BASE}/api/academic-batches/${formData.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    admissionYear: formData.admissionYear,
                    graduationYear: formData.graduationYear
                })
            });
            const data = await res.json();
            
            if (data.success) {
                setSuccessMsg('Academic Batch updated successfully!');
                setShowEditModal(false);
                fetchBatches();
            } else {
                setError(data.message || 'Failed to update batch');
            }
        } catch (err) {
            setError('Error updating batch');
        } finally {
            setSubmitting(false);
        }
    };

    const handleActionConfirm = async () => {
        const { type, batch } = actionModal;
        setSubmitting(true);
        setError(null);
        
        try {
            let endpoint = '';
            let method = 'PUT';
            let body = null;
            
            if (type === 'ARCHIVE') {
                endpoint = `${API_BASE}/api/academic-batches/${batch.id}`;
                body = JSON.stringify({ status: 'ARCHIVED' });
            } else if (type === 'ACTIVATE') {
                endpoint = `${API_BASE}/api/academic-batches/${batch.id}`;
                body = JSON.stringify({ status: 'ACTIVE' });
            } else if (type === 'GRADUATE') {
                endpoint = `${API_BASE}/api/academic-batches/${batch.id}/graduate`;
                method = 'POST';
            }
            
            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body
            });
            
            const data = await res.json();
            if (data.success) {
                setSuccessMsg(data.message || `Batch ${type.toLowerCase()}d successfully!`);
                setActionModal({ isOpen: false, type: '', batch: null });
                fetchBatches();
            } else {
                setError(data.message || `Failed to ${type.toLowerCase()} batch.`);
            }
        } catch (err) {
            setError(`Error performing action.`);
        } finally {
            setSubmitting(false);
        }
    };

    let actionTitle = '';
    let actionMessage = '';
    let actionConfirmText = '';
    let actionConfirmStyle = 'danger';

    if (actionModal.type === 'ARCHIVE') {
        actionTitle = 'Archive Academic Batch';
        actionMessage = `Are you sure you want to archive ${actionModal.batch?.name}? This will prevent new students from being assigned to this batch.`;
        actionConfirmText = 'Archive Batch';
        actionConfirmStyle = 'danger';
    } else if (actionModal.type === 'ACTIVATE') {
        actionTitle = 'Activate Academic Batch';
        actionMessage = `Are you sure you want to activate ${actionModal.batch?.name}? It will be available for new student imports.`;
        actionConfirmText = 'Activate Batch';
        actionConfirmStyle = 'success';
    } else if (actionModal.type === 'GRADUATE') {
        actionTitle = 'Graduate Academic Batch';
        const stats = actionModal.batch ? getBatchStats(actionModal.batch.name) : { total: 0 };
        
        if (stats.total === 0) {
            actionMessage = `Wait! The batch ${actionModal.batch?.name} has 0 active students. You cannot graduate an empty batch.`;
            actionConfirmText = 'Cannot Graduate';
            actionConfirmStyle = 'danger';
        } else {
            actionMessage = `Are you sure you want to graduate ${actionModal.batch?.name}? This will permanently mark ${stats.total} students as Alumni. This action cannot be reversed.`;
            actionConfirmText = 'Graduate Batch';
            actionConfirmStyle = 'danger';
        }
    }

    if (currentUser?.role !== 'IQAC_TEAM') {
        return (
            <Layout>
                <div className="flex h-screen items-center justify-center">
                    <p className="text-xl text-red-500">Access Denied. IQAC only.</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                            <GraduationCap className="h-8 w-8 text-blue-400" />
                            Academic Batches
                        </h1>
                        <p className="text-slate-400 text-lg">
                            Manage student lifecycles, alumni transitions, and batch analytics.
                        </p>
                    </div>
                    
                    <button 
                        onClick={() => {
                            setFormData({ name: '', admissionYear: '', graduationYear: '' });
                            setShowCreateModal(true);
                            setError(null);
                        }}
                        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-blue-500/25 flex items-center gap-2"
                    >
                        <Plus className="h-5 w-5" />
                        Create Batch
                    </button>
                </div>

                <AnimatePresence>
                    {error && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center justify-between">
                            <p>{error}</p>
                            <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
                        </motion.div>
                    )}
                    {successMsg && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl flex items-center justify-between">
                            <p>{successMsg}</p>
                            <button onClick={() => setSuccessMsg(null)}><X className="h-4 w-4" /></button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
                            <div className="relative mb-6">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search batches by name or status..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>

                            {loading ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                                    <Loader2 className="h-10 w-10 animate-spin mb-4 text-blue-500" />
                                    <p>Loading batches...</p>
                                </div>
                            ) : filteredBatches.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                                    <GraduationCap className="h-16 w-16 mb-4 text-slate-600" />
                                    <p className="text-xl">No batches found</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-slate-700/50">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-900/50 border-b border-slate-700/50 text-slate-300">
                                                <th className="p-4 font-medium">Batch</th>
                                                <th className="p-4 font-medium text-center">Admission</th>
                                                <th className="p-4 font-medium text-center">Graduation</th>
                                                <th className="p-4 font-medium text-center">Status</th>
                                                <th className="p-4 font-medium text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50">
                                            {filteredBatches.map(batch => (
                                                <tr 
                                                    key={batch.id}
                                                    onClick={() => setSelectedBatchDetails(batch)}
                                                    className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${selectedBatchDetails?.id === batch.id ? 'bg-blue-500/10' : ''}`}
                                                >
                                                    <td className="p-4 font-medium text-white">{batch.name}</td>
                                                    <td className="p-4 text-slate-400 text-center">{batch.admissionYear}</td>
                                                    <td className="p-4 text-slate-400 text-center">{batch.graduationYear}</td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                                                            batch.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                            batch.status === 'GRADUATED' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                            'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                        }`}>
                                                            {batch.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                            <button 
                                                                onClick={() => {
                                                                    setFormData(batch);
                                                                    setShowEditModal(true);
                                                                    setError(null);
                                                                }}
                                                                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                                                                title="Edit Batch"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            
                                                            {batch.status === 'ACTIVE' && (
                                                                <>
                                                                    <button 
                                                                        onClick={() => setActionModal({ isOpen: true, type: 'ARCHIVE', batch })}
                                                                        className="p-2 text-slate-400 hover:text-orange-400 hover:bg-orange-400/10 rounded-lg transition-colors"
                                                                        title="Archive Batch"
                                                                    >
                                                                        <Archive className="h-4 w-4" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setActionModal({ isOpen: true, type: 'GRADUATE', batch })}
                                                                        className="p-2 text-slate-400 hover:text-purple-400 hover:bg-purple-400/10 rounded-lg transition-colors"
                                                                        title="Graduate Batch"
                                                                    >
                                                                        <GraduationCap className="h-4 w-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                            
                                                            {batch.status === 'ARCHIVED' && (
                                                                <button 
                                                                    onClick={() => setActionModal({ isOpen: true, type: 'ACTIVATE', batch })}
                                                                    className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
                                                                    title="Activate Batch"
                                                                >
                                                                    <PlayCircle className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-1">
                        {selectedBatchDetails ? (
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-2xl p-6 backdrop-blur-sm sticky top-8"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-1">{selectedBatchDetails.name}</h3>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            selectedBatchDetails.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' :
                                            selectedBatchDetails.status === 'GRADUATED' ? 'bg-purple-500/20 text-purple-400' :
                                            'bg-slate-500/20 text-slate-400'
                                        }`}>
                                            {selectedBatchDetails.status}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedBatchDetails(null)}
                                        className="p-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-full text-slate-400 transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                {(() => {
                                    const stats = getBatchStats(selectedBatchDetails.name);
                                    return (
                                        <div className="space-y-4">
                                            <div className="bg-slate-900/50 rounded-xl p-4 flex items-center justify-between border border-slate-700/50">
                                                <div className="flex items-center gap-3 text-slate-300">
                                                    <Users className="h-5 w-5 text-blue-400" />
                                                    <span>Total Students</span>
                                                </div>
                                                <span className="text-xl font-bold text-white">{stats.total}</span>
                                            </div>
                                            
                                            <div className="bg-slate-900/50 rounded-xl p-4 flex items-center justify-between border border-slate-700/50">
                                                <div className="flex items-center gap-3 text-slate-300">
                                                    <GraduationCap className="h-5 w-5 text-purple-400" />
                                                    <span>Graduated</span>
                                                </div>
                                                <span className="text-xl font-bold text-white">{stats.graduated}</span>
                                            </div>
                                            
                                            <div className="bg-slate-900/50 rounded-xl p-4 flex items-center justify-between border border-slate-700/50">
                                                <div className="flex items-center gap-3 text-slate-300">
                                                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                                                    <span>Active</span>
                                                </div>
                                                <span className="text-xl font-bold text-white">{stats.total - stats.graduated}</span>
                                            </div>

                                            <div className="pt-4 mt-6 border-t border-slate-700/50 flex justify-between text-sm text-slate-400">
                                                <span>Departments: {stats.departments}</span>
                                                <span>Adm: {selectedBatchDetails.admissionYear} | Grad: {selectedBatchDetails.graduationYear}</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </motion.div>
                        ) : (
                            <div className="bg-slate-800/30 border border-slate-700/30 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
                                <Users className="h-12 w-12 text-slate-500 mb-4" />
                                <p className="text-slate-400">Select a batch from the table to view its statistics.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {(showCreateModal || showEditModal) && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                                <h3 className="text-xl font-bold text-white">
                                    {showCreateModal ? 'Create Academic Batch' : 'Edit Academic Batch'}
                                </h3>
                                <button 
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setShowEditModal(false);
                                    }}
                                    className="text-slate-400 hover:text-white transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            
                            <form onSubmit={showCreateModal ? handleCreateSubmit : handleEditSubmit} className="p-6 space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Batch Name (e.g. 2024-2028)</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="2024-2028"
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Admission Year</label>
                                        <input 
                                            type="number" 
                                            required 
                                            min="2000" max="2050"
                                            placeholder="2024"
                                            value={formData.admissionYear}
                                            onChange={e => setFormData({...formData, admissionYear: e.target.value})}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Graduation Year</label>
                                        <input 
                                            type="number" 
                                            required 
                                            min="2000" max="2100"
                                            placeholder="2028"
                                            value={formData.graduationYear}
                                            onChange={e => setFormData({...formData, graduationYear: e.target.value})}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setShowCreateModal(false);
                                            setShowEditModal(false);
                                        }}
                                        className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={submitting}
                                        className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                        {showCreateModal ? 'Create Batch' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmationModal
                isOpen={actionModal.isOpen}
                onClose={() => setActionModal({ isOpen: false, type: '', batch: null })}
                onConfirm={handleActionConfirm}
                title={actionTitle}
                message={actionMessage}
                confirmText={actionConfirmText}
                confirmStyle={actionConfirmStyle}
                disableConfirm={actionModal.type === 'GRADUATE' && (actionModal.batch ? getBatchStats(actionModal.batch.name).total === 0 : true)}
            />
        </Layout>
    );
}
