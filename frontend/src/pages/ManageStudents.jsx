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
import { fetchAcademicBatches } from '../services/firebaseService';

const ALL_CLASSES = [
  'CSE-A', 'CSE-B', 'CSE-C', 'CSE-D',
  'ECE-A', 'ECE-B', 'ECE-C',
  'CCE-A', 'CCE-B',
  'CSBS-A', 'CSBS-B',
  'MECH-A', 'MECH-B',
  'MECH-C', 'CIVIL-A', 'CIVIL-B',
  'CYBER-A',
  'EEE-A', 'EEE-B',
  'AIML-A', 'AIML-B',
  'AIDS-A', 'AIDS-B',
  'IT-A', 'IT-B', 'IT-C'
];

const DEPARTMENTS = [
  'CSE', 'ECE', 'CCE', 'CSBS', 'MECH', 'CIVIL', 'CYBER', 'EEE', 'AIML', 'AIDS', 'IT'
];

const STAFF_ROLES = [
  'FACULTY', 'HOD', 'HR_TEAM', 'AUDIO_TEAM', 'SYSTEM_ADMIN', 
  'TRANSPORT_TEAM', 'BOYS_WARDEN', 'GIRLS_WARDEN', 'MEDIA', 'IQAC_TEAM'
];

const API_BASE = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : (import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com') + '');

const ManageStudents = () => {
    const { currentUser, students, setStudents, staffUsers, setStaffUsers, loading, refreshStudents, refreshUsers, loadStudents, loadUsers } = useAppContext();
    const navigate = useNavigate();

    useEffect(() => {
        loadStudents();
        loadUsers();
    }, [loadStudents, loadUsers]);
    
    // Tabs & View State
    const [openDropdownId, setOpenDropdownId] = useState(null);
    const [activeTab, setActiveTab] = useState('students'); // 'students' | 'staff'
    const [selectedBatchView, setSelectedBatchView] = useState(null); // e.g. '2024-28'
    const [selectedDepartment, setSelectedDepartment] = useState(null); // e.g. 'CSE'
    const [selectedClass, setSelectedClass] = useState(null); // e.g. 'CSE-B'
    const [staffCategory, setStaffCategory] = useState(null); // 'FACULTY' | 'INCHARGE'
    const [staffDepartment, setStaffDepartment] = useState(null); // e.g. 'CSE'
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
    const [importStep, setImportStep] = useState('upload'); // 'upload' | 'report' | 'preview' | 'importing' | 'summary'
    const [importType, setImportType] = useState('students'); // 'students' | 'staff'
    const [bulkValidationReport, setBulkValidationReport] = useState({ total: 0, valid: 0, invalid: 0, fileDuplicates: 0 });
    const [validRecords, setValidRecords] = useState([]);
    const [invalidRecords, setInvalidRecords] = useState([]); // { row, reason, data }
    const [importSummary, setImportSummary] = useState(null); // { imported, dbDuplicates, fileDuplicates, invalid, failed }
    const [bulkError, setBulkError] = useState('');
    
    // Batch Management States
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchForm, setBatchForm] = useState({ name: '', admissionYear: '', graduationYear: '' });
    
    // Academic Batch State
    const [academicBatches, setAcademicBatches] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState('');
    const [filterBatch, setFilterBatch] = useState('');
    const [filterStatus, setFilterStatus] = useState('ACTIVE');

    useEffect(() => {
        const loadBatches = async () => {
            const batches = await fetchAcademicBatches();
            setAcademicBatches(batches);
        };
        loadBatches();
    }, []);
    const fileInputRef = useRef(null);

    // Security Check
    useEffect(() => {
        if (!currentUser) navigate('/');
        else {
            const isClassAdvisor = currentUser.role === UserRole.FACULTY && currentUser.assignedClasses && currentUser.assignedClasses.length > 0;
            if (![UserRole.HOD, UserRole.IQAC_TEAM].includes(currentUser.role) && !isClassAdvisor) {
                navigate('/dashboard');
            }
        }
    }, [currentUser, navigate]);

    if (!currentUser) return null;
    const isClassAdvisor = currentUser.role === UserRole.FACULTY && currentUser.assignedClasses && currentUser.assignedClasses.length > 0;
    if (![UserRole.HOD, UserRole.IQAC_TEAM].includes(currentUser.role) && !isClassAdvisor) return null;
    const isIQAC = currentUser.role === UserRole.IQAC_TEAM;
    const isHOD = currentUser.role === UserRole.HOD;

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
            const uDept = (currentUser.department || 'CSE').toUpperCase();
            let sDept = (s.department || '').toUpperCase();
            if (!sDept && s.class) {
                // Handle both 'CSE B' and 'CSE-B'
                sDept = s.class.replace(/-/g, ' ').split(' ')[0].toUpperCase();
            }
            if (uDept === 'AI&DS' || uDept === 'AIDS') return sDept === 'AI&DS' || sDept === 'AIDS';
            return sDept === uDept;
        })
        : mergedStudents;

    const classMap = {};
    
    // Pre-populate classes so empty ones still show up
    if (currentUser.role === UserRole.FACULTY && currentUser.assignedClasses) {
        currentUser.assignedClasses.forEach(cls => {
            classMap[cls] = [];
        });
    } else {
        ALL_CLASSES.forEach(cls => {
            if (isDeptRestricted && currentUser.department) {
                const prefix = cls.split('-')[0].toUpperCase();
                const uDept = currentUser.department.toUpperCase();
                if (uDept === 'AI&DS' || uDept === 'AIDS') {
                    if (prefix !== 'AIDS' && prefix !== 'AI&DS') return;
                } else if (prefix !== uDept) {
                    return;
                }
            }
            classMap[cls] = [];
        });
    }

    const batchMap = {};
    accessibleStudents.forEach(student => {
        const batch = student.academicBatch || 'Unassigned';
        if (!batchMap[batch]) batchMap[batch] = [];
        batchMap[batch].push(student);
    });
    
    // Sort batches, maybe putting 'Unassigned' at the end
    const batchesPresent = Object.keys(batchMap).sort((a, b) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;
        return a.localeCompare(b);
    });

    const studentsInBatch = selectedBatchView ? (batchMap[selectedBatchView] || []) : accessibleStudents;

    studentsInBatch.forEach(student => {
        // Normalize class name for mapping (e.g. "CSE B" -> "CSE-B")
        let cls = student.class || 'Unknown Class';
        if (cls !== 'Unknown Class') {
            cls = cls.replace(/\s+/g, '-').toUpperCase();
        }
        
        // If pre-populated class doesn't exist but matches a prepopulated one
        // Note: the mapping above is simple, so we just use it directly
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
    
    // Always bypass department view if user is restricted to a specific department (e.g., HOD)
    const effectiveDepartment = selectedDepartment || 
        (isDeptRestricted && currentUser.department ? currentUser.department.toUpperCase() : 
        (departments.length === 1 ? departments[0] : null));

    const classStudents = selectedClass && classMap[selectedClass] ? classMap[selectedClass] : [];
    const filteredClassStudents = classStudents.filter(s => {
        const matchesSearch = (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                              formatRollNo(s.rollNo, s.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (s.email || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesBatch = filterBatch ? (s.academicBatch === filterBatch) : true;
        // Assume default status is ACTIVE if undefined (for old records)
        const sStatus = s.studentStatus || 'ACTIVE';
        const matchesStatus = filterStatus === 'ALL' ? true : (sStatus === filterStatus);
        return matchesSearch && matchesBatch && matchesStatus;
    });

    // --- Staff Logic ---
    const isStaffDeptRestricted = [UserRole.FACULTY, UserRole.HOD].includes(currentUser.role);
    const allowedStaff = isStaffDeptRestricted 
        ? staffUsers.filter(staff => {
            const uDept = (currentUser.department || 'CSE').toUpperCase();
            let sDept = (staff.department || 'CSE').toUpperCase();
            if (uDept === 'AI&DS' || uDept === 'AIDS') return sDept === 'AI&DS' || sDept === 'AIDS';
            return sDept === uDept;
        })
        : staffUsers;

    const facultyStaff = allowedStaff.filter(s => ['FACULTY', 'HOD'].includes(s.role));
    const inchargeStaff = allowedStaff.filter(s => !['FACULTY', 'HOD'].includes(s.role));

    const staffDeptMap = {};
    facultyStaff.forEach(s => {
        const dept = s.department || 'Unknown';
        if (!staffDeptMap[dept]) staffDeptMap[dept] = [];
        staffDeptMap[dept].push(s);
    });
    const staffDepartments = Object.keys(staffDeptMap).sort();

    let currentStaffList = allowedStaff; // Default fallback if no category is somehow selected, though we handle UI below
    if (staffCategory === 'FACULTY') {
        currentStaffList = staffDepartment ? (staffDeptMap[staffDepartment] || []) : facultyStaff; // If no dept, we shouldn't show list, but just in case
    } else if (staffCategory === 'INCHARGE') {
        currentStaffList = inchargeStaff;
    }

    const filteredStaff = currentStaffList.filter(s => 
        (s.name || '').toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
        (s.role || '').toLowerCase().includes(staffSearchQuery.toLowerCase())
    );

    // --- API Handlers ---
    const handleSaveStudent = async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            const url = editingStudent 
                ? `${API_BASE}/api/students/${editingStudent.id}`
                : `${API_BASE}/api/students`;
            const method = editingStudent ? 'PUT' : 'POST';
            
            const payload = { 
                ...studentForm, 
                class: (studentForm.class || '').toUpperCase(),
                className: (studentForm.class || '').replace(/\s+/g, '-').toUpperCase(),
                section: (studentForm.section || '').toUpperCase(),
                department: (studentForm.department || '').toUpperCase()
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            
            await refreshStudents();
            
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

    const handleSaveBatch = async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            const res = await fetch(`${API_BASE}/api/academic-batches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
                body: JSON.stringify(batchForm)
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            
            setShowBatchModal(false);
            setBatchForm({ name: '', admissionYear: '', graduationYear: '' });
            
            const batches = await fetchAcademicBatches();
            setAcademicBatches(batches);
        } catch (err) {
            console.error(err);
            alert('Failed to save batch: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteStudent = async () => {
        if (!deletingStudent) return;
        setIsProcessing(true);
        try {
            const className = deletingStudent.class.replace(/\s+/g, '-');
            const res = await fetch(`${API_BASE}/api/students/${deletingStudent.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
                body: JSON.stringify({ className })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            
            await refreshStudents();
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
                ? `${API_BASE}/api/users/${editingStaff.id}`
                : `${API_BASE}/api/users`;
            const method = editingStaff ? 'PUT' : 'POST';
            
            const payload = {
                ...staffForm,
                department: (staffForm.department || '').toUpperCase(),
                role: (staffForm.role || '').toUpperCase()
            };
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            
            await refreshUsers();
            
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
            const res = await fetch(`${API_BASE}/api/users/${deletingStaff.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` }
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            
            await refreshUsers();
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
                
                const valid = [];
                const invalid = [];
                let fileDups = 0;
                
                const fileIdentifiers = new Set();
                const fileEmails = new Set();
                
                const dbIdentifiers = new Set();
                const dbEmails = new Set();
                
                if (importType === 'students') {
                    (students || []).forEach(s => {
                        if (s.rollNo) dbIdentifiers.add(String(s.rollNo).toUpperCase());
                        if (s.email) dbEmails.add(String(s.email).toLowerCase());
                    });
                } else {
                    (staffUsers || []).forEach(s => {
                        if (s.id && String(s.id).startsWith('staff_')) {
                            dbIdentifiers.add(String(s.id).replace('staff_', '').toUpperCase());
                        }
                        if (s.email) dbEmails.add(String(s.email).toLowerCase());
                    });
                }
                
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                const validDepts = DEPARTMENTS;

                    data.forEach((row, idx) => {
                        const rowNum = idx + 2; 
                        
                        // Normalize keys to lowercase for case-insensitive extraction
                        const lowerRow = Object.keys(row).reduce((acc, key) => {
                            acc[key.toLowerCase().trim()] = row[key];
                            return acc;
                        }, {});
                        
                        if (importType === 'students') {
                            const name = lowerRow.name || '';
                            const rollNo = String(lowerRow.rollno || lowerRow['roll number'] || lowerRow.roll_no || '').trim();
                            const email = String(lowerRow.email || '').trim();
                            const department = String(lowerRow.department || '').trim().toUpperCase();
                            const year = parseInt(lowerRow.year, 10);
                            const semester = parseInt(lowerRow.semester, 10);
                            const section = String(lowerRow.section || '').trim().toUpperCase();
                            const phone = String(lowerRow.phone || '').trim();
                            const className = String(lowerRow.class || `${department}-${section}`).replace(/\s+/g, '-').toUpperCase();
                            
                            if (!name || !rollNo || !email || !department || !year || !semester || !section) {
                                return invalid.push({ row: rowNum, reason: 'Missing required fields', data: row });
                            }
                            if (year < 1 || year > 4) return invalid.push({ row: rowNum, reason: 'Year must be 1-4', data: row });
                            if (semester < 1 || semester > 8) return invalid.push({ row: rowNum, reason: 'Semester must be 1-8', data: row });
                            if (!emailRegex.test(email)) return invalid.push({ row: rowNum, reason: 'Invalid email format', data: row });
                            if (!validDepts.includes(department)) return invalid.push({ row: rowNum, reason: `Department not in configured list (${validDepts.join(', ')})`, data: row });
                            
                            const idUpper = rollNo.toUpperCase();
                            const emailLower = email.toLowerCase();
                            
                            if (fileIdentifiers.has(idUpper) || fileEmails.has(emailLower)) {
                                fileDups++;
                                return invalid.push({ row: rowNum, reason: 'Duplicate in uploaded file', data: row });
                            }
                            
                            if (dbIdentifiers.has(idUpper) || dbEmails.has(emailLower)) {
                                return invalid.push({ row: rowNum, reason: 'Already exists in database', data: row });
                            }
                            
                            fileIdentifiers.add(idUpper);
                            fileEmails.add(emailLower);
                            
                            valid.push({ name, rollNo, email, department, className, section, phone, odLimit: lowerRow.odlimit || 7, academicBatch: selectedBatch });
                        } else {
                            const name = lowerRow.name || '';
                            const staffId = String(lowerRow.staffid || lowerRow['staff id'] || '').trim();
                            const email = String(lowerRow.email || '').trim();
                            const department = String(lowerRow.department || '').trim().toUpperCase();
                            const role = String(lowerRow.role || '').trim().toUpperCase();
                            const password = String(lowerRow.password || staffId);
                            
                            if (!name || !staffId || !email || !department || !role) {
                                return invalid.push({ row: rowNum, reason: 'Missing required fields', data: row });
                            }
                            if (!emailRegex.test(email)) return invalid.push({ row: rowNum, reason: 'Invalid email format', data: row });
                            if (!validDepts.includes(department)) return invalid.push({ row: rowNum, reason: `Department not in configured list (${validDepts.join(', ')})`, data: row });
                            if (!STAFF_ROLES.includes(role)) return invalid.push({ row: rowNum, reason: `Role must be one of: ${STAFF_ROLES.join(', ')}`, data: row });
                            
                            const idUpper = staffId.toUpperCase();
                            const emailLower = email.toLowerCase();
                            
                            if (fileIdentifiers.has(idUpper) || fileEmails.has(emailLower)) {
                                fileDups++;
                                return invalid.push({ row: rowNum, reason: 'Duplicate in uploaded file', data: row });
                            }
                            
                            if (dbIdentifiers.has(idUpper) || dbEmails.has(emailLower)) {
                                return invalid.push({ row: rowNum, reason: 'Already exists in database', data: row });
                            }
                            
                            fileIdentifiers.add(idUpper);
                            fileEmails.add(emailLower);
                            
                            valid.push({ name, staffId, email, department, role, password, assignedClasses: [] });
                        }
                });
                
                if (data.length === 0) throw new Error('File is empty.');
                
                setValidRecords(valid);
                setInvalidRecords(invalid);
                setBulkValidationReport({
                    total: data.length,
                    valid: valid.length,
                    invalid: invalid.length,
                    fileDuplicates: fileDups
                });
                setBulkError('');
                setImportStep('report');
                
            } catch (err) {
                setBulkError('Failed to parse file: ' + err.message);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleBulkSubmit = async () => {
        if (validRecords.length === 0) return;
        setImportStep('importing');
        setIsProcessing(true);
        try {
            const endpoint = importType === 'students' ? `${API_BASE}/api/students/bulk` : `${API_BASE}/api/users/bulk`;
            const payloadKey = importType === 'students' ? 'students' : 'users';
            
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
                body: JSON.stringify({ [payloadKey]: validRecords })
            });
            const data = await res.json();
            
            if (res.status === 500 && data.importedCount !== undefined) {
                if (importType === 'students') await refreshStudents(); else await refreshUsers();
                setImportSummary({
                    imported: data.importedCount,
                    dbDuplicates: data.dbDuplicatesCount || 0,
                    fileDuplicates: bulkValidationReport.fileDuplicates,
                    invalid: invalidRecords.length,
                    failed: data.failedCount
                });
                setImportStep('summary');
            } else if (data.success) {
                if (importType === 'students') await refreshStudents(); else await refreshUsers();
                setImportSummary({
                    imported: data.importedCount,
                    dbDuplicates: data.dbDuplicatesCount || 0,
                    fileDuplicates: bulkValidationReport.fileDuplicates,
                    invalid: invalidRecords.length,
                    failed: 0
                });
                setImportStep('summary');
                if (fileInputRef.current) fileInputRef.current.value = '';
            } else {
                throw new Error(data.message);
            }
        } catch (err) {
            console.error(err);
            alert('Bulk import failed: ' + err.message);
            setImportStep('report');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleResetODUsage = () => setShowResetConfirm(true);
    const confirmResetODUsage = async () => {
        setIsProcessing(true);
        try {
            const res = await fetch(`${API_BASE}/api/students/reset-od-usage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` }
            });
            const data = await res.json();
            if (data.success) {
                await refreshStudents();
            }
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
            await fetch(`${API_BASE}/api/students/${student.id}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
                body: JSON.stringify({ role: newRole, className, isApprovedOrganizer: newRole === UserRole.STUDENT_ORGANIZER }),
            });
            if (setStudents) {
                setStudents(prev => prev.map(s => s.id === student.id ? { ...s, role: newRole } : s));
            }
            await refreshStudents();
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
            await fetch(`${API_BASE}/api/students/${student.id}/od-stats`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
                body: JSON.stringify({ className, [field]: value }),
            });
            await refreshStudents();
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
                                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
                                    {(isIQAC || isHOD) ? 'User Management' : 'Manage Students'}
                                </h2>
                                <p className="text-slate-500 mt-1 text-sm hidden sm:block">
                                    {(isIQAC || isHOD) ? 'Manage institutional users and roles' : 'Manage your assigned classes and students'}
                                </p>
                            </div>
                            <div className="flex items-center justify-end gap-3 shrink-0 flex-wrap">
                                {isIQAC && activeTab === 'students' && (
                                    <>
                                        <button onClick={() => { setBatchForm({ name: '', admissionYear: '', graduationYear: '' }); setShowBatchModal(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all flex items-center gap-2">
                                            <Plus size={16} /> Add Batch
                                        </button>
                                        <button onClick={() => { setEditingStudent(null); setStudentForm({ name: '', rollNo: '', email: '', class: '', section: '', department: '', phone: '', password: '', odLimit: '', academicBatch: '' }); setShowStudentModal(true); }} className="px-4 py-2 bg-cse-accent text-white rounded-xl font-bold text-sm hover:bg-cse-accent/90 transition-all flex items-center gap-2">
                                            <Plus size={16} /> Add Student
                                        </button>
                                        <button onClick={() => { setImportType('students'); setImportStep('upload'); setBulkValidationReport({ total: 0, valid: 0, invalid: 0, fileDuplicates: 0 }); setValidRecords([]); setInvalidRecords([]); setImportSummary(null); setShowBulkModal(true); }} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-all flex items-center gap-2">
                                            <Upload size={16} /> Bulk Import
                                        </button>
                                    </>
                                )}
                                {isIQAC && activeTab === 'staff' && (
                                    <>
                                        <button onClick={() => { setEditingStaff(null); setStaffForm({ name: '', email: '', role: 'FACULTY', department: '', password: '', assignedClasses: [] }); setShowStaffModal(true); }} className="px-4 py-2 bg-cse-accent text-white rounded-xl font-bold text-sm hover:bg-cse-accent/90 transition-all flex items-center gap-2">
                                            <Plus size={16} /> Add Staff
                                        </button>
                                        <button onClick={() => { setImportType('staff'); setImportStep('upload'); setBulkValidationReport({ total: 0, valid: 0, invalid: 0, fileDuplicates: 0 }); setValidRecords([]); setInvalidRecords([]); setImportSummary(null); setShowBulkModal(true); }} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-all flex items-center gap-2">
                                            <Upload size={16} /> Bulk Import
                                        </button>
                                    </>
                                )}
                                <button onClick={() => navigate('/dashboard')} className="btn-secondary flex items-center gap-1 shrink-0 px-3 py-1.5 h-fit text-sm whitespace-nowrap ml-2">
                                    <ChevronLeft size={16} /> Back
                                </button>
                            </div>
                        </div>

                        {/* Tabs */}
                        {(isIQAC || isHOD) && (
                            <div className="flex space-x-6 border-b border-slate-200 mt-4 overflow-x-auto no-scrollbar">
                                {(isIQAC || isHOD) && (
                                <button
                                    onClick={() => {
                                        setActiveTab('students');
                                        setSelectedBatchView(null);
                                        setSelectedDepartment(null);
                                        setSelectedClass(null);
                                        setSearchQuery('');
                                    }}
                                    className={`pb-3 whitespace-nowrap font-semibold text-sm transition-colors relative ${activeTab === 'students' ? 'text-cse-accent' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Students
                                    {activeTab === 'students' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cse-accent rounded-t-full" />}
                                </button>
                                )}
                                {isIQAC && (
                                <button
                                    onClick={() => {
                                        setActiveTab('staff');
                                        setStaffCategory(null);
                                        setStaffDepartment(null);
                                        setStaffSearchQuery('');
                                    }}
                                    className={`pb-3 whitespace-nowrap font-semibold text-sm transition-colors relative ${activeTab === 'staff' ? 'text-cse-accent' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Staff Directory
                                    {activeTab === 'staff' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cse-accent rounded-t-full" />}
                                </button>
                                )}
                                {isHOD && (
                                <button
                                    onClick={() => setActiveTab('advisors')}
                                    className={`pb-3 whitespace-nowrap font-semibold text-sm transition-colors relative ${activeTab === 'advisors' ? 'text-cse-accent' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Class Advisor Management
                                    {activeTab === 'advisors' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cse-accent rounded-t-full" />}
                                </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    <div className={`max-w-6xl mx-auto w-full ${((activeTab === 'students' && selectedClass) || (activeTab === 'staff' && (staffCategory === 'INCHARGE' || (staffCategory === 'FACULTY' && staffDepartment)))) ? '' : 'pt-6'}`}>
                        {loading ? (
                            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-cse-accent" size={36} /></div>
                        ) : activeTab === 'students' ? (
                            /* STUDENTS VIEW */
                            isClassAdvisor && !selectedClass ? (
                                <>
                                    <div className="flex items-center gap-4 mb-6">
                                        <h3 className="text-xl font-bold text-slate-900">Your Assigned Classes</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {currentUser.assignedClasses.map(cls => (
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
                            ) : !selectedBatchView && !isClassAdvisor ? (
                                /* 0. Show Batches */
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                        <div className="glass-panel p-4 rounded-2xl flex items-center gap-4">
                                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Building2 size={20} /></div>
                                            <div><p className="text-2xl font-bold text-slate-900">{batchesPresent.length}</p><p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Batches</p></div>
                                        </div>
                                        <div className="glass-panel p-4 rounded-2xl flex items-center gap-4">
                                            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center"><Users size={20} /></div>
                                            <div><p className="text-2xl font-bold text-slate-900">{accessibleStudents.length}</p><p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Students</p></div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {batchesPresent.map(batch => (
                                            <button key={batch} onClick={() => { setSelectedBatchView(batch); setSelectedDepartment(null); setSelectedClass(null); }} className="glass-panel p-6 rounded-2xl hover:bg-slate-50/80 transition-all hover:shadow-md group flex items-start justify-between">
                                                <div className="text-left">
                                                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-cse-accent transition-colors">{batch !== 'Unassigned' ? `${batch} Batch` : 'Unassigned'}</h3>
                                                    <p className="text-sm text-slate-600 mt-1"><span className="font-semibold">{batchMap[batch]?.length || 0}</span> students</p>
                                                </div>
                                                <ChevronRight size={24} className="text-slate-300 group-hover:text-cse-accent transition-colors" />
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : !effectiveDepartment && !isClassAdvisor ? (
                                /* 1. Show Departments */
                                <>
                                    <div className="flex items-center gap-4 mb-6">
                                        <button onClick={() => setSelectedBatchView(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"><ArrowLeft size={20} /></button>
                                        <h3 className="text-xl font-bold text-slate-900">{selectedBatchView !== 'Unassigned' ? `${selectedBatchView} Batch` : 'Unassigned'} Departments</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                        <div className="glass-panel p-4 rounded-2xl flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><Building2 size={20} /></div>
                                            <div><p className="text-2xl font-bold text-slate-900">{departments.length}</p><p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Departments</p></div>
                                        </div>
                                        <div className="glass-panel p-4 rounded-2xl flex items-center gap-4">
                                            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center"><Users size={20} /></div>
                                            <div><p className="text-2xl font-bold text-slate-900">{studentsInBatch.length}</p><p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Batch Students</p></div>
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
                                        {(departments.length > 1 || (!isDeptRestricted && departments.length !== 1)) && (
                                            <button onClick={() => setSelectedDepartment(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"><ArrowLeft size={20} /></button>
                                        )}
                                        <h3 className="text-xl font-bold text-slate-900">{effectiveDepartment} Department Classes - {selectedBatchView !== 'Unassigned' ? `${selectedBatchView} Batch` : 'Unassigned'}</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {(deptMap[effectiveDepartment] || []).map(cls => (
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
                                    <div className="sticky top-0 z-10 bg-[#f8fafc] pt-6 pb-4 mb-6 border-b border-slate-200 flex items-center gap-4">
                                        <button onClick={() => setSelectedClass(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"><ArrowLeft size={20} /></button>
                                        <div className="flex flex-col">
                                            <h3 className="text-xl font-bold text-slate-900">{selectedClass}</h3>
                                            {(() => {
                                                const advisors = (staffUsers || []).filter(s => s.role === 'FACULTY' && (s.assignedClasses || []).includes(selectedClass));
                                                if (advisors.length > 0) {
                                                    return (
                                                        <p className="text-sm font-semibold text-cse-accent flex items-center gap-1.5 mt-0.5">
                                                            <UserCheck size={14} /> Class Advisor: {advisors.map(a => a.name).join(', ')}
                                                        </p>
                                                    );
                                                }
                                                return <p className="text-sm font-medium text-slate-500 mt-0.5 flex items-center gap-1.5"><UserX size={14} /> No Class Advisor Assigned</p>;
                                            })()}
                                        </div>
                                        <div className="relative flex-1 max-w-md ml-auto flex gap-3">
                                            <select
                                                value={filterStatus}
                                                onChange={(e) => setFilterStatus(e.target.value)}
                                                className="w-1/3 px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cse-accent/30 focus:border-cse-accent transition-all bg-white text-sm"
                                            >
                                                <option value="ALL">All Status</option>
                                                <option value="ACTIVE">Active</option>
                                                <option value="GRADUATED">Graduated</option>
                                                <option value="INACTIVE">Inactive</option>
                                            </select>
                                            {academicBatches.length > 0 && (
                                                <select
                                                    value={filterBatch}
                                                    onChange={(e) => setFilterBatch(e.target.value)}
                                                    className="w-1/3 px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cse-accent/30 focus:border-cse-accent transition-all bg-white text-sm"
                                                >
                                                    <option value="">All Batches</option>
                                                    {academicBatches.map(b => (
                                                        <option key={b.id} value={b.name}>{b.name}</option>
                                                    ))}
                                                </select>
                                            )}
                                            <div className="relative flex-1">
                                                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input type="text" placeholder="Search students..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cse-accent/30 focus:border-cse-accent transition-all" />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="glass-panel rounded-2xl overflow-hidden">
                                        <div className="divide-y divide-slate-100">
                                            {filteredClassStudents.map(student => (
                                                <div key={student.id} className="px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm shrink-0 border border-slate-200">{(student.name || '?').charAt(0)}</div>
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
                                                        <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase ${
                                                            (student.studentStatus || 'ACTIVE') === 'ACTIVE' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                            student.studentStatus === 'GRADUATED' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                                                            'bg-slate-50 text-slate-600 border border-slate-100'
                                                        }`}>
                                                            {student.studentStatus || 'ACTIVE'}
                                                        </span>
                                                        <button onClick={() => handleToggleOrganizer(student)} disabled={togglingId === student.id} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">
                                                            {student.role === UserRole.STUDENT_ORGANIZER ? <UserX size={16} /> : <UserCheck size={16} />}
                                                        </button>
                                                        {isIQAC && (
                                                            <>
                                                                <button onClick={() => { 
                                                                    setEditingStudent(student);
                                                                    
                                                                    const parsedDept = student.department || (student.class ? student.class.split(/[\s-]/)[0].toUpperCase() : '');
                                                                    let parsedSec = student.section || '';
                                                                    
                                                                    if (parsedSec.toUpperCase() === (student.class || '').toUpperCase()) {
                                                                        parsedSec = parsedSec.split(/[\s-]/).pop();
                                                                    }
                                                                    if (parsedSec.toUpperCase().startsWith(parsedDept + ' ') || parsedSec.toUpperCase().startsWith(parsedDept + '-')) {
                                                                        parsedSec = parsedSec.substring(parsedDept.length + 1).trim();
                                                                    }
                                                                    
                                                                    setStudentForm({ 
                                                                        ...student, 
                                                                        class: student.class || selectedClass, 
                                                                        section: parsedSec,
                                                                        department: parsedDept,
                                                                        password: '', 
                                                                        odLimit: student.odLimit || 7 
                                                                    }); 
                                                                    setShowStudentModal(true); 
                                                                }} className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"><Edit size={16}/></button>
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
                        ) : activeTab === 'staff' ? (
                            /* STAFF VIEW */
                            !staffCategory ? (
                                /* Level 0: Categories */
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <button onClick={() => { setStaffCategory('FACULTY'); setStaffDepartment(null); }} className="glass-panel p-6 rounded-2xl hover:bg-slate-50/80 transition-all hover:shadow-md group flex items-start justify-between">
                                            <div className="text-left flex items-center gap-4">
                                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Users size={24} /></div>
                                                <div>
                                                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-cse-accent transition-colors">Faculty</h3>
                                                    <p className="text-sm text-slate-600 mt-1"><span className="font-semibold">{facultyStaff.length}</span> members</p>
                                                </div>
                                            </div>
                                            <ChevronRight size={24} className="text-slate-300 group-hover:text-cse-accent transition-colors" />
                                        </button>
                                        <button onClick={() => { setStaffCategory('INCHARGE'); setStaffDepartment(null); }} className="glass-panel p-6 rounded-2xl hover:bg-slate-50/80 transition-all hover:shadow-md group flex items-start justify-between">
                                            <div className="text-left flex items-center gap-4">
                                                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center"><ShieldCheck size={24} /></div>
                                                <div>
                                                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-cse-accent transition-colors">Incharges</h3>
                                                    <p className="text-sm text-slate-600 mt-1"><span className="font-semibold">{inchargeStaff.length}</span> members</p>
                                                </div>
                                            </div>
                                            <ChevronRight size={24} className="text-slate-300 group-hover:text-cse-accent transition-colors" />
                                        </button>
                                    </div>
                                </>
                            ) : (staffCategory === 'FACULTY' && !staffDepartment) ? (
                                /* Level 1: Departments for Faculty */
                                <>
                                    <div className="flex items-center gap-4 mb-6">
                                        <button onClick={() => setStaffCategory(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"><ArrowLeft size={20} /></button>
                                        <h3 className="text-xl font-bold text-slate-900">Faculty Departments</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {staffDepartments.map(dept => (
                                            <button key={dept} onClick={() => setStaffDepartment(dept)} className="glass-panel p-6 rounded-2xl hover:bg-slate-50/80 transition-all hover:shadow-md group flex items-start justify-between">
                                                <div className="text-left">
                                                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-cse-accent transition-colors">{dept}</h3>
                                                    <p className="text-sm text-slate-600 mt-1"><span className="font-semibold">{staffDeptMap[dept].length}</span> faculty</p>
                                                </div>
                                                <ChevronRight size={24} className="text-slate-300 group-hover:text-cse-accent transition-colors" />
                                            </button>
                                        ))}
                                        {staffDepartments.length === 0 && (
                                            <div className="p-8 text-center text-slate-500 col-span-3">No departments found for faculty.</div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                /* Level 2: Staff List (Faculty in Dept OR Incharges) */
                                <>
                                    <div className="sticky top-0 z-10 bg-[#f8fafc] pt-6 pb-4 mb-6 border-b border-slate-200 flex items-center gap-4">
                                        <button onClick={() => staffCategory === 'FACULTY' ? setStaffDepartment(null) : setStaffCategory(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"><ArrowLeft size={20} /></button>
                                        <h3 className="text-xl font-bold text-slate-900">{staffCategory === 'FACULTY' ? `${staffDepartment} Faculty` : 'Incharges'}</h3>
                                        <div className="relative flex-1 max-w-md ml-auto">
                                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input type="text" placeholder="Search staff..." value={staffSearchQuery} onChange={e => setStaffSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cse-accent/30 focus:border-cse-accent transition-all" />
                                        </div>
                                    </div>
                                    <div className="glass-panel rounded-2xl overflow-hidden">
                                        <div className="divide-y divide-slate-100">
                                            {filteredStaff.map(staff => (
                                                <div key={staff.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">{(staff.name || '?').charAt(0)}</div>
                                                        <div>
                                                            <p className="font-bold text-slate-900 text-sm">{staff.name}</p>
                                                            <p className="text-xs text-slate-500 mt-0.5">{staff.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${staff.role === 'HOD' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>{(staff.role || 'Unknown').replace('_', ' ')}</span>
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
                            )
                        ) : activeTab === 'advisors' && isHOD ? (
                            /* ADVISORS VIEW */
                            <div className="glass-panel rounded-2xl pb-24">
                                <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
                                    <h3 className="text-lg font-bold text-slate-800">Assign Class Advisors</h3>
                                    <p className="text-sm text-slate-500 mt-1">Map {currentUser.department || 'your department'} classes to faculty members for monitoring event tracking and attendance.</p>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {ALL_CLASSES.filter(cls => {
                                        if (isDeptRestricted && currentUser.department) {
                                            const prefix = cls.split('-')[0].toUpperCase();
                                            const uDept = currentUser.department.toUpperCase();
                                            if (uDept === 'AI&DS' || uDept === 'AIDS') {
                                                return prefix === 'AIDS' || prefix === 'AI&DS';
                                            }
                                            return prefix === uDept;
                                        }
                                        return true;
                                    }).map((cls, idx, filteredArr) => {
                                        const assignedFaculty = allowedStaff.filter(s => s.role === 'FACULTY' && (s.assignedClasses || []).includes(cls));
                                        const isNearBottom = idx >= Math.max(0, filteredArr.length - 2);
                                        return (
                                            <div key={cls} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors last:rounded-b-2xl">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-100">{cls}</div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-sm">Class {cls}</p>
                                                        {assignedFaculty.length > 0 ? (
                                                            <div className="flex flex-wrap gap-2 mt-1">
                                                                {assignedFaculty.map(f => (
                                                                    <span key={f.id} className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                                                                        <UserCheck size={12} /> {f.name}
                                                                        <button onClick={async () => {
                                                                            try {
                                                                                const updatedAssigned = (f.assignedClasses || []).filter(c => c !== cls);
                                                                                setStaffUsers(prev => prev.map(u => u.id === f.id ? { ...u, assignedClasses: updatedAssigned } : u));
                                                                                
                                                                                fetch(`${API_BASE}/api/users/${f.id}`, {
                                                                                    method: 'PUT',
                                                                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
                                                                                    body: JSON.stringify({ ...f, assignedClasses: updatedAssigned })
                                                                                }).catch(e => console.error(e));
                                                                            } catch(e) { console.error(e); }
                                                                        }} className="ml-1 text-emerald-400 hover:text-emerald-700" title="Remove assignment"><X size={12}/></button>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-slate-400 mt-1 italic">No advisor assigned</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 w-full md:w-auto">
                                                    <div className="relative w-full md:w-64">
                                                        <button
                                                            onClick={() => setOpenDropdownId(openDropdownId === cls ? null : cls)}
                                                            className="flex items-center justify-between w-full px-4 py-2 bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 rounded-lg font-bold transition-all text-[13px]"
                                                        >
                                                            <span className="truncate">Assign new advisor...</span>
                                                            <svg className={`w-4 h-4 transition-transform ${openDropdownId === cls ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                        </button>
                                                        
                                                        {openDropdownId === cls && (
                                                            <>
                                                                <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownId(null)} />
                                                                <div className={`absolute right-0 w-full bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col py-1 animate-in fade-in duration-200 ${isNearBottom ? 'bottom-full mb-2 slide-in-from-bottom-2' : 'top-full mt-2 slide-in-from-top-2'}`} style={{ zIndex: 9999 }}>
                                                                    <div className="max-h-60 overflow-y-auto">
                                                                        {allowedStaff
                                                                            .filter(s => s.role === 'FACULTY' && (s.department || '').toUpperCase() === (currentUser.department || 'CSE').toUpperCase() && !(s.assignedClasses || []).includes(cls))
                                                                            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                                                                            .map((fac, idx) => (
                                                                                <button
                                                                                    key={fac.id}
                                                                                    onClick={async () => {
                                                                                        setOpenDropdownId(null);
                                                                                        try {
                                                                                            const currentAssigned = fac.assignedClasses || [];
                                                                                            if (!currentAssigned.includes(cls)) {
                                                                                                const updatedAssigned = [...currentAssigned, cls];
                                                                                                setStaffUsers(prev => prev.map(u => u.id === fac.id ? { ...u, assignedClasses: updatedAssigned } : u));

                                                                                                fetch(`${API_BASE}/api/users/${fac.id}`, {
                                                                                                    method: 'PUT',
                                                                                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
                                                                                                    body: JSON.stringify({ ...fac, assignedClasses: updatedAssigned })
                                                                                                }).catch(err => console.error(err));
                                                                                            }
                                                                                        } catch(err) { console.error(err); }
                                                                                    }}
                                                                                    className={`w-full px-4 py-2.5 text-left text-[14px] font-bold transition-colors text-slate-800 hover:bg-slate-50`}
                                                                                >
                                                                                    {fac.name}
                                                                                </button>
                                                                            ))}
                                                                        {allowedStaff.filter(s => s.role === 'FACULTY' && (s.department || '').toUpperCase() === (currentUser.department || 'CSE').toUpperCase() && !(s.assignedClasses || []).includes(cls)).length === 0 && (
                                                                            <div className="px-4 py-3 text-[13px] text-slate-500 italic text-center font-medium">No available faculty</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}
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
                            <div className="grid grid-cols-4 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Class *</label><input required placeholder="e.g. CSE-B" value={studentForm.class} onChange={e=>setStudentForm({...studentForm, class: e.target.value.toUpperCase()})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Section *</label><input required value={studentForm.section} onChange={e=>setStudentForm({...studentForm, section: e.target.value.toUpperCase()})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Department *</label><input required value={studentForm.department} onChange={e=>setStudentForm({...studentForm, department: e.target.value.toUpperCase()})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Batch *</label>
                                    <select required value={studentForm.academicBatch} onChange={e=>setStudentForm({...studentForm, academicBatch: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent">
                                        <option value="" disabled>Select</option>
                                        {academicBatches.map(b => (
                                            <option key={b.id} value={b.name}>{b.name || b.id}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-white">
                                <button type="button" onClick={() => setShowStudentModal(false)} className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                                <button type="submit" disabled={isProcessing} className="px-6 py-2 bg-cse-accent text-white rounded-lg font-bold hover:bg-cse-accent/90 disabled:opacity-50">{isProcessing ? <Loader2 className="animate-spin" /> : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Batch Modal */}
            {showBatchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">Add Academic Batch</h3>
                            <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveBatch} className="p-6 space-y-4">
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">Batch Name * (e.g. 2024-2028)</label><input required value={batchForm.name} onChange={e=>setBatchForm({...batchForm, name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Admission Year *</label><input required type="number" value={batchForm.admissionYear} onChange={e=>setBatchForm({...batchForm, admissionYear: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Graduation Year *</label><input required type="number" value={batchForm.graduationYear} onChange={e=>setBatchForm({...batchForm, graduationYear: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cse-accent" /></div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowBatchModal(false)} className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                                <button type="submit" disabled={isProcessing} className="px-6 py-2 bg-cse-accent text-white rounded-lg font-bold hover:bg-cse-accent/90 disabled:opacity-50">{isProcessing ? <Loader2 className="animate-spin" /> : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal */}
            {showBulkModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <h3 className="font-bold text-lg text-slate-800">
                                {importType === 'students' ? 'Bulk Import Students' : 'Bulk Import Staff'}
                            </h3>
                            <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            {/* STEP: UPLOAD */}
                            {importStep === 'upload' && (
                                <div>
                                    {importType === 'students' && (
                                        <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Academic Batch *</label>
                                            {academicBatches.length === 0 ? (
                                                <p className="text-sm text-red-600 font-medium">No Academic Batches available. Please create an Academic Batch first.</p>
                                            ) : (
                                                <select
                                                    value={selectedBatch}
                                                    onChange={(e) => setSelectedBatch(e.target.value)}
                                                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-cse-accent/50 focus:border-cse-accent transition-all bg-white"
                                                >
                                                    <option value="" disabled>-- Select Academic Batch --</option>
                                                    {academicBatches.map(b => (
                                                        <option key={b.id} value={b.name}>{b.name || b.id}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    )}
                                    <div className={`border-2 border-dashed border-slate-200 rounded-xl p-8 text-center relative transition-colors ${importType === 'students' && !selectedBatch ? 'bg-slate-100 opacity-60 cursor-not-allowed' : 'bg-slate-50 group hover:border-cse-accent/50'}`}>
                                        <FileSpreadsheet size={32} className={`mx-auto mb-3 ${importType === 'students' && !selectedBatch ? 'text-slate-300' : 'text-slate-400 group-hover:text-cse-accent'}`} />
                                        <p className="font-bold text-slate-700 mb-1">Upload Excel (.xlsx) or CSV file</p>
                                        <p className="text-xs text-slate-500 mb-4">
                                            {importType === 'students' 
                                                ? 'Required columns: Name, RollNo, Email, Department, Year, Semester, Section.' 
                                                : 'Required columns: Name, StaffId, Email, Department, Role.'}
                                        </p>
                                        <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} ref={fileInputRef} className={`absolute inset-0 w-full h-full opacity-0 ${importType === 'students' && !selectedBatch ? 'cursor-not-allowed hidden' : 'cursor-pointer'}`} disabled={importType === 'students' && !selectedBatch} />
                                        <button disabled={importType === 'students' && !selectedBatch} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 disabled:text-slate-400">Select File</button>
                                    </div>
                                    {bulkError && <p className="mt-4 text-sm text-red-600 font-medium bg-red-50 p-3 rounded-lg">{bulkError}</p>}
                                </div>
                            )}

                            {/* STEP: REPORT */}
                            {importStep === 'report' && (
                                <div>
                                    <div className="grid grid-cols-4 gap-4 mb-6">
                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                                            <div className="text-2xl font-bold text-slate-800">{bulkValidationReport.total}</div>
                                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Total Rows</div>
                                        </div>
                                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 text-center">
                                            <div className="text-2xl font-bold text-emerald-600">{bulkValidationReport.valid}</div>
                                            <div className="text-xs font-medium text-emerald-600/80 uppercase tracking-wider mt-1">Valid</div>
                                        </div>
                                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-center">
                                            <div className="text-2xl font-bold text-amber-600">{bulkValidationReport.fileDuplicates}</div>
                                            <div className="text-xs font-medium text-amber-600/80 uppercase tracking-wider mt-1">File Duplicates</div>
                                        </div>
                                        <div className="bg-rose-50 rounded-xl p-4 border border-rose-100 text-center">
                                            <div className="text-2xl font-bold text-rose-600">{bulkValidationReport.invalid - bulkValidationReport.fileDuplicates}</div>
                                            <div className="text-xs font-medium text-rose-600/80 uppercase tracking-wider mt-1">Invalid Format</div>
                                        </div>
                                    </div>

                                    {invalidRecords.length > 0 && (
                                        <div className="mb-6">
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="font-bold text-slate-800 text-sm">Failed Records ({invalidRecords.length})</h4>
                                                <button onClick={() => {
                                                    let csvContent = "data:text/csv;charset=utf-8,";
                                                    const allKeys = new Set(['Row_Number', 'Error_Reason']);
                                                    invalidRecords.forEach(r => Object.keys(r.data).forEach(k => allKeys.add(k)));
                                                    const headers = Array.from(allKeys);
                                                    csvContent += headers.join(",") + "\n";
                                                    invalidRecords.forEach(r => {
                                                        const row = headers.map(h => {
                                                            if (h === 'Row_Number') return r.row;
                                                            if (h === 'Error_Reason') return `"${r.reason}"`;
                                                            let val = r.data[h] || '';
                                                            return `"${String(val).replace(/"/g, '""')}"`;
                                                        });
                                                        csvContent += row.join(",") + "\n";
                                                    });
                                                    const encodedUri = encodeURI(csvContent);
                                                    const link = document.createElement("a");
                                                    link.setAttribute("href", encodedUri);
                                                    link.setAttribute("download", "import_errors.csv");
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                }} className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg flex items-center gap-1"><Upload size={14} /> Download Error CSV</button>
                                            </div>
                                            <div className="max-h-48 overflow-y-auto border border-rose-100 rounded-xl bg-rose-50/30">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-rose-100/50 text-rose-800 sticky top-0">
                                                        <tr><th className="px-3 py-2 font-bold w-16">Row</th><th className="px-3 py-2 font-bold">Reason</th><th className="px-3 py-2 font-bold">Name / ID</th></tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-rose-100/50">
                                                        {invalidRecords.slice(0, 100).map((r, i) => (
                                                            <tr key={i}>
                                                                <td className="px-3 py-2 text-slate-500">{r.row}</td>
                                                                <td className="px-3 py-2 font-medium text-rose-600">{r.reason}</td>
                                                                <td className="px-3 py-2 text-slate-600">{r.data.Name || r.data.name || 'N/A'} / {r.data.RollNo || r.data.StaffId || 'N/A'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                                        <button onClick={() => { setImportStep('upload'); if(fileInputRef.current) fileInputRef.current.value=''; }} className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                                        <button onClick={() => setImportStep('preview')} disabled={validRecords.length === 0} className="px-6 py-2 bg-cse-accent text-white rounded-lg font-bold flex items-center gap-2 hover:bg-cse-accent/90 disabled:opacity-50">
                                            Preview {validRecords.length} Valid Records <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STEP: PREVIEW */}
                            {importStep === 'preview' && (
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-slate-800">Preview ({validRecords.length} ready to import)</h4>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500 sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-2 font-semibold">Name</th>
                                                    <th className="px-4 py-2 font-semibold">{importType === 'students' ? 'Roll No' : 'Staff ID'}</th>
                                                    <th className="px-4 py-2 font-semibold">Department</th>
                                                    {importType === 'students' && <th className="px-4 py-2 font-semibold">Class</th>}
                                                    {importType === 'staff' && <th className="px-4 py-2 font-semibold">Role</th>}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {validRecords.slice(0, 100).map((s, i) => (
                                                    <tr key={i}>
                                                        <td className="px-4 py-2 font-medium">{s.name}</td>
                                                        <td className="px-4 py-2">{importType === 'students' ? s.rollNo : s.staffId}</td>
                                                        <td className="px-4 py-2">{s.department}</td>
                                                        {importType === 'students' && <td className="px-4 py-2">{s.className}</td>}
                                                        {importType === 'staff' && <td className="px-4 py-2">{s.role}</td>}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {validRecords.length > 100 && <div className="p-3 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-100">Showing first 100 entries...</div>}
                                    </div>
                                    <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
                                        <button onClick={() => setImportStep('report')} className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1"><ChevronLeft size={16}/> Back</button>
                                        <button onClick={handleBulkSubmit} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700">
                                            Import {validRecords.length} Records
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STEP: IMPORTING */}
                            {importStep === 'importing' && (
                                <div className="text-center py-12">
                                    <Loader2 size={48} className="mx-auto text-cse-accent animate-spin mb-4" />
                                    <h4 className="font-bold text-xl text-slate-800 mb-2">Importing Records...</h4>
                                    <p className="text-slate-500">Please wait while the records are being written to the database.</p>
                                </div>
                            )}

                            {/* STEP: SUMMARY */}
                            {importStep === 'summary' && importSummary && (
                                <div>
                                    <div className="text-center mb-8">
                                        {importSummary.failed > 0 ? (
                                            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4"><ShieldCheck size={32} /></div>
                                        ) : (
                                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><UserCheck size={32} /></div>
                                        )}
                                        <h3 className="font-bold text-2xl text-slate-800">Import Complete</h3>
                                        {importSummary.failed > 0 && <p className="text-amber-600 font-medium mt-1">Import partially completed due to a batch failure.</p>}
                                    </div>
                                    
                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 mb-6">
                                        <ul className="space-y-3">
                                            <li className="flex justify-between items-center pb-3 border-b border-slate-200">
                                                <span className="font-medium text-slate-600">Successfully Imported</span>
                                                <span className="font-bold text-lg text-emerald-600">{importSummary.imported}</span>
                                            </li>
                                            <li className="flex justify-between items-center pb-3 border-b border-slate-200">
                                                <span className="font-medium text-slate-600">Database Duplicates (Skipped)</span>
                                                <span className="font-bold text-slate-800">{importSummary.dbDuplicates}</span>
                                            </li>
                                            <li className="flex justify-between items-center pb-3 border-b border-slate-200">
                                                <span className="font-medium text-slate-600">File Duplicates (Skipped)</span>
                                                <span className="font-bold text-slate-800">{importSummary.fileDuplicates}</span>
                                            </li>
                                            <li className="flex justify-between items-center pb-3 border-b border-slate-200">
                                                <span className="font-medium text-slate-600">Invalid Format (Skipped)</span>
                                                <span className="font-bold text-slate-800">{importSummary.invalid - importSummary.fileDuplicates}</span>
                                            </li>
                                            {importSummary.failed > 0 && (
                                                <li className="flex justify-between items-center">
                                                    <span className="font-medium text-rose-600">Failed (Not Imported)</span>
                                                    <span className="font-bold text-lg text-rose-600">{importSummary.failed}</span>
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                    
                                    <div className="flex justify-center">
                                        <button onClick={() => setShowBulkModal(false)} className="px-8 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700">Done</button>
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
