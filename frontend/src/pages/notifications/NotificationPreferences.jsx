import React, { useState, useEffect } from 'react';
import { notificationService } from '../../services/notificationService';
import { useAppContext } from '../../context/AppContext';
import { Save, Bell, Mail, Smartphone, Loader2, AlertTriangle } from 'lucide-react';

const CATEGORIES = ['EVENTS', 'REGISTRATIONS', 'OD', 'REPORTS', 'SYSTEM'];

export default function NotificationPreferences() {
  const { currentUser } = useAppContext();
  const userId = currentUser?.id || currentUser?.uid;

  const [globalPrefs, setGlobalPrefs] = useState({ IN_APP: true, EMAIL: true });
  const [categoryPrefs, setCategoryPrefs] = useState({});
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!userId) return;
    const fetchPrefs = async () => {
      try {
        const res = await notificationService.fetchPreferences(userId);
        if (res.success && res.data) {
          setGlobalPrefs(res.data.global || { IN_APP: true, EMAIL: true });
          setCategoryPrefs(res.data.categories || {});
        }
      } catch (err) {
        console.error('Failed to load preferences', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, [userId]);

  const handleGlobalChange = (channel) => {
    setGlobalPrefs(prev => ({ ...prev, [channel]: !prev[channel] }));
  };

  const handleCategoryChange = (category, channel) => {
    setCategoryPrefs(prev => {
      const catPrefs = prev[category] || { IN_APP: globalPrefs.IN_APP, EMAIL: globalPrefs.EMAIL };
      return {
        ...prev,
        [category]: { ...catPrefs, [channel]: !catPrefs[channel] }
      };
    });
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setMessage('');
    try {
      await notificationService.updatePreferences(userId, {
        global: globalPrefs,
        categories: categoryPrefs
      });
      setMessage('Preferences saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Notification Preferences</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Control how and when you receive updates.</p>
        </div>

        {/* Global Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-blue-500" /> Global Delivery Channels
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-700">In-App Notifications</p>
                <p className="text-sm text-slate-500">Receive alerts within the application.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={globalPrefs.IN_APP} onChange={() => handleGlobalChange('IN_APP')} />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-700">Email Notifications</p>
                <p className="text-sm text-slate-500">Receive alerts via email to your registered address.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={globalPrefs.EMAIL} onChange={() => handleGlobalChange('EMAIL')} />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Note on Critical */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">Critical Alerts</p>
            <p className="text-xs font-medium text-amber-700 mt-0.5">
              System alerts marked as CRITICAL will bypass these preferences and will always be delivered via all available channels.
            </p>
          </div>
        </div>

        {/* Category Overrides */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-lg font-bold text-slate-800">Category Overrides</h2>
            <p className="text-sm text-slate-500">Customize channels for specific types of notifications.</p>
          </div>
          
          <div className="divide-y divide-slate-100">
            {CATEGORIES.map(category => {
              const catPrefs = categoryPrefs[category] || { IN_APP: globalPrefs.IN_APP, EMAIL: globalPrefs.EMAIL };
              
              return (
                <div key={category} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-slate-700 capitalize">{category.toLowerCase()}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Overrides global settings for {category.toLowerCase()} events.</p>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => handleCategoryChange(category, 'IN_APP')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                        catPrefs.IN_APP ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      In-App {catPrefs.IN_APP ? 'On' : 'Off'}
                    </button>
                    <button 
                      onClick={() => handleCategoryChange(category, 'EMAIL')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                        catPrefs.EMAIL ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Email {catPrefs.EMAIL ? 'On' : 'Off'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-4 pt-2">
          {message && (
            <span className={`text-sm font-semibold ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
              {message}
            </span>
          )}
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Preferences
          </button>
        </div>

      </div>
    </div>
  );
}
