import React, { useState, useEffect, useRef } from 'react';
import { Search, X, CheckCircle, Clock, Sparkles, AlertTriangle, UserPlus, Info, ShieldAlert } from 'lucide-react';

const EventManagerSelector = ({ 
  selectedManagers = [], 
  onChange, 
  eventId = null, 
  date = '', 
  startTime = '', 
  endTime = '', 
  department = '' 
}) => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [managerConflicts, setManagerConflicts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef(null);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com';

  useEffect(() => {
    // Fetch all users for autocomplete
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/users`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        if (data.success && data.users) {
          setUsers(data.users);
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };
    fetchUsers();
  }, [backendUrl]);

  // Check real-time availability of currently selected managers when date/time/list changes
  useEffect(() => {
    if (!selectedManagers.length || !date) {
      setManagerConflicts([]);
      return;
    }

    const checkAvailability = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/events/check-manager-availability`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            eventId,
            date,
            startTime,
            endTime,
            managerIds: selectedManagers.map(m => m.userId)
          })
        });
        const data = await res.json();
        if (data.conflicts) {
          setManagerConflicts(data.conflicts);
        } else {
          setManagerConflicts([]);
        }
      } catch (err) {
        console.error('Error checking manager availability:', err);
      }
    };

    const timer = setTimeout(checkAvailability, 400);
    return () => clearTimeout(timer);
  }, [selectedManagers, date, startTime, endTime, eventId, backendUrl]);

  // Fetch smart recommendations
  const fetchSuggestions = async () => {
    if (!date) return;
    setLoadingSuggestions(true);
    setShowSuggestions(true);
    try {
      const res = await fetch(`${backendUrl}/api/events/suggest-managers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          eventId,
          date,
          startTime,
          endTime,
          department,
          limit: 5,
          excludedIds: selectedManagers.map(m => m.userId)
        })
      });
      const data = await res.json();
      if (data.success && data.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error('Error fetching manager suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (user) => {
    const userId = user.id || user.userId;
    if (!selectedManagers.find(m => m.userId === userId)) {
      onChange([...selectedManagers, {
        userId: userId,
        name: user.name,
        email: user.email,
        department: user.department,
        status: 'INVITED'
      }]);
    }
    setSearchTerm('');
    setIsDropdownOpen(false);
  };

  const handleRemove = (userId) => {
    onChange(selectedManagers.filter(m => m.userId !== userId));
  };

  const filteredUsers = users.filter(u => 
    (u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     u.email?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    !selectedManagers.find(m => m.userId === u.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          Event Managers
          {managerConflicts.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 animate-pulse">
              <ShieldAlert size={12} /> {managerConflicts.length} Conflict{managerConflicts.length > 1 ? 's' : ''} Detected
            </span>
          )}
        </label>
        {date && (
          <button
            type="button"
            onClick={fetchSuggestions}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm hover:from-purple-700 hover:to-indigo-700 transition-all transform active:scale-95"
          >
            <Sparkles size={13} className="animate-spin-slow" />
            Smart Suggestions
          </button>
        )}
      </div>
      
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm transition-all"
            placeholder="Search student managers by name or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
          />
        </div>
        
        {isDropdownOpen && searchTerm.length > 1 && (
          <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
            {filteredUsers.length > 0 ? (
              filteredUsers.map(user => (
                <div 
                  key={user.id} 
                  className="px-4 py-2.5 hover:bg-purple-50/50 cursor-pointer flex justify-between items-center transition-colors"
                  onClick={() => handleSelect(user)}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                    {user.department || 'Staff'}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-slate-500 text-center">No users found matching "{searchTerm}"</div>
            )}
          </div>
        )}
      </div>

      {/* Selected Managers List with Real-time Conflict & Availability Badges */}
      {selectedManagers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
          {selectedManagers.map(manager => {
            const conflict = managerConflicts.find(c => String(c.studentId) === String(manager.userId));
            return (
              <div 
                key={manager.userId} 
                className={`group relative flex items-start justify-between p-3 rounded-xl border transition-all ${
                  conflict 
                    ? 'bg-red-50/80 border-red-200 shadow-sm' 
                    : 'bg-slate-50 border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-800 truncate">{manager.name}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-600">
                      {manager.department || 'GEN'}
                    </span>
                  </div>
                  
                  {/* Availability Badge */}
                  <div className="mt-1 flex items-center gap-1.5 text-xs">
                    {conflict ? (
                      <div className="flex items-center gap-1 text-red-600 font-medium">
                        <AlertTriangle size={13} className="shrink-0" />
                        <span className="truncate" title={`${conflict.reason}: ${conflict.conflictingEvent} (${conflict.startTime}-${conflict.endTime})`}>
                          Conflict: {conflict.conflictingEvent} ({conflict.startTime}-{conflict.endTime})
                        </span>
                      </div>
                    ) : date ? (
                      <div className="flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircle size={13} className="shrink-0" />
                        <span>Available during event</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Invite Status */}
                  <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                    {manager.status === 'ACCEPTED' ? (
                      <span className="text-emerald-700 font-medium">● Accepted Invite</span>
                    ) : manager.status === 'DECLINED' ? (
                      <span className="text-red-700 font-medium">● Declined Invite</span>
                    ) : (
                      <span className="text-amber-600 font-medium">● Invite Pending</span>
                    )}
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={() => handleRemove(manager.userId)}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-red-500 transition-colors shrink-0 shadow-2xs group-hover:opacity-100"
                  title="Remove manager"
                >
                  <X size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Smart Suggestions Panel */}
      {showSuggestions && (
        <div className="mt-4 p-4 bg-gradient-to-br from-purple-50 to-indigo-50/50 border border-purple-100 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-600 text-white rounded-lg shadow-2xs">
                <Sparkles size={14} />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Smart Manager Recommendations</h5>
                <p className="text-[11px] text-slate-500">Sorted by least active workload and department match ({department || 'All'})</p>
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => setShowSuggestions(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X size={14} />
            </button>
          </div>

          {loadingSuggestions ? (
            <div className="py-6 flex flex-col items-center justify-center text-slate-500 text-xs">
              <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mb-2"></div>
              Analyzing workloads and schedules...
            </div>
          ) : suggestions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {suggestions.map(s => (
                <div key={s.userId} className="flex items-center justify-between p-2.5 bg-white border border-purple-100/80 rounded-xl shadow-2xs hover:border-purple-300 transition-all">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-slate-800 truncate">{s.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-purple-50 text-purple-700 rounded border border-purple-100">
                        {s.department || 'GEN'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        📊 {s.workload} active event{s.workload !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelect(s)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-purple-600 text-white rounded-lg shadow-2xs hover:bg-purple-700 transition-colors shrink-0"
                  >
                    <UserPlus size={13} /> Add
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-slate-500">
              No available alternative managers found for this time window.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EventManagerSelector;
