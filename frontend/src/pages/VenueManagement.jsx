import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, AlertCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import Layout from '../components/Layout';

const VenueManagement = () => {
  const { currentUser } = useAppContext();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchVenues();
  }, []);

  const fetchVenues = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001'}/api/venues`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setVenues(data.data);
      } else {
        setError(data.message || 'Failed to fetch venues');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (currentUser?.role !== 'IQAC' && currentUser?.role !== 'SUPER_ADMIN') {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
            <h2 className="text-xl font-bold text-slate-800">Unauthorized Access</h2>
            <p className="text-slate-600">You do not have permission to manage the Venue Master.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="text-cse-accent" />
              Venue Master Management
            </h1>
            <p className="text-slate-500 mt-1">Manage institutional venues, capacities, and maintenance schedules.</p>
          </div>
          <button className="btn-primary flex items-center gap-2 bg-cse-primary hover:bg-cse-hover text-white px-4 py-2 rounded-xl font-semibold shadow-sm transition-all">
            <Plus size={18} />
            Add Venue
          </button>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 text-rose-600 rounded-xl flex items-center gap-2 text-sm font-medium">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="glass-panel p-6 rounded-2xl">
          {loading ? (
            <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-cse-primary border-t-transparent rounded-full animate-spin"></div></div>
          ) : venues.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No venues configured yet. Click "Add Venue" to begin.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-3 px-4 font-semibold text-slate-600 text-sm">VENUE</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-sm">LOCATION</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-sm">CAPACITY</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-sm">STATUS</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-sm text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {venues.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{v.name}</div>
                        <div className="text-xs text-slate-500">{v.type}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">{v.building} - Floor {v.floor}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{v.capacity} Seats</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          v.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                          v.status === 'MAINTENANCE' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button className="p-2 text-slate-400 hover:text-cse-primary hover:bg-slate-100 rounded-lg transition-colors">
                          <Edit2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default VenueManagement;
