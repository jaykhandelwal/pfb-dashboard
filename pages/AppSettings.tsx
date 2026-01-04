
import React from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { Sliders, Phone, User, Info, FlaskConical, CheckSquare } from 'lucide-react';

const AppSettings: React.FC = () => {
  const { appSettings, updateAppSetting } = useStore();
  const { currentUser } = useAuth();

  const handleToggle = (key: string) => {
    // Permission Check specifically for BETA features
    if (key === 'enable_beta_tasks' && currentUser?.role !== 'ADMIN') {
       alert("Beta features can only be activated by an Admin.");
       return;
    }

    const currentValue = appSettings[key];
    updateAppSetting(key, !currentValue);
  };

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Sliders className="text-slate-600" /> Settings
        </h2>
        <p className="text-slate-500">Configure application behavior and experimental features.</p>
      </div>

      <div className="space-y-8 animate-fade-in">
        
        {/* Section 1: App Configuration */}
        <section>
           <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 pl-1">App Configuration</h3>
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50">
                 <h3 className="font-bold text-slate-800">Order Requirements</h3>
                 <p className="text-xs text-slate-500">Control mandatory fields during POS order creation.</p>
              </div>

              <div className="divide-y divide-slate-100">
                 {/* Setting 1: Require Phone */}
                 <div className="p-6 flex items-center justify-between">
                    <div className="flex gap-4">
                       <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Phone size={20} />
                       </div>
                       <div>
                          <h4 className="font-bold text-slate-700">Require Customer Phone</h4>
                          <p className="text-sm text-slate-500">
                             Enforces linking a customer (phone number) before an order can be placed.
                          </p>
                       </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                       <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={appSettings.require_customer_phone || false}
                          onChange={() => handleToggle('require_customer_phone')}
                       />
                       <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                 </div>

                 {/* Setting 2: Require Name */}
                 <div className="p-6 flex items-center justify-between">
                    <div className="flex gap-4">
                       <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <User size={20} />
                       </div>
                       <div>
                          <h4 className="font-bold text-slate-700">Require Customer Name</h4>
                          <p className="text-sm text-slate-500">
                             Ensures that any linked customer must have a name assigned.
                          </p>
                       </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                       <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={appSettings.require_customer_name || false}
                          onChange={() => handleToggle('require_customer_name')}
                       />
                       <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                 </div>
              </div>
           </div>
        </section>

        {/* Section 2: Beta Features */}
        <section>
           <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 pl-1 flex items-center gap-2">
              <FlaskConical size={14} className="text-purple-500"/> Beta Features
           </h3>
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-purple-50">
                 <h3 className="font-bold text-purple-900">Experimental Lab</h3>
                 <p className="text-xs text-purple-700">
                    New features in development. Only Admins can enable these globally.
                 </p>
              </div>

              <div className="divide-y divide-slate-100">
                 {/* Setting: Task Management */}
                 <div className="p-6 flex items-center justify-between">
                    <div className="flex gap-4">
                       <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                          <CheckSquare size={20} />
                       </div>
                       <div>
                          <h4 className="font-bold text-slate-700 flex items-center gap-2">
                             Task Management
                             <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 uppercase font-bold">Beta</span>
                          </h4>
                          <p className="text-sm text-slate-500">
                             Enable the "My Tasks" section on the Dashboard. Allows Admins to assign tasks to staff.
                          </p>
                       </div>
                    </div>
                    <label className={`relative inline-flex items-center cursor-pointer ${currentUser?.role !== 'ADMIN' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                       <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={appSettings.enable_beta_tasks || false}
                          onChange={() => handleToggle('enable_beta_tasks')}
                          disabled={currentUser?.role !== 'ADMIN'}
                       />
                       <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                 </div>
              </div>
           </div>
        </section>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
           <Info className="text-blue-600 shrink-0 mt-0.5" size={20} />
           <div className="text-sm text-blue-800">
              <strong>Note:</strong> Changes made here are saved to the cloud immediately and will reflect on all devices running the app (including Android POS) in real-time.
           </div>
        </div>

      </div>
    </div>
  );
};

export default AppSettings;