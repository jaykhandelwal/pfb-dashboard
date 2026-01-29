import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { Sliders, Phone, User, Info, FlaskConical, CheckSquare, Loader2, CheckCircle2, MessageSquare, Globe, Lock, Bug, BookOpen, Server, Key, Tag, Zap, Eye, EyeOff } from 'lucide-react';
import { triggerCoolifyDeployment } from '../services/coolifyService';

const AppSettings: React.FC = () => {
   const { appSettings, updateAppSetting, isLoading } = useStore();
   const { currentUser } = useAuth();

   // Local state to manage loading status per toggle to avoid race conditions
   const [savingKeys, setSavingKeys] = useState<string[]>([]);
   // Local state for toast
   const [toastMsg, setToastMsg] = useState('');
   // Local state for input fields (to debounce or handle blur save)
   const [webhookUrl, setWebhookUrl] = useState(appSettings.whatsapp_webhook_url || '');
   const [coolifyUrl, setCoolifyUrl] = useState(appSettings.coolify_instance_url || '');
   const [coolifyToken, setCoolifyToken] = useState(appSettings.coolify_api_token || '');
   const [coolifyTag, setCoolifyTag] = useState(appSettings.coolify_deployment_tag_or_uuid || '');
   const [showToken, setShowToken] = useState(false);
   const [isDeploying, setIsDeploying] = useState(false);

   const handleToggle = async (key: string) => {
      // Prevent double clicks
      if (savingKeys.includes(key)) return;

      // Permission Check specifically for BETA features
      if ((key === 'enable_beta_tasks' || key === 'enable_beta_ledger' || key === 'enable_whatsapp_webhook' || key === 'debug_whatsapp_webhook') && currentUser?.role !== 'ADMIN') {
         alert("Beta/Admin features can only be managed by an Admin.");
         return;
      }

      // Add to saving list
      setSavingKeys(prev => [...prev, key]);

      const currentValue = appSettings[key];
      let newValue: any = !currentValue;

      // Special handling for the target type toggle
      if (key === 'coolify_target_type') {
         newValue = currentValue === 'tag' ? 'uuid' : 'tag';
      }

      await updateAppSetting(key, newValue);

      // Remove from saving list
      setSavingKeys(prev => prev.filter(k => k !== key));

      // Show success toast
      setToastMsg('Setting saved successfully!');
      setTimeout(() => setToastMsg(''), 3000);
   };

   const handleTextSave = async (key: string, value: string) => {
      if (appSettings[key] === value) return; // No change

      setSavingKeys(prev => [...prev, key]);
      await updateAppSetting(key, value);
      setSavingKeys(prev => prev.filter(k => k !== key));

      // Show success toast
      setToastMsg('Setting saved successfully!');
      setTimeout(() => setToastMsg(''), 3000);
   };

   const handleDeploy = async () => {
      if (!coolifyUrl || !coolifyToken || !coolifyTag) {
         setToastMsg('Please fill all Coolify settings first.');
         setTimeout(() => setToastMsg(''), 3000);
         return;
      }

      setIsDeploying(true);
      try {
         await triggerCoolifyDeployment(
            coolifyUrl,
            coolifyToken,
            coolifyTag,
            appSettings.coolify_force_build || false
         );
         setToastMsg('Deployment triggered successfully!');
      } catch (error: any) {
         console.error('Deployment failed:', error);
         alert(`Deployment failed: ${error.message}`);
      } finally {
         setIsDeploying(false);
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
                     <Globe size={14} className="text-sky-500" /> Integrations & Webhooks
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
                           <div className="ml-14 animate-fade-in space-y-4">
                              <div>
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
                                       {savingKeys.includes('whatsapp_webhook_url') ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
                                    </button>
                                 </div>
                                 <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                                    <Lock size={10} /> Endpoint must accept JSON payloads securely.
                                 </p>
                              </div>

                              {/* Debug Toggle */}
                              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                                 <div className="flex gap-3 items-center">
                                    <div className="p-1.5 bg-amber-100 text-amber-600 rounded">
                                       <Bug size={16} />
                                    </div>
                                    <div>
                                       <h5 className="font-bold text-slate-700 text-sm">Debug Mode</h5>
                                       <p className="text-xs text-slate-500">Show payload popup before sending.</p>
                                    </div>
                                 </div>
                                 {savingKeys.includes('debug_whatsapp_webhook') ? (
                                    <Loader2 size={20} className="text-amber-500 animate-spin" />
                                 ) : (
                                    <label className="relative inline-flex items-center cursor-pointer">
                                       <input
                                          type="checkbox"
                                          className="sr-only peer"
                                          checked={appSettings.debug_whatsapp_webhook || false}
                                          onChange={() => handleToggle('debug_whatsapp_webhook')}
                                       />
                                       <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                                    </label>
                                 )}
                              </div>
                           </div>
                        )}
                     </div>
                  </div>
               </section>
            )}

            {/* Section 2.5: Server & Deployment (Coolify) */}
            {currentUser?.role === 'ADMIN' && (
               <section>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 pl-1 flex items-center gap-2">
                     <Server size={14} className="text-indigo-500" /> Server & Deployment
                  </h3>
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                     <div className="p-6 border-b border-slate-100 bg-indigo-50">
                        <div className="flex justify-between items-center">
                           <div>
                              <h3 className="font-bold text-indigo-900">Coolify API Integration</h3>
                              <p className="text-xs text-indigo-700">
                                 Trigger deployments directly from this dashboard.
                              </p>
                           </div>
                           <div className="bg-white/50 px-2 py-1 rounded text-[10px] font-bold text-indigo-800 border border-indigo-100">
                              ADMIN ONLY
                           </div>
                        </div>
                     </div>

                     <div className="p-6 space-y-6">
                        {/* Instance URL */}
                        <div className="space-y-2">
                           <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                              <Globe size={12} /> Coolify Instance URL
                           </label>
                           <div className="flex gap-2">
                              <input
                                 type="url"
                                 value={coolifyUrl}
                                 onChange={(e) => setCoolifyUrl(e.target.value)}
                                 placeholder="https://coolify.example.com"
                                 className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-slate-600"
                              />
                              <button
                                 onClick={() => handleTextSave('coolify_instance_url', coolifyUrl)}
                                 disabled={savingKeys.includes('coolify_instance_url')}
                                 className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-900 transition-colors disabled:opacity-50 min-w-[70px]"
                              >
                                 {savingKeys.includes('coolify_instance_url') ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Save'}
                              </button>
                           </div>
                        </div>

                        {/* API Token */}
                        <div className="space-y-2">
                           <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                              <Key size={12} /> API Token
                           </label>
                           <div className="flex gap-2">
                              <div className="relative flex-1">
                                 <input
                                    type={showToken ? "text" : "password"}
                                    value={coolifyToken}
                                    onChange={(e) => setCoolifyToken(e.target.value)}
                                    placeholder="your-coolify-api-token"
                                    className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-slate-600"
                                 />
                                 <button
                                    type="button"
                                    onClick={() => setShowToken(!showToken)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                 >
                                    {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                                 </button>
                              </div>
                              <button
                                 onClick={() => handleTextSave('coolify_api_token', coolifyToken)}
                                 disabled={savingKeys.includes('coolify_api_token')}
                                 className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-900 transition-colors disabled:opacity-50 min-w-[70px]"
                              >
                                 {savingKeys.includes('coolify_api_token') ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Save'}
                              </button>
                           </div>
                        </div>

                        {/* Application UUID */}
                        <div className="space-y-2">
                           <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                              <Tag size={12} /> Application UUID
                           </label>
                           <p className="text-xs text-slate-400 -mt-1">Find this in your Coolify application's URL.</p>
                           <div className="flex gap-2">
                              <input
                                 type="text"
                                 value={coolifyTag}
                                 onChange={(e) => setCoolifyTag(e.target.value)}
                                 placeholder="e.g. cs0sgkksk0ccockw8kskwco4"
                                 className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-slate-600"
                              />
                              <button
                                 onClick={() => handleTextSave('coolify_deployment_tag_or_uuid', coolifyTag)}
                                 disabled={savingKeys.includes('coolify_deployment_tag_or_uuid')}
                                 className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-900 transition-colors disabled:opacity-50 min-w-[70px]"
                              >
                                 {savingKeys.includes('coolify_deployment_tag_or_uuid') ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Save'}
                              </button>
                           </div>
                        </div>

                        {/* Force Build Toggle */}
                        <div className="flex items-center justify-between border-t border-slate-100 pt-6">
                           <div className="flex gap-3 items-center">
                              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                                 <Zap size={20} />
                              </div>
                              <div>
                                 <h4 className="font-bold text-slate-700">Force Rebuild</h4>
                                 <p className="text-xs text-slate-500">Ignore cache and rebuild all layers.</p>
                              </div>
                           </div>
                           {savingKeys.includes('coolify_force_build') ? (
                              <Loader2 size={24} className="text-indigo-600 animate-spin" />
                           ) : (
                              <label className="relative inline-flex items-center cursor-pointer">
                                 <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={appSettings.coolify_force_build || false}
                                    onChange={() => handleToggle('coolify_force_build')}
                                 />
                                 <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                              </label>
                           )}
                        </div>

                        {/* Deploy Button */}
                        <div className="pt-2">
                           <button
                              onClick={handleDeploy}
                              disabled={isDeploying || !coolifyUrl || !coolifyToken || !coolifyTag}
                              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 disabled:grayscale"
                           >
                              {isDeploying ? (
                                 <>
                                    <Loader2 size={20} className="animate-spin" />
                                    Triggering Deployment...
                                 </>
                              ) : (
                                 <>
                                    <Zap size={20} />
                                    Deploy Application Now
                                 </>
                              )}
                           </button>
                           <p className="text-[10px] text-slate-400 mt-3 text-center">
                              Using Coolify API v1. Deployment progress can be tracked in your Coolify dashboard.
                           </p>
                        </div>
                     </div>
                  </div>
               </section>
            )}

            {/* Section 3: Beta Features */}
            <section>
               <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 pl-1 flex items-center gap-2">
                  <FlaskConical size={14} className="text-purple-500" /> Other Experimental Features
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

                     {/* Setting: Ledger */}
                     <div className="p-6 flex items-center justify-between">
                        <div className="flex gap-4">
                           <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                              <BookOpen size={20} />
                           </div>
                           <div>
                              <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                 Ledger
                              </h4>
                              <p className="text-sm text-slate-500">
                                 Track income, expenses, and reimbursements across branches.
                              </p>
                           </div>
                        </div>
                        {savingKeys.includes('enable_beta_ledger') ? (
                           <Loader2 size={24} className="text-amber-600 animate-spin" />
                        ) : (
                           <label className={`relative inline-flex items-center cursor-pointer ${currentUser?.role !== 'ADMIN' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              <input
                                 type="checkbox"
                                 className="sr-only peer"
                                 checked={appSettings.enable_beta_ledger || false}
                                 onChange={() => handleToggle('enable_beta_ledger')}
                                 disabled={currentUser?.role !== 'ADMIN'}
                              />
                              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                           </label>
                        )}
                     </div>
                  </div>
               </div>
            </section>

            {/* Section 4: Debug & Troubleshooting (Admin Only) */}
            {currentUser?.role === 'ADMIN' && (
               <section>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 pl-1 flex items-center gap-2">
                     <Bug size={14} className="text-red-500" /> Debug & Troubleshooting
                  </h3>
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                     <div className="p-6 border-b border-slate-100 bg-red-50">
                        <h3 className="font-bold text-red-900">Advanced Debugging</h3>
                        <p className="text-xs text-red-700">Tools for auditing system calculations and logs.</p>
                     </div>

                     <div className="divide-y divide-slate-100">
                        {/* Setting 1: Inventory Debug */}
                        <div className="p-6 flex items-center justify-between">
                           <div className="flex gap-4">
                              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                                 <Bug size={20} />
                              </div>
                              <div>
                                 <h4 className="font-bold text-slate-700">Inventory Debug Mode</h4>
                                 <p className="text-sm text-slate-500">
                                    Show detailed stock calculation breakdowns in the Deep Freezer Inventory page.
                                 </p>
                              </div>
                           </div>
                           {savingKeys.includes('enable_debug_inventory') ? (
                              <Loader2 size={24} className="text-red-600 animate-spin" />
                           ) : (
                              <label className="relative inline-flex items-center cursor-pointer">
                                 <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={appSettings.enable_debug_inventory || false}
                                    onChange={() => handleToggle('enable_debug_inventory')}
                                 />
                                 <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                              </label>
                           )}
                        </div>
                     </div>
                  </div>
               </section>
            )}

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
