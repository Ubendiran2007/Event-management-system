import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { getAuth } from 'firebase/auth';

const ExportPanel = ({ reportName, data, headers }) => {
  const [isExporting, setIsExporting] = useState(false);
  const { showNotification } = useNotification();

  const logExport = async (exportType) => {
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      await fetch(`${import.meta.env.VITE_API_URL}/api/analytics/log-export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          exportType,
          reportName,
          status: 'SUCCESS'
        })
      });
    } catch (error) {
      console.error('Failed to log export:', error);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      if (!data || data.length === 0) {
        showNotification('No data to export', 'error');
        return;
      }
      
      const csvRows = [];
      if (headers) csvRows.push(headers.join(','));
      else if (data.length > 0) csvRows.push(Object.keys(data[0]).join(','));

      for (const row of data) {
        const values = Object.values(row).map(val => {
           const escaped = ('' + val).replace(/"/g, '""');
           return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
      }

      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${reportName}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      await logExport('CSV');
      showNotification('CSV exported successfully', 'success');
    } catch (e) {
      console.error(e);
      showNotification('Failed to export CSV', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
       const XLSX = await import('xlsx');
       const worksheet = XLSX.utils.json_to_sheet(data);
       if (headers) {
          XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: 'A1' });
       }
       const workbook = XLSX.utils.book_new();
       XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
       XLSX.writeFile(workbook, `${reportName}_${new Date().toISOString().split('T')[0]}.xlsx`);
       
       await logExport('Excel');
       showNotification('Excel exported successfully', 'success');
    } catch (e) {
      console.error(e);
      showNotification('Failed to export Excel', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
       const { jsPDF } = await import('jspdf');
       const doc = new jsPDF();
       doc.setFontSize(16);
       doc.text(reportName, 14, 22);
       doc.setFontSize(10);
       doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
       
       // Just a simple representation. Real apps would use autoTable.
       let y = 40;
       data.slice(0, 50).forEach((row, i) => {
          let text = Object.values(row).slice(0, 4).join(' | ');
          doc.text(text, 14, y);
          y += 8;
          if (y > 280) {
             doc.addPage();
             y = 20;
          }
       });
       
       if (data.length > 50) {
          doc.text(`... and ${data.length - 50} more rows.`, 14, y);
       }

       doc.save(`${reportName}_${new Date().toISOString().split('T')[0]}.pdf`);
       
       await logExport('PDF');
       showNotification('PDF exported successfully', 'success');
    } catch (e) {
      console.error(e);
      showNotification('Failed to export PDF', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
      <div>
        <h4 className="font-semibold text-slate-800">Export Report</h4>
        <p className="text-sm text-slate-500">Download the analytics dataset</p>
      </div>
      <div className="flex space-x-2">
        <button
          onClick={handleExportPDF}
          disabled={isExporting}
          className="flex items-center px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <FileText size={16} className="mr-2" /> PDF
        </button>
        <button
          onClick={handleExportExcel}
          disabled={isExporting}
          className="flex items-center px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <FileSpreadsheet size={16} className="mr-2" /> Excel
        </button>
        <button
          onClick={handleExportCSV}
          disabled={isExporting}
          className="flex items-center px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <FileJson size={16} className="mr-2" /> CSV
        </button>
      </div>
    </div>
  );
};

export default ExportPanel;
