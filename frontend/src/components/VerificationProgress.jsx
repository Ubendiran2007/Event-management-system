import React from 'react';
import { CheckCircle2, Clock, Circle } from 'lucide-react';
import { EventStatus } from '../../types'; // Adjust path if needed

/**
 * Visual stepper tracking Faculty -> HOD -> IQAC verification progress.
 */
export default function VerificationProgress({ event }) {
  if (!event) return null;

  // Determine current stage based on status
  const statuses = [
    'PENDING_FACULTY_VERIFICATION',
    'PENDING_HOD_VERIFICATION',
    'PENDING_IQAC_VERIFICATION',
    EventStatus.COMPLETED,
    EventStatus.ARCHIVED
  ];

  const currentIdx = statuses.indexOf(event.status);
  
  // If not even reached verification phase yet
  if (currentIdx === -1) {
    if (event.status === EventStatus.ENDED || event.status === 'POST_EVENT_IN_PROGRESS') {
      // In progress
    } else {
      return null; 
    }
  }

  const steps = [
    { id: 'faculty', label: 'Faculty Review' },
    { id: 'hod', label: 'HOD Review' },
    { id: 'iqac', label: 'IQAC Review' }
  ];

  const getStepStatus = (index) => {
    if (currentIdx === -1) return 'pending'; // Workspace still active
    if (currentIdx > index) return 'completed';
    if (currentIdx === index) return 'current';
    return 'pending';
  };

  return (
    <div className="w-full py-4">
      <h3 className="text-sm font-medium text-slate-700 mb-4">Verification Progress</h3>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.id} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1 relative">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 bg-white z-10
                  ${status === 'completed' ? 'border-green-500 text-green-500' : 
                    status === 'current' ? 'border-amber-500 text-amber-500' : 
                    'border-slate-300 text-slate-300'}`}
                >
                  {status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : 
                   status === 'current' ? <Clock className="w-4 h-4" /> : 
                   <Circle className="w-4 h-4 text-slate-300" />}
                </div>
                <span className={`mt-2 text-xs font-medium 
                  ${status === 'completed' ? 'text-green-600' : 
                    status === 'current' ? 'text-amber-600' : 
                    'text-slate-500'}`}
                >
                  {step.label}
                </span>
                
                {/* Connecting Line */}
                {!isLast && (
                  <div className={`absolute top-4 left-[50%] w-full h-[2px] 
                    ${status === 'completed' ? 'bg-green-500' : 'bg-slate-200'}`} 
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
