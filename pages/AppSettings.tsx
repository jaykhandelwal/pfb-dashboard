
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { Sliders, Phone, User, Info, FlaskConical, CheckSquare, Loader2, CheckCircle2, MessageSquare, Globe, Lock } from 'lucide-react';

const AppSettings: React.FC = () => {
  const { appSettings, updateAppSetting, isLoading } = useStore();
  const { currentUser } = useAuth();
  
  // Local state to manage loading status per toggle to avoid race conditions
  const [savingKeys, setSavingKeys] = useState<string[]>([]);
  // Local state for toast
  const [toastMsg, setToastMsg] = useState('');
  // Local state for input fields (to debounce or handle blur save)
  const [webhookUrl, setWebhookUrl] = useState(appSettings.whatsapp_webhook_url || '');

  const handleToggle = async (key: string) => {
    // Prevent double clicks
    if (savingKeys.includes(key)) return;

    // Permission Check specifically for BETA features
    if ((key === 'enable_beta_tasks' || key === 'enable_whatsapp_webhook') && currentUser?.role !== 'ADMIN') {
       alert("Beta/Admin features can only be managed by an Admin.");
       return;
    }

    // Add to saving list
    setSavingKeys(prev => [...prev, key]);

    const currentValue = appSettings[key];
    const success = await updateAppSetting(key, !currentValue);

    // Remove from saving list
    setSavingKeys(prev => prev.filter(k => k !== key));

    if (success) {
        setToastMsg('Setting saved successfully!');
        setTimeout(() => setToastMsg(''), 3000);
    }
  };

  const handleTextSave = async (key: string, value: string) => {
      if (appSettings[key] === value) return; // No change

      setSavingKeys(prev => [...prev, key]);
      const success = await updateAppSetting(key, value);
      setSavingKeys(prev => prev.filter(k => k !== key));

      if (success) {
          setToastMsg('URL saved successfully!');
          setTimeout(() => setToastMsg(''), 3000);
      }
  };

  if (isLoading) {
      return (
          <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
              <p className="text-slate-500 font-medium">Loading Settings...</p>
          </div>
      );
  }

  return (
    <div className="max-w-3xl mx-auto pb-16 relative">
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
                    {savingKeys.includes('require_customer_phone') ? (
                        <Loader2 size={24} className="text-indigo-600 animate-spin" />
                    ) : (
                        <label className="relative inline-flex items-center cursor-pointer">
                           <input 
                              type="checkbox" 
                              className="sr-only peer"
                              checked={appSettings.require_customer_phone || false}
                              onChange={() => handleToggle('require_customer_phone')}
                           />
                           <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    )}
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
                    {savingKeys.includes('require_customer_name') ? (
                        <Loader2 size={24} className="text-indigo-600 animate-spin" />
                    ) : (
                        <label className="relative inline-flex items-center cursor-pointer">
                           <input 
                              type="checkbox" 
                              className="sr-only peer"
                              checked={appSettings.require_customer_name || false}
                              onChange={() => handleToggle('require_customer_name')}
                           />
                           <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    )}
                 </div>
              </div>
           </div>
        </section>

        {/* Section 2: Integrations (New) */}
        {currentUser?.role === 'ADMIN' && (
            <section>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 pl-1 flex items-center gap-2">
                    <Globe size={14} className="text-sky-500"/> Integrations & Webhooks
                </h3>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-sky-50">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-sky-900">WhatsApp Invoice Integration</h3>
                                <p className="text-xs text-sky-700">
                                    Send order details to a remote server for WhatsApp messaging.
                                </p>
                            </div>
                            <div className="bg-white/50 px-2 py-1 rounded text-[10px] font-bold text-sky-800 border border-sky-100">
                                BETA
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                    <MessageSquare size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-700">Enable WhatsApp Webhook</h4>
                                    <p className="text-sm text-slate-500">
                                        Triggers a POST request when an order is completed.
                                    </p>
                                </div>
                            </div>
                            {savingKeys.includes('enable_whatsapp_webhook') ? (
                                <Loader2 size={24} className="text-emerald-600 animate-spin" />
                            ) : (
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={appSettings.enable_whatsapp_webhook || false}
                                        onChange={() => handleToggle('enable_whatsapp_webhook')}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            )}
                        </div>

                        {appSettings.enable_whatsapp_webhook && (
                            <div className="ml-14 animate-fade-in">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Webhook Endpoint URL</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="url"
                                        value={webhookUrl}
                                        onChange={(e) => setWebhookUrl(e.target.value)}
                                        placeholder="https://api.example.com/send-invoice"
                                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-slate-600"
                                    />
                                    <button
                                        onClick={() => handleTextSave('whatsapp_webhook_url', webhookUrl)}
                                        disabled={savingKeys.includes('whatsapp_webhook_url')}
                                        className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-900 transition-colors disabled:opacity-50"
                                    >
                                        {savingKeys.includes('whatsapp_webhook_url') ? <Loader2 size={16} className="animate-spin"/> : 'Save'}
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                                    <Lock size={10} /> Endpoint must accept JSON payloads securely.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        )}

        {/* Section 3: Beta Features */}
        <section>
           <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 pl-1 flex items-center gap-2">
              <FlaskConical size={14} className="text-purple-500"/> Other Experimental Features
           </h3>
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-purple-50">
                 <h3 className="font-bold text-purple-900">Task Management Beta</h3>
                 <p className="text-xs text-purple-700">
                    Staff task assignment and tracking system.
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
                          </h4>
                          <p className="text-sm text-slate-500">
                             Enable the "My Tasks" section on the Dashboard. Allows Admins to assign tasks to staff.
                          </p>
                       </div>
                    </div>
                    {savingKeys.includes('enable_beta_tasks') ? (
                        <Loader2 size={24} className="text-purple-600 animate-spin" />
                    ) : (
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
                    )}
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

      {/* Success Toast */}
      {toastMsg && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 md:bottom-10 z-50">
          <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-fade-in-up">
             <CheckCircle2 size={20} className="text-emerald-400" />
             <span className="font-bold text-sm">{toastMsg}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppSettings;
