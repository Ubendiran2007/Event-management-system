import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, FileText, FileSpreadsheet, Activity, Loader2, Calendar, ChevronDown } from 'lucide-react';
import Layout from '../components/Layout';
import { useAppContext } from '../context/AppContext';
import { UserRole } from '../types';
import DataTable from '../components/DataTable';
import { usePaginatedApi } from '../hooks/usePaginatedApi';
import { useWindowPageSize } from '../hooks/useWindowPageSize';
import StatusBadge from '../components/StatusBadge';
import { useNotification } from '../context/NotificationContext';
import seceHeader from '../assets/sece header.jpeg';

const departmentLabel = (department) => ({
    CSE: 'Computer Science and Engineering',
    IT: 'Information Technology',
    ECE: 'Electronics and Communication Engineering',
    EEE: 'Electrical and Electronics Engineering',
    MECH: 'Mechanical Engineering'
}[department] || department || 'Department');

const EventTracking = () => {
    const { currentUser } = useAppContext();
    const { showNotification } = useNotification();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const tableContainerRef = useRef(null);
    const pageSize = useWindowPageSize(tableContainerRef, { hasToolbar: true });

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

    const { data, loading, error, pagination, actions } = usePaginatedApi('/api/od-requests', filters, { limit: pageSize, sortBy: 'createdAt', sortOrder: 'desc' });

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

    const getExportRows = () => [
        ['No.', 'Event', 'Event Date', 'Student', 'Roll Number', 'Class', 'Attendance', 'Registration'],
        ...displayData.map((record, index) => [
            index + 1,
            record.eventTitle || 'Unknown Event',
            record.eventDate || '-',
            record.studentName || '-',
            record.rollNo || record.studentId || '-',
            record.class || '-',
            record.attendanceStatus || 'PENDING',
            record.status || '-'
        ])
    ];

    const ensureExportData = () => {
        if (!displayData.length) {
            showNotification('There are no visible tracking records to export.', 'error');
            return false;
        }
        return true;
    };

    const handleExportExcel = async () => {
        if (!ensureExportData()) return;
        setIsExporting(true);
        try {
            const XLSX = await import('xlsx');
            const worksheet = XLSX.utils.aoa_to_sheet([
                ['SRI ESHWAR COLLEGE OF ENGINEERING'],
                ['Event Tracking Report'],
                [`Assigned Class: ${assignedClasses.join(', ')}`],
                [`Prepared by: ${currentUser.name || currentUser.email || 'Faculty'}`],
                [`Generated: ${new Date().toLocaleString()}`],
                [],
                ...getExportRows()
            ]);
            worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }];
            worksheet['!cols'] = [{ wch: 7 }, { wch: 34 }, { wch: 18 }, { wch: 26 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 18 }];
            worksheet['!autofilter'] = { ref: `A7:H${displayData.length + 7}` };
            worksheet['!pageSetup'] = { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Event Tracking');
            XLSX.writeFile(workbook, `Event_Tracking_${assignedClasses.join('_') || 'Report'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
            showNotification('Excel report exported successfully.', 'success');
        } catch (error) {
            console.error('Event tracking Excel export failed:', error);
            showNotification('Unable to export the Excel report.', 'error');
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportPDF = async () => {
        if (!ensureExportData()) return;
        setIsExporting(true);
        try {
            const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
            const autoTable = autoTableModule.default;
            // ISO A4 portrait: 210 x 297 mm (21 x 29.7 cm).
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 14;
            const reportDate = new Date();
            const present = displayData.filter((record) => record.attendanceStatus === 'PRESENT').length;
            const absent = displayData.filter((record) => record.attendanceStatus === 'ABSENT').length;
            const pending = displayData.length - present - absent;
            const image = new Image();
            image.src = seceHeader;
            await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });

            const drawHeader = () => {
                doc.setFillColor(15, 23, 42);
                doc.rect(0, 0, pageWidth, 28, 'F');
                doc.addImage(image, 'JPEG', margin, 5, 38, 15);
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(13);
                doc.text('Sri Eshwar College of Engineering', 57, 12);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.text('Event Tracking and Attendance Report', 57, 18);
            };

            drawHeader();
            let y = 39;
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(17);
            doc.text('Event Tracking Report', margin, y);
            y += 7;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(71, 85, 105);
            doc.text(`Assigned class: ${assignedClasses.join(', ')}  |  Prepared by: ${currentUser.name || currentUser.email || 'Faculty'}  |  Generated: ${reportDate.toLocaleString()}`, margin, y);
            y += 8;
            const cards = [['Records', displayData.length], ['Present', present], ['Absent', absent], ['Pending', pending]];
            const cardWidth = (pageWidth - (margin * 2) - 9) / 4;
            cards.forEach(([label, value], index) => {
                const x = margin + index * (cardWidth + 3);
                doc.setFillColor(248, 250, 252);
                doc.setDrawColor(226, 232, 240);
                doc.roundedRect(x, y, cardWidth, 18, 2, 2, 'FD');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.5);
                doc.setTextColor(100, 116, 139);
                doc.text(label.toUpperCase(), x + 4, y + 6);
                doc.setFontSize(14);
                doc.setTextColor(15, 23, 42);
                doc.text(String(value), x + 4, y + 13);
            });
            y += 28;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(15, 23, 42);
            doc.text('Participant Tracking Register', margin, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text('Attendance and registration status for the records currently loaded in this view.', margin, y + 4.5);

            autoTable(doc, {
                startY: y + 9,
                margin: { left: margin, right: margin, top: 35, bottom: 16 },
                head: [getExportRows()[0]],
                body: getExportRows().slice(1),
                theme: 'grid',
                showHead: 'everyPage',
                headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 6.8, cellPadding: 1.8, overflow: 'linebreak' },
                styles: { fontSize: 6.8, cellPadding: 1.8, textColor: [30, 41, 59], valign: 'middle', overflow: 'linebreak' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 45 }, 2: { cellWidth: 20 }, 3: { cellWidth: 29 }, 4: { cellWidth: 20 }, 5: { cellWidth: 14 }, 6: { cellWidth: 18 }, 7: { cellWidth: 18 } },
                didDrawPage: () => drawHeader()
            });

            const pageCount = doc.getNumberOfPages();
            for (let page = 1; page <= pageCount; page += 1) {
                doc.setPage(page);
                doc.setDrawColor(203, 213, 225);
                doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(100, 116, 139);
                doc.text('Confidential institutional record - Event Tracking', margin, pageHeight - 6);
                doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
            }
            doc.save(`Event_Tracking_${assignedClasses.join('_') || 'Report'}_${reportDate.toISOString().slice(0, 10)}.pdf`);
            showNotification('A4 PDF report exported successfully.', 'success');
        } catch (error) {
            console.error('Event tracking PDF export failed:', error);
            showNotification('Unable to export the PDF report.', 'error');
        } finally {
            setIsExporting(false);
        }
    };

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
                <div className="border-b border-slate-200 px-6 pt-6 pb-6 bg-white z-40 shrink-0">
                    <div className="max-w-6xl mx-auto w-full">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight flex items-center gap-2">
                                    <Activity className="text-blue-600" size={28} />
                                    Event Tracking
                                </h2>
                                <p className="text-slate-500 mt-1 text-sm font-medium">Department: <span className="font-bold text-slate-700">{departmentLabel(currentUser.department)}</span> <span className="text-slate-400">|</span> Class: <span className="font-bold text-slate-700">{assignedClasses.join(', ')}</span></p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5 shadow-sm">
                                    <ChevronLeft size={16} /> Back
                                </button>
                                <div className="relative">
                                    <button onClick={() => setIsExportMenuOpen((open) => !open)} disabled={!displayData.length || isExporting} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
                                        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                                        {isExporting ? 'Preparing...' : 'Export View'} <ChevronDown size={15} />
                                    </button>
                                    {isExportMenuOpen && <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"><p className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Choose report format</p><button onClick={() => { setIsExportMenuOpen(false); handleExportPDF(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-red-50"><span className="rounded-lg bg-red-50 p-2 text-red-600"><FileText size={17} /></span><span><span className="block text-sm font-bold text-slate-800">A4 PDF Report</span><span className="block text-xs text-slate-500">Professional 21 x 29.7 cm report</span></span></button><button onClick={() => { setIsExportMenuOpen(false); handleExportExcel(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-emerald-50"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><FileSpreadsheet size={17} /></span><span><span className="block text-sm font-bold text-slate-800">Excel Report</span><span className="block text-xs text-slate-500">Structured tracking register</span></span></button></div>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 min-h-0">
                    <div className="max-w-6xl mx-auto w-full h-full flex flex-col min-h-0">
                        <DataTable 
                            containerRef={tableContainerRef}
                            columns={columns}
                            data={displayData}
                            loading={loading}
                            error={error}
                            onRetry={actions.reload}
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
