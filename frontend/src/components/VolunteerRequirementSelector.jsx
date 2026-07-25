import React from 'react';
import { Plus, X } from 'lucide-react';


const VOLUNTEER_ROLES = [
  'General Volunteer',
  'Registration Desk',
  'Hospitality',
  'Stage Management',
  'Technical Support',
  'Media & Photography',
  'Discipline & Crowd Control',
  'Other'
];

const VolunteerRequirementSelector = ({ requirements, onChange, departments = [] }) => {

  const addRequirement = () => {
    onChange([...requirements, {
      id: Date.now().toString(),
      role: 'General Volunteer',
      department: 'Any',
      count: 1
    }]);
  };

  const updateRequirement = (id, field, value) => {
    onChange(requirements.map(req => 
      req.id === id ? { ...req, [field]: value } : req
    ));
  };

  const removeRequirement = (id) => {
    onChange(requirements.filter(req => req.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700">Volunteer Requirements</label>
        <button 
          type="button"
          onClick={addRequirement}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Plus size={14} /> Add Role
        </button>
      </div>
      
      {requirements.length === 0 ? (
        <div className="p-4 border border-slate-200 border-dashed rounded-xl text-center text-sm text-slate-500 bg-slate-50">
          No volunteers requested. Click "Add Role" to request volunteers.
        </div>
      ) : (
        <div className="space-y-3">
          {requirements.map((req) => (
            <div key={req.id} className="flex flex-col sm:flex-row gap-3 p-3 bg-white border border-slate-200 rounded-xl relative group">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Role</label>
                <select
                  value={req.role}
                  onChange={(e) => updateRequirement(req.id, 'role', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {VOLUNTEER_ROLES.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Department Pref.</label>
                <select
                  value={req.department}
                  onChange={(e) => updateRequirement(req.id, 'department', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Any">Any Department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              
              <div className="w-full sm:w-24">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Count</label>
                <input
                  type="number"
                  min="1"
                  value={req.count}
                  onChange={(e) => updateRequirement(req.id, 'count', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              
              <button
                type="button"
                onClick={() => removeRequirement(req.id)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-200"
                title="Remove requirement"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VolunteerRequirementSelector;
