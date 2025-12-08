
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { SalesPlatform, OrderItem, MenuItem } from '../types';
import { Receipt, Filter, Calendar, Store, Clock, UtensilsCrossed, PlusCircle, MinusCircle, Plus, Search, CheckCircle2, ShoppingCart, IndianRupee, X, Box, PlusSquare, Trash2, CreditCard, ChevronRight, ArrowLeft, ChevronUp } from 'lucide-react';
import { getLocalISOString } from '../constants';

const Orders: React.FC = () => {
  const { orders, skus, menuItems, branches, customers, addOrder, menuCategories } = useStore();
  const [activeTab, setActiveTab] = useState<'HISTORY' | 'NEW_ORDER'>('HISTORY');
  
  // -- HISTORY STATE --
  const [date, setDate] = useState<string>(getLocalISOString());
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');

  // -- NEW ORDER STATE --
  const [posBranchId, setPosBranchId] = useState<string>(branches[0]?.id || '');
  const [posPlatform, setPosPlatform] = useState<SalesPlatform>('POS');
  const [posPaymentMethod, setPosPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [linkedCustomer, setLinkedCustomer] = useState<{name: string, phone: string} | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // -- MOBILE UI STATE --
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // -- CUSTOM AMOUNT STATE (ORDER LEVEL) --
  const [isCustomAmountOpen, setIsCustomAmountOpen] = useState(false);
  const [orderCustomAmount, setOrderCustomAmount] = useState<{ amount: number, reason: string } | null>(null);
  
  // Temp state for modal
  const [customAmountVal, setCustomAmountVal] = useState('');
  const [customAmountReason, setCustomAmountReason] = useState('');

  // -- CUSTOM SKU STATE (ORDER LEVEL) --
  const [isCustomSkuOpen, setIsCustomSkuOpen] = useState(false);
  // Replaced singular object with structure holding array
  const [orderCustomSku, setOrderCustomSku] = useState<{ items: { skuId: string, qty: number }[], reason: string } | null>(null);
  
  // Temp state for modal builder
  const [customSkuList, setCustomSkuList] = useState<{skuId: string, qty: number}[]>([]);
  const [tempSkuId, setTempSkuId] = useState('');
  const [tempSkuQty, setTempSkuQty] = useState('');
  const [customSkuReason, setCustomSkuReason] = useState('');

  // -- HELPERS --
  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name || id;
  const getSkuName = (id: string) => skus.find(s => s.id === id)?.name || id;
  
  const getCategoryColor = (catName: string) => {
     if (catName === 'All') return '#475569'; // Slate-600 default
     const cat = menuCategories.find(c => c.name === catName);
     return cat?.color || '#94a3b8'; // Slate-400 fallback
  };

  // Derive unique categories for filter
  const uniqueCategories = useMemo(() => {
     const cats = new Set(menuItems.map(m => m.category || 'Uncategorized'));
     return ['All', ...Array.from(cats).sort()];
  }, [menuItems]);

  // -- HISTORY LOGIC --
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.date !== date) return false;
      if (selectedBranch !== 'ALL' && o.branchId !== selectedBranch) return false;
      if (selectedPlatform !== 'ALL' && o.platform !== selectedPlatform) return false;
      return true;
    });
  }, [orders, date, selectedBranch, selectedPlatform]);

  const getPlatformStyle = (platform: SalesPlatform) => {
    switch (platform) {
      case 'POS': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ZOMATO': return 'bg-red-100 text-red-800 border-red-200';
      case 'SWIGGY': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  // -- POS LOGIC --
  const addToCart = (item: MenuItem, variant: 'FULL' | 'HALF' = 'FULL') => {
     const priceToUse = variant === 'HALF' && item.halfPrice ? item.halfPrice : item.price;
     // Create a unique cart ID key based on item + variant
     const cartItemKey = `${item.id}-${variant}`;

     setCart(prev => {
        const existing = prev.find(i => `${i.menuItemId}-${i.variant || 'FULL'}` === cartItemKey);
        if(existing) {
           return prev.map(i => `${i.menuItemId}-${i.variant || 'FULL'}` === cartItemKey ? { ...i, quantity: i.quantity + 1 } : i);
        } else {
           return [...prev, {
              id: `temp-${Date.now()}`, // Temporary ID
              menuItemId: item.id,
              name: item.name,
              price: priceToUse,
              quantity: 1,
              variant: variant
           } as OrderItem];
        }
     });
  };

  const applyCustomAmount = () => {
    if (!customAmountVal || parseFloat(customAmountVal) <= 0) return;
    
    setOrderCustomAmount({
      amount: parseFloat(customAmountVal),
      reason: customAmountReason || 'Miscellaneous'
    });

    setIsCustomAmountOpen(false);
    setCustomAmountVal('');
    setCustomAmountReason('');
  };

  // Helper: Open custom SKU modal and prepopulate if exists
  const openCustomSkuModal = () => {
      if (orderCustomSku) {
          setCustomSkuList(orderCustomSku.items);
          setCustomSkuReason(orderCustomSku.reason);
      } else {
          setCustomSkuList([]);
          setCustomSkuReason('');
      }
      setTempSkuId('');
      setTempSkuQty('');
      setIsCustomSkuOpen(true);
  };

  const handleAddCustomItemToBuffer = () => {
      if (!tempSkuId || !tempSkuQty) return;
      const qty = parseInt(tempSkuQty);
      if (qty <= 0) return;

      setCustomSkuList(prev => [...prev, { skuId: tempSkuId, qty }]);
      setTempSkuId('');
      setTempSkuQty('');
  };

  const handleRemoveCustomItemFromBuffer = (index: number) => {
      setCustomSkuList(prev => prev.filter((_, i) => i !== index));
  };

  const applyCustomSku = () => {
    if (customSkuList.length === 0 || !customSkuReason) return;

    setOrderCustomSku({
      items: customSkuList,
      reason: customSkuReason
    });

    setIsCustomSkuOpen(false);
  };

  const updateCartQty = (itemId: string, delta: number) => {
     setCart(prev => {
        return prev.map(i => {
           if(i.id === itemId) {
              const newQty = Math.max(0, i.quantity + delta);
              return { ...i, quantity: newQty };
           }
           return i;
        }).filter(i => i.quantity > 0);
     });
  };

  const removeItem = (itemId: string) => {
    setCart(prev => prev.filter(i => i.id !== itemId));
  };

  const cartTotal = useMemo(() => {
     const itemsTotal = cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
     const customAmt = orderCustomAmount ? orderCustomAmount.amount : 0;
     return itemsTotal + customAmt;
  }, [cart, orderCustomAmount]);

  const handleLinkCustomer = (phone: string, name?: string) => {
     setLinkedCustomer({ name: name || 'Unknown', phone });
     setIsCustomerModalOpen(false);
     setCustomerSearch('');
  };

  const submitOrder = async () => {
     if(cart.length === 0 && !orderCustomAmount) return; // Allow custom amount only order? Usually need items, but technically possible.
     if(!posBranchId) {
        alert("Please select a branch.");
        return;
     }

     const orderDate = getLocalISOString(); // Today's date for POS

     // Map internal structure to expected API/Context structure
     const finalCustomSkuItems = orderCustomSku?.items.map(i => ({ skuId: i.skuId, quantity: i.qty })) || [];

     await addOrder({
        branchId: posBranchId,
        date: orderDate,
        platform: posPlatform,
        totalAmount: cartTotal,
        status: 'COMPLETED',
        paymentMethod: posPaymentMethod, 
        items: cart,
        customerId: linkedCustomer?.phone,
        customerName: linkedCustomer?.name,
        // Pass Custom Fields
        customAmount: orderCustomAmount?.amount,
        customAmountReason: orderCustomAmount?.reason,
        customSkuItems: finalCustomSkuItems,
        customSkuReason: orderCustomSku?.reason
     });

     // Reset
     setCart([]);
     setOrderCustomAmount(null);
     setOrderCustomSku(null);
     setLinkedCustomer(null);
     setPosPaymentMethod('CASH');
     setIsMobileCartOpen(false); // Close mobile cart
     setShowSuccess(true);
     setTimeout(() => setShowSuccess(false), 2000);
  };

  // Filter menu items for POS
  const visibleMenuItems = useMemo(() => {
     if (selectedCategory === 'All') return menuItems;
     return menuItems.filter(m => (m.category || 'Uncategorized') === selectedCategory);
  }, [menuItems, selectedCategory]);

  return (
    <div className="pb-16 h-[calc(100vh-80px)] flex flex-col relative">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Receipt className="text-emerald-600" /> Orders & Sales
          </h2>
          <p className="text-slate-500 text-sm">Manage sales history and new orders.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg">
           <button
             onClick={() => setActiveTab('HISTORY')}
             className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'HISTORY' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
           >
             History
           </button>
           <button
             onClick={() => setActiveTab('NEW_ORDER')}
             className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'NEW_ORDER' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'}`}
           >
             <PlusCircle size={16} /> New Order
           </button>
        </div>
      </div>

      {activeTab === 'HISTORY' ? (
        <div className="flex-1 overflow-y-auto">
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4">
            {/* Date */}
            <div className="flex-1">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  <Calendar size={12} /> Date
                </label>
                <input 
                  type="date" 
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 font-medium"
                />
            </div>

            {/* Branch */}
            <div className="flex-1">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  <Store size={12} /> Branch
                </label>
                <select 
                  value={selectedBranch}
                  onChange={e => setSelectedBranch(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 bg-white"
                >
                  <option value="ALL">All Branches</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
            </div>

            {/* Platform */}
            <div className="flex-1">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  <Filter size={12} /> Platform
                </label>
                <select 
                  value={selectedPlatform}
                  onChange={e => setSelectedPlatform(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 bg-white"
                >
                  <option value="ALL">All Platforms</option>
                  <option value="POS">POS (In-Store)</option>
                  <option value="ZOMATO">Zomato</option>
                  <option value="SWIGGY">Swiggy</option>
                </select>
            </div>
          </div>

          {/* Order List */}
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
                <Receipt size={48} className="mx-auto mb-3 opacity-20" />
                <p className="font-medium">No orders found for this criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOrders.map(order => (
                  <div key={order.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                      {/* Ticket Header */}
                      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getPlatformStyle(order.platform)}`}>
                                  {order.platform}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">
                                  #{order.timestamp.toString().slice(-6)}
                              </span>
                            </div>
                            <div className="font-bold text-slate-700 text-sm">
                              {getBranchName(order.branchId)}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                               Paid via {order.paymentMethod}
                            </div>
                            {order.customerName && (
                                <div className="text-xs text-emerald-600 font-medium mt-1">
                                    Cust: {order.customerName}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                            <Clock size={12} />
                            {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* Items */}
                      <div className="p-4 flex-1">
                        <ul className="space-y-3 text-sm">
                            {order.items.map((item, idx) => (
                              <li key={idx} className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <span className="text-slate-700 font-medium block">
                                      {item.name}
                                      {item.variant === 'HALF' && <span className="text-xs text-slate-400 ml-1">(Half)</span>}
                                    </span>
                                    <div className="text-xs text-slate-400 mt-0.5">
                                       ₹{item.price} ea
                                    </div>
                                  </div>
                                  <div className="text-right">
                                     <span className="font-mono text-slate-600 block">x {item.quantity}</span>
                                     <span className="font-bold text-slate-700">₹{item.price * item.quantity}</span>
                                  </div>
                              </li>
                            ))}
                        </ul>

                        {/* Order Level Custom Fields */}
                        {(order.customAmount || (order.customSkuItems && order.customSkuItems.length > 0)) && (
                            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                                {order.customAmount && (
                                    <div className="flex justify-between items-start text-xs">
                                        <div>
                                            <span className="font-bold text-indigo-600 block">Custom Charge</span>
                                            <span className="text-slate-400 italic">{order.customAmountReason}</span>
                                        </div>
                                        <span className="font-bold text-slate-700">₹{order.customAmount}</span>
                                    </div>
                                )}
                                {order.customSkuItems && order.customSkuItems.length > 0 && (
                                    <div className="text-xs bg-slate-50 p-2 rounded border border-slate-200">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-slate-600">Inventory Usage</span>
                                            <span className="text-slate-400 italic text-[10px]">{order.customSkuReason}</span>
                                        </div>
                                        <ul className="space-y-1">
                                            {order.customSkuItems.map((item, idx) => (
                                                <li key={idx} className="flex justify-between text-slate-500">
                                                    <span>{getSkuName(item.skuId)}</span>
                                                    <span className="font-mono">{item.quantity} pcs</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                      </div>

                      {/* Footer Total */}
                      <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium flex items-center gap-1">
                            <UtensilsCrossed size={14} /> Total Items: {order.items.reduce((a,b)=>a+b.quantity,0)}
                        </span>
                        <span className="font-bold text-slate-800 text-lg flex items-center gap-0.5">
                            <IndianRupee size={14} /> {order.totalAmount}
                        </span>
                      </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        // --- NEW ORDER (POS) INTERFACE ---
        <div className="flex flex-col md:flex-row gap-4 h-full relative">
           
           {/* Left: Menu & Controls (Full width on mobile) */}
           <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full h-full relative">
               {/* Controls Header */}
               <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div className="sm:col-span-1">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Branch</label>
                        <select 
                        value={posBranchId}
                        onChange={e => setPosBranchId(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-medium bg-white"
                        >
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div className="sm:col-span-1">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Source</label>
                        <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
                            <button 
                            onClick={() => setPosPlatform('POS')}
                            className={`flex-1 py-1 text-xs font-bold rounded ${posPlatform === 'POS' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}
                            >
                            POS
                            </button>
                            <button 
                            onClick={() => setPosPlatform('ZOMATO')}
                            className={`flex-1 py-1 text-xs font-bold rounded ${posPlatform === 'ZOMATO' ? 'bg-red-100 text-red-700' : 'text-slate-500'}`}
                            >
                            Zom
                            </button>
                            <button 
                            onClick={() => setPosPlatform('SWIGGY')}
                            className={`flex-1 py-1 text-xs font-bold rounded ${posPlatform === 'SWIGGY' ? 'bg-orange-100 text-orange-700' : 'text-slate-500'}`}
                            >
                            Swig
                            </button>
                        </div>
                    </div>
                    <div className="sm:col-span-1">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Payment</label>
                        <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
                           {(['CASH', 'UPI', 'CARD'] as const).map(pm => (
                               <button
                                 key={pm}
                                 onClick={() => setPosPaymentMethod(pm)}
                                  className={`flex-1 py-1 text-xs font-bold rounded ${posPaymentMethod === pm ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500'}`}
                               >
                                 {pm}
                               </button>
                           ))}
                        </div>
                    </div>
                  </div>

                  {/* Category Filter */}
                  <div className="mb-4">
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Menu Category</label>
                     <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {uniqueCategories.map(cat => {
                           const color = getCategoryColor(cat);
                           const isSelected = selectedCategory === cat;
                           
                           return (
                           <button
                             key={cat}
                             onClick={() => setSelectedCategory(cat)}
                             style={{ 
                                backgroundColor: isSelected ? color : 'white',
                                borderColor: isSelected ? color : '#e2e8f0',
                                color: isSelected ? 'white' : '#64748b'
                             }}
                             className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border shadow-sm`}
                           >
                              {cat}
                           </button>
                           )
                        })}
                     </div>
                  </div>

                  {/* Custom Action Buttons */}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsCustomAmountOpen(true)}
                      className={`flex-1 py-2 rounded-lg border border-dashed flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
                          orderCustomAmount 
                            ? 'border-indigo-300 bg-indigo-100 text-indigo-700' 
                            : 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      <IndianRupee size={14} /> {orderCustomAmount ? 'Edit Custom Amount' : 'Add Custom Amount'}
                    </button>
                    <button 
                      onClick={openCustomSkuModal}
                      className={`flex-1 py-2 rounded-lg border border-dashed flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
                          orderCustomSku
                            ? 'border-slate-400 bg-slate-200 text-slate-700' 
                            : 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Box size={14} /> {orderCustomSku ? 'Edit Raw Item(s)' : 'Add Raw Item(s)'}
                    </button>
                  </div>
               </div>

               {/* Menu Grid */}
               <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 pb-32 md:pb-4">
                  {visibleMenuItems.length === 0 ? (
                     <div className="text-center text-slate-400 py-10 italic">No items found in this category.</div>
                  ) : (
                     <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {visibleMenuItems.map(item => (
                           <div 
                              key={item.id}
                              className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col h-auto group"
                           >
                              <div className="p-3 flex-1">
                                 <span className="font-bold text-slate-700 line-clamp-2 text-sm leading-tight group-hover:text-emerald-700 transition-colors">
                                    {item.name}
                                 </span>
                              </div>
                              
                              <div className="p-2 bg-slate-50 border-t border-slate-100 flex gap-2">
                                 {/* Full Plate Button */}
                                 <button 
                                    onClick={() => addToCart(item, 'FULL')}
                                    className="flex-1 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded py-1.5 px-1 text-center transition-colors"
                                 >
                                    <div className="text-[10px] text-slate-400 font-bold uppercase">Full</div>
                                    <div className="text-xs font-bold text-emerald-700">₹{item.price}</div>
                                 </button>

                                 {/* Half Plate Button (Optional) */}
                                 {item.halfPrice && (
                                    <button 
                                       onClick={() => addToCart(item, 'HALF')}
                                       className="flex-1 bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-200 rounded py-1.5 px-1 text-center transition-colors"
                                    >
                                       <div className="text-[10px] text-slate-400 font-bold uppercase">Half</div>
                                       <div className="text-xs font-bold text-orange-700">₹{item.halfPrice}</div>
                                    </button>
                                 )}
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>

               {/* Mobile Sticky Footer (Only Visible on Mobile when Cart is Closed) */}
               {!isMobileCartOpen && (
                 <div 
                   onClick={() => setIsMobileCartOpen(true)}
                   className="fixed bottom-0 left-0 right-0 md:hidden bg-slate-900 text-white p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.2)] border-t border-slate-800 flex justify-between items-center cursor-pointer z-40"
                 >
                    <div>
                      <div className="text-sm font-bold flex items-center gap-2">
                         <span className="bg-white text-slate-900 w-6 h-6 rounded-full flex items-center justify-center text-xs">
                            {cart.reduce((a,b) => a+b.quantity, 0)}
                         </span>
                         Items Added
                      </div>
                      <div className="text-xs text-slate-400">
                         Total: ₹{cartTotal} {(orderCustomAmount || orderCustomSku) && '+ Extras'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 font-bold text-emerald-400">
                       View Order <ChevronUp size={18} />
                    </div>
                 </div>
               )}
           </div>

           {/* Right: Cart (Desktop: Side Panel, Mobile: Full Screen Modal Overlay) */}
           <div 
             className={`
                bg-white flex flex-col 
                md:w-96 md:border-l md:border-slate-200 md:static md:h-full md:flex md:rounded-r-xl
                ${isMobileCartOpen ? 'fixed inset-0 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300' : 'hidden'}
             `}
           >
               {/* Mobile Close Header */}
               <div className="md:hidden p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
                  <button onClick={() => setIsMobileCartOpen(false)} className="p-2 -ml-2 text-slate-500">
                     <ArrowLeft size={24} />
                  </button>
                  <h3 className="font-bold text-lg text-slate-800">Current Order</h3>
               </div>

               {/* Desktop Header */}
               <div className="hidden md:flex p-4 border-b border-slate-100 justify-between items-center bg-slate-800 text-white rounded-tr-xl">
                  <div className="flex items-center gap-2 font-bold">
                     <ShoppingCart size={18} /> Current Order
                  </div>
                  <div className="text-xs bg-white/20 px-2 py-0.5 rounded">
                     {cart.reduce((a,b) => a+b.quantity, 0)} Items
                  </div>
               </div>

               {/* Customer Link */}
               <div className="p-3 border-b border-slate-100 bg-slate-50">
                  {linkedCustomer ? (
                     <div className="flex justify-between items-center bg-white border border-slate-200 p-2 rounded-lg">
                        <div>
                           <div className="text-xs font-bold text-emerald-600">Customer Linked</div>
                           <div className="text-sm font-bold text-slate-700">{linkedCustomer.name}</div>
                           <div className="text-xs text-slate-400">{linkedCustomer.phone}</div>
                        </div>
                        <button onClick={() => setLinkedCustomer(null)} className="text-red-400 hover:text-red-600">
                           <X size={16} />
                        </button>
                     </div>
                  ) : (
                     <button 
                        onClick={() => setIsCustomerModalOpen(true)}
                        className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-slate-500 text-sm font-medium hover:bg-white hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
                     >
                        <Plus size={14} /> Add Customer (Loyalty)
                     </button>
                  )}
               </div>

               {/* Cart Items */}
               <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {cart.length === 0 && !orderCustomAmount && !orderCustomSku ? (
                     <div className="text-center text-slate-400 py-10 italic text-sm flex flex-col items-center">
                        <ShoppingCart size={32} className="opacity-20 mb-2"/>
                        Cart is empty. 
                        <br/>
                        Select items from the menu.
                        <button 
                           onClick={() => setIsMobileCartOpen(false)} 
                           className="md:hidden mt-4 text-emerald-600 font-bold underline"
                        >
                           Go to Menu
                        </button>
                     </div>
                  ) : (
                    <>
                     {/* Standard Items */}
                     {cart.map(item => (
                        <div key={item.id} className="flex justify-between items-center group">
                           <div className="flex-1">
                              <div className="text-sm font-medium text-slate-700">
                                 {item.name} 
                                 {item.variant === 'HALF' && <span className="text-xs text-slate-400 ml-1">(Half)</span>}
                              </div>
                              <div className="text-xs text-slate-400">
                                 ₹{item.price} x {item.quantity}
                              </div>
                           </div>
                           <div className="flex items-center gap-3">
                                <button onClick={() => updateCartQty(item.id, -1)} className="text-slate-400 hover:text-red-500">
                                  <MinusCircle size={20} />
                                </button>
                                <span className="font-bold text-slate-700 w-4 text-center">{item.quantity}</span>
                                <button onClick={() => updateCartQty(item.id, 1)} className="text-slate-400 hover:text-emerald-500">
                                  <PlusCircle size={20} />
                                </button>
                           </div>
                        </div>
                     ))}
                     
                     {/* Custom Order Additions */}
                     {(orderCustomAmount || orderCustomSku) && <div className="border-t border-slate-100 my-2 pt-2"></div>}
                     
                     {/* Custom Amount Display */}
                     {orderCustomAmount && (
                         <div className="flex justify-between items-center bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                             <div>
                                 <div className="text-sm font-bold text-indigo-700">Custom Charge</div>
                                 <div className="text-xs text-indigo-500 italic">{orderCustomAmount.reason}</div>
                             </div>
                             <div className="flex items-center gap-2">
                                <span className="font-bold text-indigo-800">₹{orderCustomAmount.amount}</span>
                                <button onClick={() => setOrderCustomAmount(null)} className="text-indigo-400 hover:text-red-500"><X size={16}/></button>
                             </div>
                         </div>
                     )}

                     {/* Custom SKU Display */}
                     {orderCustomSku && (
                         <div className="bg-slate-100 p-2 rounded-lg border border-slate-200">
                             <div className="flex justify-between items-center mb-1">
                                 <div>
                                     <div className="text-sm font-bold text-slate-700">Raw Usage ({orderCustomSku.items.length} items)</div>
                                     <div className="text-xs text-slate-500 italic">{orderCustomSku.reason}</div>
                                 </div>
                                 <button onClick={() => setOrderCustomSku(null)} className="text-slate-400 hover:text-red-500"><X size={16}/></button>
                             </div>
                             <div className="space-y-1 mt-1">
                                {orderCustomSku.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-xs text-slate-600">
                                        <span>{getSkuName(item.skuId)}</span>
                                        <span className="font-mono">{item.qty} pcs</span>
                                    </div>
                                ))}
                             </div>
                         </div>
                     )}
                    </>
                  )}
               </div>

               {/* Footer */}
               <div className="p-4 bg-slate-50 border-t border-slate-200 md:rounded-br-xl pb-8 md:pb-4">
                  <div className="flex justify-between items-center mb-4 text-lg">
                     <span className="font-bold text-slate-500">Total</span>
                     <span className="font-bold text-slate-800">₹{cartTotal}</span>
                  </div>
                  <button 
                     onClick={submitOrder}
                     disabled={cart.length === 0 && !orderCustomAmount}
                     className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                     {showSuccess ? <CheckCircle2 size={20} /> : <Receipt size={20} />}
                     {showSuccess ? 'Order Placed!' : `Charge ₹${cartTotal}`}
                  </button>
               </div>
           </div>

           {/* Customer Search Modal */}
           {isCustomerModalOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                 <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                       <h3 className="font-bold text-slate-700">Find Customer</h3>
                       <button onClick={() => setIsCustomerModalOpen(false)}><X size={20} className="text-slate-400" /></button>
                    </div>
                    <div className="p-4">
                       <div className="relative mb-4">
                          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                          <input 
                             type="text" 
                             placeholder="Search Name or Phone..." 
                             autoFocus
                             value={customerSearch}
                             onChange={e => setCustomerSearch(e.target.value)}
                             className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                       </div>
                       
                       <div className="max-h-60 overflow-y-auto space-y-2">
                          {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phoneNumber.includes(customerSearch)).slice(0, 5).map(c => (
                             <button 
                                key={c.id}
                                onClick={() => handleLinkCustomer(c.phoneNumber, c.name)}
                                className="w-full text-left p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 flex justify-between items-center group"
                             >
                                <div>
                                   <div className="font-bold text-slate-700">{c.name}</div>
                                   <div className="text-xs text-slate-400">{c.phoneNumber}</div>
                                </div>
                                <div className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100">Select</div>
                             </button>
                          ))}
                          
                          {customerSearch.length > 0 && !customers.some(c => c.phoneNumber === customerSearch) && (
                             <button
                                onClick={() => handleLinkCustomer(customerSearch, "New Customer")}
                                className="w-full p-3 rounded-lg border-2 border-dashed border-emerald-200 text-emerald-600 font-bold text-sm hover:bg-emerald-50 flex justify-center items-center gap-2 mt-2"
                             >
                                <Plus size={16} /> Create New: {customerSearch}
                             </button>
                          )}
                       </div>
                    </div>
                 </div>
              </div>
           )}

            {/* Custom Amount Modal (Order Level) */}
            {isCustomAmountOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50 rounded-t-xl">
                        <h3 className="font-bold text-indigo-800">Add Custom Amount</h3>
                        <button onClick={() => setIsCustomAmountOpen(false)}><X size={20} className="text-slate-400" /></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (₹)</label>
                          <input 
                              type="number"
                              min="1"
                              autoFocus
                              value={customAmountVal}
                              onChange={e => setCustomAmountVal(e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-bold text-slate-800"
                              placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason (Required)</label>
                          <input 
                              type="text"
                              value={customAmountReason}
                              onChange={e => setCustomAmountReason(e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="e.g. Delivery Charge, Adjustment"
                          />
                        </div>
                        <button 
                          onClick={applyCustomAmount}
                          disabled={!customAmountVal || !customAmountReason}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-md transition-colors"
                        >
                          Apply to Order
                        </button>
                    </div>
                  </div>
              </div>
            )}

            {/* Custom SKU Modal (Refactored to support list) */}
            {isCustomSkuOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                        <h3 className="font-bold text-slate-700">Add Raw Item Usage</h3>
                        <button onClick={() => setIsCustomSkuOpen(false)}><X size={20} className="text-slate-400" /></button>
                    </div>
                    
                    <div className="p-6 flex-1 overflow-y-auto">
                        {/* List Builder */}
                        <div className="mb-4 space-y-3">
                             <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Raw Item</label>
                                   <select 
                                      value={tempSkuId}
                                      onChange={e => setTempSkuId(e.target.value)}
                                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 outline-none bg-white"
                                   >
                                      <option value="">-- Select SKU --</option>
                                      {skus.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                   </select>
                                </div>
                                <div className="w-20">
                                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Qty</label>
                                   <input 
                                      type="number"
                                      min="1"
                                      value={tempSkuQty}
                                      onChange={e => setTempSkuQty(e.target.value)}
                                      className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm text-center font-bold focus:ring-2 focus:ring-slate-500 outline-none"
                                   />
                                </div>
                                <button 
                                  onClick={handleAddCustomItemToBuffer}
                                  disabled={!tempSkuId || !tempSkuQty}
                                  className="h-[38px] px-3 bg-slate-800 text-white rounded-lg disabled:opacity-50 hover:bg-slate-700 transition-colors"
                                >
                                   <PlusSquare size={18} />
                                </button>
                             </div>
                        </div>

                        {/* List Display */}
                        {customSkuList.length > 0 ? (
                           <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden mb-4">
                              <table className="w-full text-sm text-left">
                                 <thead className="bg-slate-100 text-xs text-slate-500 uppercase">
                                    <tr>
                                       <th className="p-2 pl-3">Item</th>
                                       <th className="p-2 text-center">Qty</th>
                                       <th className="p-2 w-8"></th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100">
                                    {customSkuList.map((item, idx) => (
                                       <tr key={idx}>
                                          <td className="p-2 pl-3 font-medium text-slate-700">{getSkuName(item.skuId)}</td>
                                          <td className="p-2 text-center font-mono">{item.qty}</td>
                                          <td className="p-2 text-center">
                                             <button onClick={() => handleRemoveCustomItemFromBuffer(idx)} className="text-slate-400 hover:text-red-500">
                                                <X size={14} />
                                             </button>
                                          </td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        ) : (
                           <div className="text-center py-6 text-slate-400 text-xs italic border border-dashed border-slate-200 rounded-lg mb-4">
                              No items added yet.
                           </div>
                        )}

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason (Required)</label>
                          <input 
                              type="text"
                              value={customSkuReason}
                              onChange={e => setCustomSkuReason(e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-slate-500 outline-none text-sm"
                              placeholder="e.g. Special Request, Staff Consumption, Spilled"
                          />
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl">
                        <button 
                          onClick={applyCustomSku}
                          disabled={customSkuList.length === 0 || !customSkuReason}
                          className="w-full py-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg font-bold shadow-md transition-colors"
                        >
                          Attach {customSkuList.length} Items to Order
                        </button>
                        <p className="text-[10px] text-center text-slate-400 mt-2">
                           Note: Inventory will be deducted. No price added to total.
                        </p>
                    </div>
                  </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default Orders;
