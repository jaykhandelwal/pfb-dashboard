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
    <div className={`${color} p-6 rounded-xl shadow-sm border border-[#403424]/10 flex items-start justify-between`}>
      <div>
        <p className="text-sm font-medium text-[#403424]/70 uppercase tracking-wide">{title}</p>
        <h3 className="text-2xl font-bold text-[#403424] mt-2">{value}</h3>
        {trend && <p className="text-xs text-[#95a77c] mt-1 font-medium">{trend}</p>}
      </div>
      <div className="p-3 bg-[#eff2e7] rounded-lg text-[#403424]">
        {icon}
      </div>
    </div>
  );
};