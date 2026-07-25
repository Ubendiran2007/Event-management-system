import React, { useState, useEffect, useRef } from 'react';
import { Search, X, CheckCircle, Clock } from 'lucide-react';

const EventManagerSelector = ({ selectedManagers, onChange }) => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Fetch all users for autocomplete
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'}/api/users`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}` // assuming token is in localStorage
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
  }, []);

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
    if (!selectedManagers.find(m => m.userId === user.id)) {
      onChange([...selectedManagers, {
        userId: user.id,
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
    <div className="space-y-3">
      <label className="text-sm font-semibold text-slate-700">Event Managers</label>
      
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
          />
        </div>
        
        {isDropdownOpen && searchTerm.length > 1 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
            {filteredUsers.length > 0 ? (
              filteredUsers.map(user => (
                <div 
                  key={user.id} 
                  className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                  onClick={() => handleSelect(user)}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                  <span className="text-xs font-medium text-slate-400">{user.department || 'Staff'}</span>
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-slate-500 text-center">No users found</div>
            )}
          </div>
        )}
      </div>

      {selectedManagers.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selectedManagers.map(manager => (
            <div key={manager.userId} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-800">{manager.name}</span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  {manager.status === 'ACCEPTED' ? (
                    <><CheckCircle size={10} className="text-emerald-500" /> Accepted</>
                  ) : manager.status === 'DECLINED' ? (
                    <><X size={10} className="text-red-500" /> Declined</>
                  ) : (
                    <><Clock size={10} className="text-amber-500" /> Pending Invite</>
                  )}
                </span>
              </div>
              <button 
                type="button"
                onClick={() => handleRemove(manager.userId)}
                className="ml-2 p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventManagerSelector;
