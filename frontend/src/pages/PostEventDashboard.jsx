import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import VerificationProgress from '../components/VerificationProgress';
import { useAuth } from '../context/AuthContext';
import { EventStatus } from '../types';

/**
 * Post Event Dashboard
 * Centralized UI for managing post-event modules.
 * Integrates with PostEventService API.
 */
export default function PostEventDashboard() {
  const { eventId } = useParams();
  const { currentUser } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sections defining the workspace
  const sections = [
    { id: 'summary', title: 'Event Summary', owner: 'Manager', required: true },
    { id: 'attendance', title: 'Attendance', owner: 'Manager', required: true },
    { id: 'resourcePerson', title: 'Resource Person', owner: 'Manager', required: false },
    { id: 'feedback', title: 'Feedback', owner: 'Organizer/System', required: true },
    { id: 'media', title: 'Media', owner: 'Media Team', required: false }, // Conditionally required
    { id: 'budget', title: 'Budget & Expenses', owner: 'Organizer', required: true },
    { id: 'documents', title: 'Documents', owner: 'Manager', required: false }
  ];

  useEffect(() => {
    // In a real implementation, fetch event data here
    // fetchEventDetails(eventId).then(data => setEvent(data));
    setLoading(false);
  }, [eventId]);

  const handleSubmitWorkspace = async () => {
    // const res = await fetch(`/api/post-event/${eventId}/submit`, { method: 'POST', headers: { Authorization: ... }});
    alert('Post Event Workspace Submitted for Verification!');
  };

  if (loading) return <div>Loading...</div>;

  // Placeholder for UI display
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Post Event Workspace</h1>
          <p className="text-slate-500 mt-1">Complete all required sections below to submit for verification.</p>
        </div>
        <button 
          onClick={handleSubmitWorkspace}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow font-medium"
        >
          Submit for Verification
        </button>
      </div>

      {/* Verification Stepper */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <VerificationProgress event={event} />
      </div>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map(section => (
          <div key={section.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-semibold text-slate-800">{section.title}</h3>
              {section.required && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">Required</span>}
            </div>
            
            <p className="text-sm text-slate-500">Owned by: {section.owner}</p>
            
            {/* Status Placeholder */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm font-medium text-slate-400">DRAFT</span>
              <button className="text-sm text-blue-600 font-medium hover:underline">Edit</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
