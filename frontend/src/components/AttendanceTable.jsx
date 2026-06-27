import React, { useState, useMemo } from 'react';
import { Search, Filter } from 'lucide-react';
import { formatRollNo, formatStudentNameOnly } from '../utils/formatters';

const AttendanceTable = ({ event, odRequests, eventDates }) => {
  const [filter, setFilter] = useState('All'); // 'All', 'Present', 'Absent', 'FN', 'AN'
  const [search, setSearch] = useState('');

  const approvedStudents = useMemo(() => {
    return (odRequests || []).filter(r => r.eventId === event.id && r.status === 'APPROVED');
  }, [odRequests, event.id]);

  const tableData = useMemo(() => {
    return approvedStudents.map(student => {
      const attendance = student.attendance || {};
      
      let allFinalized = true;
      let hasAnyAttendance = false;
      let missedAnyRequired = false;
      
      const dayStatuses = eventDates.map(date => {
        const config = (event.attendanceConfigs || {})[date];
        const isFinalized = config && config.attendanceFinalized;
        if (!isFinalized) allFinalized = false;
        
        const mode = config ? config.attendanceType : 'Single Session';
        const data = attendance[date] || {};
        const s1 = data.S1 || data.FN || false;
        const s2 = data.S2 || data.AN || false;
        
        if (s1 || s2) hasAnyAttendance = true;
        if (mode === 'Both Sessions') {
            if (!s1 || !s2) missedAnyRequired = true;
        } else {
            if (!s1) missedAnyRequired = true;
        }
        
        let status = 'A';
        if (!config || config.session1Status === 'NotStarted') {
            status = 'Pending';
        } else if (mode === 'Single Session') {
            if (s1) status = 'P';
        } else {
            if (s1 && s2) status = 'P';
            else if (s1) status = 'FN';
            else if (s2) status = 'AN';
        }
        return { date, status, mode };
      });
      
      let overallStatus = 'Pending';
      if (allFinalized) {
          if (!hasAnyAttendance) overallStatus = 'Absent';
          else if (missedAnyRequired) overallStatus = 'Partially Attended';
          else overallStatus = 'Fully Attended';
      }
      
      return {
        ...student,
        dayStatuses,
        overallStatus
      };
    });
  }, [approvedStudents, event.attendanceConfigs, eventDates]);

  const filteredData = useMemo(() => {
    return tableData.filter(student => {
      if (search) {
         const q = search.toLowerCase();
         if (!((student.studentName || '').toLowerCase().includes(q) || (student.rollNo || '').toLowerCase().includes(q))) {
           return false;
         }
      }
      if (filter !== 'All') {
        const hasMatch = student.dayStatuses.some(d => {
            if (filter === 'Present' && d.status === 'P') return true;
            if (filter === 'Absent' && d.status === 'A') return true;
            if (filter === 'FN' && d.status === 'FN') return true;
            if (filter === 'AN' && d.status === 'AN') return true;
            return false;
        });
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [tableData, search, filter]);

  const getStatusColor = (status) => {
      if (status === 'P' || status === 'Fully Attended') return 'bg-emerald-100 text-emerald-700 font-bold';
      if (status === 'FN' || status === 'AN' || status === 'Partially Attended') return 'bg-amber-100 text-amber-700 font-bold';
      if (status === 'Pending') return 'bg-slate-100 text-slate-500 font-semibold italic';
      return 'bg-red-50 text-red-600 font-bold';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm mt-6">
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="font-bold text-slate-800">Attendance Roster</h3>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
             <input type="text" placeholder="Search by name or roll no..." 
               value={search} onChange={(e) => setSearch(e.target.value)}
               className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:border-indigo-500"
             />
          </div>
          <div className="flex items-center gap-2">
             <Filter size={16} className="text-slate-400" />
             <select value={filter} onChange={(e) => setFilter(e.target.value)}
                className="py-2 pl-3 pr-8 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-white">
                <option value="All">All Status</option>
                <option value="Present">Present (P)</option>
                <option value="Absent">Absent (A)</option>
                <option value="FN">FN Only</option>
                <option value="AN">AN Only</option>
             </select>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
            <tr>
              <th className="p-4">S.No</th>
              <th className="p-4">Roll No</th>
              <th className="p-4">Student Name</th>
              {eventDates.map((date, i) => (
                 <th key={date} className="p-4 text-center">
                    {new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')}
                 </th>
              ))}
              <th className="p-4 text-center">Overall Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredData.length === 0 ? (
               <tr>
                 <td colSpan={3 + eventDates.length} className="p-8 text-center text-slate-500">
                    No students match the criteria.
                 </td>
               </tr>
            ) : (
               filteredData.map((student, idx) => (
                 <tr key={student.id} className="hover:bg-slate-50/50">
                    <td className="p-4 text-slate-500">{idx + 1}</td>
                    <td className="p-4 font-medium text-slate-800">{formatRollNo(student.rollNo, student.studentId)}</td>
                    <td className="p-4 text-slate-700">{formatStudentNameOnly(student.studentName)}</td>
                    {student.dayStatuses.map((ds, i) => (
                       <td key={i} className="p-4 text-center border-l border-slate-100">
                          <span className={`px-2.5 py-1 rounded-md text-xs tracking-wide ${getStatusColor(ds.status)}`}>
                             {ds.status}
                          </span>
                       </td>
                    ))}
                    <td className="p-4 text-center border-l border-slate-100">
                       <span className={`px-3 py-1.5 rounded-lg text-xs tracking-wide ${getStatusColor(student.overallStatus)}`}>
                          {student.overallStatus}
                       </span>
                    </td>
                 </tr>
               ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default AttendanceTable;
