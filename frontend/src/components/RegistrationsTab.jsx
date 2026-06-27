import React, { useState, useMemo } from 'react';
import { Users, Search } from 'lucide-react';
import { formatStudentNameWithRoll, fallbackValue } from '../utils/formatters';

const RegistrationsTab = ({ event, odRequests = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const eventRequests = odRequests.filter(req => req.eventId === event.id);
  const isVolunteerEnabled = Boolean(event?.registrationOptions?.allowVolunteer);

  const filteredRequests = useMemo(() => {
    return eventRequests.filter(req => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        (req.studentName && req.studentName.toLowerCase().includes(searchLower)) ||
        (req.rollNo && req.rollNo.toLowerCase().includes(searchLower));

      return matchesSearch;
    });
  }, [eventRequests, searchQuery, isVolunteerEnabled]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-800">Event Registrations</h3>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold ml-2">
              {filteredRequests.length}
            </span>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                <th className="p-4 w-16 text-center">S.No</th>
                <th className="p-4 w-32">Roll No</th>
                <th className="p-4 min-w-[200px]">Student Name</th>
                <th className="p-4 w-32">Class</th>
                {isVolunteerEnabled && <th className="p-4 w-32">Type</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((req, idx) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 transition-colors bg-white">
                    <td className="p-4 text-center text-sm font-semibold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="p-4 text-sm font-bold text-indigo-900">
                      {req.rollNo || '-'}
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-bold text-slate-800">{req.studentName || 'Unknown'}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-500 font-medium">
                      {fallbackValue(req.class, 'General')}
                    </td>
                    {isVolunteerEnabled && (
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          req.registrationType === 'VOLUNTEER' 
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {req.registrationType === 'VOLUNTEER' ? 'Volunteer' : 'Participant'}
                        </span>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isVolunteerEnabled ? 5 : 4} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Users size={40} className="text-slate-300 mb-3" />
                      <p className="text-sm font-bold text-slate-700">No registrations found</p>
                      <p className="text-xs text-slate-500 mt-1">Adjust your search or filters to see results.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default RegistrationsTab;
