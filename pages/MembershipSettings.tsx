
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Award, Plus, Trash2, Save, Gift, Percent, Clock, Repeat, IndianRupee, Utensils } from 'lucide-react';
import { MembershipRewardType, MembershipRule } from '../types';

const MembershipSettings: React.FC = () => {
  const { membershipRules, addMembershipRule, deleteMembershipRule, skus } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  
  // New Rule Form State
  const [triggerCount, setTriggerCount] = useState<number>(5);
  const [rewardType, setRewardType] = useState<MembershipRewardType>('DISCOUNT_PERCENT');
  const [rewardValue, setRewardValue] = useState<string>('20'); // Stores discount % or SKU ID
  const [desc, setDesc] = useState('');
  const [validityDays, setValidityDays] = useState<string>('15');
  const [minOrderValue, setMinOrderValue] = useState<string>('0');
  const [rewardVariant, setRewardVariant] = useState<'FULL' | 'HALF'>('FULL');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc) return;

    await addMembershipRule({
      triggerOrderCount: Number(triggerCount),
      type: rewardType,
      value: rewardType === 'DISCOUNT_PERCENT' ? Number(rewardValue) : rewardValue,
      description: desc,
      timeFrameDays: 30, // Default logic
      validityDays: Number(validityDays),
      minOrderValue: Number(minOrderValue),
      rewardVariant: rewardType === 'FREE_ITEM' ? rewardVariant : 'FULL'
    });
    
    setIsAdding(false);
    // Reset form
    setTriggerCount(5);
    setDesc('');
    setValidityDays('15');
    setMinOrderValue('0');
    setRewardVariant('FULL');
  };

  const getRewardLabel = (rule: MembershipRule) => {
    if (rule.type === 'DISCOUNT_PERCENT') {
       return `${rule.value}% OFF`;
    } else {
       const sku = skus.find(s => s.id === rule.value);
       const variantLabel = rule.rewardVariant === 'HALF' ? '(Half)' : '';
       return `Free: ${sku ? sku.name : 'Unknown Item'} ${variantLabel}`;
    }
  };

  const maxTrigger = membershipRules.length > 0 ? Math.max(...membershipRules.map(r => r.triggerOrderCount)) : 0;

  return (
    <div className="pb-16 max-w-4xl mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-slate-800 flex items-center justify-center gap-3">
          <Award className="text-amber-500" size={32} /> Membership & Loyalty Plan
        </h2>
        <p className="text-slate-500 mt-2">Configure rewards to incentivize repeat customers.</p>
      </div>

      {/* Visual Timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-8">
         <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-6 text-center">Customer Loyalty Journey</h3>
         
         <div className="relative flex items-center justify-between px-4 md:px-12">
            {/* Base Line */}
            <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-0"></div>
            
            {/* Start Point */}
            <div className="relative z-10 flex flex-col items-center">
               <div className="w-8 h-8 rounded-full bg-slate-200 border-4 border-white shadow-sm flex items-center justify-center font-bold text-slate-500 text-xs">0</div>
               <span className="text-xs font-bold text-slate-400 mt-2">Join</span>
            </div>

            {/* Dynamic Points from Rules */}
            {membershipRules.sort((a,b) => a.triggerOrderCount - b.triggerOrderCount).map((rule, idx) => (
               <div key={rule.id} className="relative z-10 flex flex-col items-center">
                   <div className={`w-12 h-12 rounded-full border-4 border-white shadow-md flex items-center justify-center ${rule.type === 'DISCOUNT_PERCENT' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {rule.type === 'DISCOUNT_PERCENT' ? <Percent size={20} /> : <Gift size={20} />}
                   </div>
                   <div className="mt-3 text-center">
                      <span className="block text-xs font-bold text-slate-800">Order #{rule.triggerOrderCount}</span>
                      <span className="block text-[10px] bg-slate-100 px-2 py-0.5 rounded-full mt-1 text-slate-600 border border-slate-200">
                         {getRewardLabel(rule)}
                      </span>
                   </div>
               </div>
            ))}

            {/* End Point (Cycle) */}
            <div className="relative z-10 flex flex-col items-center">
               <div className="w-8 h-8 rounded-full bg-slate-100 border-4 border-white shadow-sm flex items-center justify-center text-slate-400">
                  <Repeat size={14} />
               </div>
               {maxTrigger > 0 && <span className="text-[10px] font-bold text-slate-400 mt-2 w-16 text-center">Resets after #{maxTrigger}</span>}
            </div>
         </div>
         {maxTrigger > 0 && (
            <p className="text-center text-xs text-slate-400 mt-8 bg-slate-50 py-2 rounded-lg border border-slate-100 mx-auto max-w-sm">
               Cycle repeats automatically. Order #{maxTrigger + 5} will trigger the Order #5 reward.
            </p>
         )}
      </div>

      {/* Rules List & Add Form */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
               <h3 className="font-bold text-slate-800">Active Rules</h3>
               <p className="text-xs text-slate-500">Rules are applied automatically when order count is reached.</p>
            </div>
            {!isAdding && (
               <button 
                  onClick={() => setIsAdding(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
               >
                  <Plus size={16} /> Add Rule
               </button>
            )}
         </div>

         {/* Add Form */}
         {isAdding && (
            <div className="p-6 bg-slate-50 border-b border-slate-200 animate-fade-in">
               <form onSubmit={handleAdd} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Trigger (Order #)</label>
                        <input 
                           type="number" 
                           min="1"
                           required
                           value={triggerCount}
                           onChange={e => setTriggerCount(Number(e.target.value))}
                           className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reward Type</label>
                        <select 
                           value={rewardType}
                           onChange={e => setRewardType(e.target.value as MembershipRewardType)}
                           className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                           <option value="DISCOUNT_PERCENT">Percentage Discount</option>
                           <option value="FREE_ITEM">Free Item</option>
                        </select>
                     </div>
                     
                     {/* Value Field (Dynamic) */}
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                           {rewardType === 'DISCOUNT_PERCENT' ? 'Discount %' : 'Select Free Item'}
                        </label>
                        {rewardType === 'DISCOUNT_PERCENT' ? (
                           <div className="relative">
                              <input 
                                 type="number" 
                                 min="1" 
                                 max="100"
                                 required
                                 value={rewardValue}
                                 onChange={e => setRewardValue(e.target.value)}
                                 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                              />
                              <Percent size={14} className="absolute right-3 top-2.5 text-slate-400" />
                           </div>
                        ) : (
                           <select 
                              value={rewardValue}
                              onChange={e => setRewardValue(e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                           >
                              {skus.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                           </select>
                        )}
                     </div>

                     {/* Variant Selector (Only for FREE_ITEM) */}
                     {rewardType === 'FREE_ITEM' ? (
                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                              Variant <Utensils size={12} />
                           </label>
                           <select
                              value={rewardVariant}
                              onChange={e => setRewardVariant(e.target.value as 'FULL' | 'HALF')}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                           >
                              <option value="FULL">Full Plate</option>
                              <option value="HALF">Half Plate</option>
                           </select>
                        </div>
                     ) : (
                        // Placeholder for alignment
                        <div className="hidden md:block"></div>
                     )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                           Expiry (Days) <Clock size={12} />
                        </label>
                        <input 
                           type="number" 
                           min="0"
                           required
                           value={validityDays}
                           onChange={e => setValidityDays(e.target.value)}
                           className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                           placeholder="e.g. 15"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">0 = No Expiry</p>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                           Min Order Value <IndianRupee size={12} />
                        </label>
                        <input 
                           type="number" 
                           min="0"
                           required
                           value={minOrderValue}
                           onChange={e => setMinOrderValue(e.target.value)}
                           className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                           placeholder="e.g. 200"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">0 = No Minimum</p>
                     </div>
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                     <input 
                        type="text" 
                        required
                        placeholder="e.g. 20% Off on your 5th order"
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                     />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                     <button 
                        type="button" 
                        onClick={() => setIsAdding(false)}
                        className="text-slate-500 hover:text-slate-700 font-medium text-sm"
                     >
                        Cancel
                     </button>
                     <button 
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                     >
                        <Save size={16} /> Save Rule
                     </button>
                  </div>
               </form>
            </div>
         )}

         {/* List */}
         <div className="divide-y divide-slate-100">
            {membershipRules.map(rule => (
               <div key={rule.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${rule.type === 'DISCOUNT_PERCENT' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        <span className="font-bold text-sm">#{rule.triggerOrderCount}</span>
                     </div>
                     <div>
                        <h4 className="font-bold text-slate-800">{rule.description}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                           <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {rule.type === 'DISCOUNT_PERCENT' ? 'Discount' : 'Freebie'}
                           </span>
                           <span className="text-xs text-slate-400">Value: {getRewardLabel(rule)}</span>
                           
                           {rule.minOrderValue !== undefined && rule.minOrderValue > 0 && (
                              <span className="text-[10px] text-blue-600 font-medium flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                 <IndianRupee size={10} /> Min: {rule.minOrderValue}
                              </span>
                           )}

                           {rule.validityDays && rule.validityDays > 0 && (
                              <span className="text-[10px] text-orange-600 font-medium flex items-center gap-1 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                                 <Clock size={10} /> Valid {rule.validityDays} Days
                              </span>
                           )}
                        </div>
                     </div>
                  </div>
                  <button 
                     onClick={() => { if(confirm('Delete rule?')) deleteMembershipRule(rule.id) }}
                     className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                     <Trash2 size={18} />
                  </button>
               </div>
            ))}
            {membershipRules.length === 0 && (
               <div className="p-8 text-center text-slate-400 italic">No membership rules configured.</div>
            )}
         </div>
      </div>
    </div>
  );
};

export default MembershipSettings;
