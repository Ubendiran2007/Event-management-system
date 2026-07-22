import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { EventStatus } from '../../types';

const ApprovalPipelineChart = ({ events }) => {
  const data = useMemo(() => {
    if (!events) return [];
    
    let pendingF = 0, pendingH = 0, pendingInc = 0, pendingI = 0, approved = 0, rejected = 0;
    
    events.forEach(e => {
       switch(e.status) {
          case EventStatus.PENDING_CLASS_ADVISOR: pendingF++; break;
          case EventStatus.PENDING_HOD: pendingH++; break;
          case EventStatus.PENDING_DEPARTMENTS: pendingInc++; break;
          case EventStatus.PENDING_IQAC: pendingI++; break;
          case EventStatus.PENDING_PRINCIPAL: pendingI++; break; // Grouping with IQAC/Principal if needed, or maybe drop Principal? User didn't say Principal. Wait, I'll ignore Principal for now since they didn't mention it, or group it into IQAC. Actually I'll just map PENDING_PRINCIPAL to pendingI too, or leave it out if they only want these 6 bars. Let's just map it to IQAC for now.
          case EventStatus.APPROVED:
          case EventStatus.COMPLETED: approved++; break;
          case EventStatus.REJECTED: rejected++; break;
          default: break;
       }
    });

    return [
       { name: 'Pending Faculty', count: pendingF, color: '#f59e0b' },
       { name: 'Pending HOD', count: pendingH, color: '#f59e0b' },
       { name: 'Pending Incharges', count: pendingInc, color: '#f59e0b' },
       { name: 'Pending IQAC', count: pendingI, color: '#f59e0b' },
       { name: 'Approved', count: approved, color: '#10b981' },
       { name: 'Rejected', count: rejected, color: '#ef4444' }
    ];
  }, [events]);

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Approval Pipeline</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} angle={-30} textAnchor="end" />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dx={-10} />
          <Tooltip 
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ApprovalPipelineChart;
