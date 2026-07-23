import React, { useState, useEffect } from 'react';
import { notificationService } from '../../services/notificationService';
import { useAppContext } from '../../context/AppContext';
import { Activity, Send, Settings, AlertTriangle, CheckCircle, Clock, Search, Loader2 } from 'lucide-react';

export default function AdminNotificationTools() {
  const { currentUser } = useAppContext();
  const userId = currentUser?.id || currentUser?.uid;

  const [activeTab, setActiveTab] = useState('operations'); // 'operations' or 'monitoring'

  // Operations State
  const [testTitle, setTestTitle] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testStatus, setTestStatus] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState('Campus Closure');
  const [broadcastPriority, setBroadcastPriority] = useState('HIGH');
  const [broadcastStatus, setBroadcastStatus] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Monitoring State
  const [queueStatus, setQueueStatus] = useState(null);
  const [dlq, setDlq] = useState([]);
  const [isLoadingMonitoring, setIsLoadingMonitoring] = useState(false);

  const fetchMonitoringData = async () => {
    setIsLoadingMonitoring(true);
    try {
      const qRes = await notificationService.getQueueStatus();
      if (qRes.success) setQueueStatus(qRes.data);

      const dRes = await notificationService.getDLQ();
      if (dRes.success) setDlq(dRes.data);
    } catch (err) {
      console.error('Error fetching monitoring data:', err);
    } finally {
      setIsLoadingMonitoring(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'monitoring') {
      fetchMonitoringData();
    }
  }, [activeTab]);

  const handleTest = async () => {
    if (!testTitle || !testMessage) return;
    setIsTesting(true);
    try {
      await notificationService.sendTestNotification(userId, { title: testTitle, message: testMessage });
      setTestStatus('Test notification dispatched successfully!');
      setTimeout(() => setTestStatus(''), 3000);
      setTestTitle('');
      setTestMessage('');
    } catch (error) {
      setTestStatus('Failed to dispatch test notification.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastTitle || !broadcastMessage) return;
    setIsBroadcasting(true);
    try {
      await notificationService.sendBroadcast({
        title: broadcastTitle,
        message: broadcastMessage,
        type: broadcastType,
        priority: broadcastPriority
      });
      setBroadcastStatus('Broadcast successfully queued for delivery!');
      setTimeout(() => setBroadcastStatus(''), 3000);
      setBroadcastTitle('');
      setBroadcastMessage('');
    } catch (error) {
      setBroadcastStatus('Failed to send broadcast.');
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Notification Admin Tools</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Manage broadcasts, run tests, and monitor delivery queues.</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('operations')}
            className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
              activeTab === 'operations' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Operations & Testing
          </button>
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
              activeTab === 'monitoring' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Queue Monitoring & DLQ
          </button>
        </div>

        {activeTab === 'operations' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Test Notification Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-500" /> Send Test Notification
                </h2>
                <p className="text-xs text-slate-500 mt-1">Bypasses EventBus to test immediate delivery to your account.</p>
              </div>

              <div className="space-y-4 flex-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Title</label>
                  <input 
                    type="text" 
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. Test Alert"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Message</label>
                  <textarea 
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
                    placeholder="e.g. This is a system delivery test."
                  />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-600">{testStatus}</span>
                <button 
                  onClick={handleTest}
                  disabled={!testTitle || !testMessage || isTesting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Dispatch Test
                </button>
              </div>
            </div>

            {/* Broadcast Notification Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-500" /> System Broadcast
                </h2>
                <p className="text-xs text-slate-500 mt-1">Send global announcements to all active users on the platform.</p>
              </div>

              <div className="space-y-4 flex-1">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Type</label>
                    <select 
                      value={broadcastType}
                      onChange={(e) => setBroadcastType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option>Campus Closure</option>
                      <option>Holiday</option>
                      <option>Maintenance</option>
                      <option>Emergency</option>
                      <option>General Announcement</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Priority</label>
                    <select 
                      value={broadcastPriority}
                      onChange={(e) => setBroadcastPriority(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">CRITICAL</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Title</label>
                  <input 
                    type="text" 
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Server Maintenance at 2 AM"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Message</label>
                  <textarea 
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                    placeholder="Enter broadcast details..."
                  />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-blue-600">{broadcastStatus}</span>
                <button 
                  onClick={handleBroadcast}
                  disabled={!broadcastTitle || !broadcastMessage || isBroadcasting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isBroadcasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Broadcast
                </button>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            
            {/* Queue Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active</p>
                  <p className="text-2xl font-extrabold text-slate-800">{queueStatus?.active || 0}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Waiting</p>
                  <p className="text-2xl font-extrabold text-slate-800">{queueStatus?.waiting || 0}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Delayed</p>
                  <p className="text-2xl font-extrabold text-slate-800">{queueStatus?.delayed || 0}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Failed</p>
                  <p className="text-2xl font-extrabold text-slate-800">{queueStatus?.failed || 0}</p>
                </div>
              </div>
            </div>

            {/* DLQ */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" /> Dead Letter Queue (DLQ)
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Permanently failed notifications requiring manual intervention.</p>
                </div>
                <button 
                  onClick={fetchMonitoringData}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 flex items-center gap-2"
                >
                  <Activity className="w-4 h-4" /> Refresh
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-3">Task ID</th>
                      <th className="px-6 py-3">Recipient</th>
                      <th className="px-6 py-3">Error Context</th>
                      <th className="px-6 py-3">Failed At</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingMonitoring ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                          Loading...
                        </td>
                      </tr>
                    ) : dlq.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                          The DLQ is currently empty.
                        </td>
                      </tr>
                    ) : (
                      dlq.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">{item.id}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{item.recipientId}</td>
                          <td className="px-6 py-4 text-sm text-red-600 font-medium">{item.error}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{new Date(item.failedAt).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right">
                            <button className="text-blue-600 hover:text-blue-800 text-sm font-semibold mx-2">Retry</button>
                            <button className="text-red-600 hover:text-red-800 text-sm font-semibold">Drop</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
