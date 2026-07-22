import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { EventStatus } from '../../types';

const EventTrendChart = ({ events }) => {
  const data = useMemo(() => {
    if (!events || events.length === 0) return [];
    const monthlyData = {};
    events.forEach(e => {
       const dateStr = e.startDate;
       if(dateStr) {
          const d = new Date(dateStr);
          const monthYear = d.toLocaleString('default', { month: 'short', year: '2-digit' });
          if(!monthlyData[monthYear]) monthlyData[monthYear] = { name: monthYear, total: 0, completed: 0 };
          monthlyData[monthYear].total += 1;
          if (e.status === EventStatus.COMPLETED) monthlyData[monthYear].completed += 1;
       }
    });

    // Sort by actual date
    return Object.values(monthlyData).sort((a, b) => {
       const [aM, aY] = a.name.split(' ');
       const [bM, bY] = b.name.split(' ');
       const d1 = new Date(`${aM} 1, 20${aY}`);
       const d2 = new Date(`${bM} 1, 20${bY}`);
       return d1 - d2;
    });
  }, [events]);

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Monthly Event Trend</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dx={-10} allowDecimals={false} />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Area type="monotone" dataKey="total" name="Total Events" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotal)" />
          <Area type="monotone" dataKey="completed" name="Completed Events" stroke="#10b981" fillOpacity={1} fill="url(#colorCompleted)" />
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EventTrendChart;
