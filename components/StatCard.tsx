import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, color = "bg-white" }) => {
  return (
    <div className={`${color} p-6 rounded-xl shadow-sm border border-slate-200 flex items-start justify-between`}>
      <div>
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 mt-2">{value}</h3>
        {trend && <p className="text-xs text-green-600 mt-1 font-medium">{trend}</p>}
      </div>
      <div className="p-3 bg-slate-100 rounded-lg text-slate-600">
        {icon}
      </div>
    </div>
  );
};