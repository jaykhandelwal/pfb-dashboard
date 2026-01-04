import React from 'react';
import { useStore } from '../context/StoreContext';
import { Sliders, Phone, User, Info, Save } from 'lucide-react';

const AppSettings: React.FC = () => {
  const { appSettings, updateAppSetting } = useStore();

  const handleToggle = (key: string) => {
    const currentValue = appSettings[key];
    updateAppSetting(key, !currentValue);
  };

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Sliders className="text-indigo-600" /> App Settings
        </h2>
        <p className="text-slate-500">Configure global application behavior remotely.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
           <h3 className="font-bold text-slate-800">Order Requirements</h3>
           <p className="text-xs text-slate-500">Control mandatory fields during order creation.</p>
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

      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
         <Info className="text-blue-600 shrink-0 mt-0.5" size={20} />
         <div className="text-sm text-blue-800">
            <strong>Note:</strong> Changes made here are saved to the cloud immediately and will reflect on all devices running the app (including Android POS) in real-time.
         </div>
      </div>
    </div>
  );
};

export default AppSettings;