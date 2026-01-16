import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { Loader2, Bug, Save, Settings } from 'lucide-react';

const AppSettingsPage: React.FC = () => {
  const { appSettings, updateAppSetting } = useStore();
  const { currentUser } = useAuth();
  const [savingKeys, setSavingKeys] = useState<string[]>([]);

  // Local state for text inputs before save
  const [webhookUrl, setWebhookUrl] = useState(appSettings.whatsapp_webhook_url || '');

  const handleToggle = async (key: string) => {
     setSavingKeys(prev => [...prev, key]);
     await updateAppSetting(key, !appSettings[key]);
     setSavingKeys(prev => prev.filter(k => k !== key));
  };

  const handleSaveText = async (key: string, value: string) => {
     setSavingKeys(prev => [...prev, key]);
     await updateAppSetting(key, value);
     setSavingKeys(prev => prev.filter(k => k !== key));
  };

  return (
    <div className="max-w-4xl mx-auto pb-16">
        <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
               <Settings className="text-slate-600" /> App Configuration
            </h2>
            <p className="text-slate-500">Manage global application behavior and features.</p>
        </div>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
           <div className="p-6 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800">Feature Flags</h3>
           </div>
           
           <div className="divide-y divide-slate-100">
                 {/* Setting: Beta Tasks */}
                 <div className="p-6 flex items-center justify-between">
                    <div>
                       <h4 className="font-bold text-slate-700">Enable Beta Task Management</h4>
                       <p className="text-sm text-slate-500">Shows the 'Tasks' module in the navigation sidebar.</p>
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

                 {/* Setting: Debug Logging */}
                 <div className="p-6 flex items-center justify-between">
                    <div className="flex gap-4">
                       <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                          <Bug size={20} />
                       </div>
                       <div>
                          <h4 className="font-bold text-slate-700 flex items-center gap-2">
                             Enable Debug Logging
                          </h4>
                          <p className="text-sm text-slate-500">
                             Shows detailed alerts containing raw server responses after submitting transactions. Use for diagnosis.
                          </p>
                       </div>
                    </div>
                    {savingKeys.includes('enable_debug_logging') ? (
                        <Loader2 size={24} className="text-red-600 animate-spin" />
                    ) : (
                        <label className={`relative inline-flex items-center cursor-pointer ${currentUser?.role !== 'ADMIN' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                           <input 
                              type="checkbox" 
                              className="sr-only peer"
                              checked={appSettings.enable_debug_logging || false}
                              onChange={() => handleToggle('enable_debug_logging')}
                              disabled={currentUser?.role !== 'ADMIN'}
                           />
                           <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                        </label>
                    )}
                 </div>
                 
                 {/* Setting: Require Customer Phone */}
                 <div className="p-6 flex items-center justify-between">
                    <div>
                       <h4 className="font-bold text-slate-700">Require Customer Phone</h4>
                       <p className="text-sm text-slate-500">Force staff to link a customer before completing an order.</p>
                    </div>
                    {savingKeys.includes('require_customer_phone') ? (
                        <Loader2 size={24} className="text-indigo-600 animate-spin" />
                    ) : (
                        <label className={`relative inline-flex items-center cursor-pointer ${currentUser?.role !== 'ADMIN' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                           <input 
                              type="checkbox" 
                              className="sr-only peer"
                              checked={appSettings.require_customer_phone || false}
                              onChange={() => handleToggle('require_customer_phone')}
                              disabled={currentUser?.role !== 'ADMIN'}
                           />
                           <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    )}
                 </div>
           </div>
        </section>

        {/* Webhook Configuration */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="p-6 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800">WhatsApp Webhook Integration</h3>
           </div>
           <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                  <div>
                      <h4 className="font-bold text-slate-700">Enable Webhook</h4>
                      <p className="text-sm text-slate-500">Send order data to external URL upon completion.</p>
                  </div>
                  {savingKeys.includes('enable_whatsapp_webhook') ? (
                      <Loader2 size={24} className="text-emerald-600 animate-spin" />
                  ) : (
                      <label className={`relative inline-flex items-center cursor-pointer ${currentUser?.role !== 'ADMIN' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={appSettings.enable_whatsapp_webhook || false}
                            onChange={() => handleToggle('enable_whatsapp_webhook')}
                            disabled={currentUser?.role !== 'ADMIN'}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                  )}
              </div>

              {appSettings.enable_whatsapp_webhook && (
                  <div className="animate-fade-in mt-4">
                      <label className="block text-sm font-bold text-slate-700 mb-1">Webhook URL</label>
                      <div className="flex gap-2">
                          <input 
                            type="url" 
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            placeholder="https://api.example.com/webhook"
                            disabled={currentUser?.role !== 'ADMIN'}
                          />
                          <button 
                            onClick={() => handleSaveText('whatsapp_webhook_url', webhookUrl)}
                            disabled={currentUser?.role !== 'ADMIN' || savingKeys.includes('whatsapp_webhook_url')}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                          >
                             {savingKeys.includes('whatsapp_webhook_url') ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                             Save
                          </button>
                      </div>
                      
                      <div className="mt-4 flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            checked={appSettings.debug_whatsapp_webhook || false}
                            onChange={() => handleToggle('debug_whatsapp_webhook')}
                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                            id="debugHook"
                            disabled={currentUser?.role !== 'ADMIN'}
                          />
                          <label htmlFor="debugHook" className="text-sm text-slate-700 font-medium cursor-pointer">Debug Mode (Show payload JSON before sending)</label>
                      </div>
                  </div>
              )}
           </div>
        </section>
    </div>
  );
};

export default AppSettingsPage;
