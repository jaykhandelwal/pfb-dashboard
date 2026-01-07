
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { SalesPlatform, OrderItem, MenuItem, RewardResult, Order } from '../types';
import { Receipt, Filter, Calendar, Store, PlusCircle, Plus, Search, ShoppingCart, IndianRupee, X, Box, Trash2, ChevronRight, User, AlertCircle, Phone, Tag, Clock, Send, Bug, Loader2, Gift } from 'lucide-react';
import { getLocalISOString } from '../constants';
import { sendWhatsAppInvoice, WebhookContext, constructWebhookPayload, WebhookPayload, sendWebhookRequest } from '../services/webhookService';

const Orders: React.FC = () => {
  const { orders, skus, menuItems, branches, customers, addOrder, deleteOrder, menuCategories, appSettings, checkCustomerReward } = useStore();
  const { currentUser } = useAuth(); 
  const [activeTab, setActiveTab] = useState<'HISTORY' | 'NEW_ORDER'>('HISTORY');
  
  // -- HISTORY STATE --
  const [date, setDate] = useState<string>(getLocalISOString());
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  
  // -- NEW ORDER STATE --
  const [posBranchId, setPosBranchId] = useState<string>(branches[0]?.id || '');
  const [posPlatform, setPosPlatform] = useState<SalesPlatform>('POS');
  
  // Payment State
  const [paymentMode, setPaymentMode] = useState<'SINGLE' | 'SPLIT'>('SINGLE');
  const [posPaymentMethod, setPosPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [splitInputs, setSplitInputs] = useState({ CASH: '', UPI: '', CARD: '' });

  const [cart, setCart] = useState<OrderItem[]>([]);
  
  // Customer State
  const [customerSearch, setCustomerSearch] = useState('');
  const [linkedCustomer, setLinkedCustomer] = useState<{name: string, phone: string, id: string} | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  
  // Loyalty State
  const [activeRewardResult, setActiveRewardResult] = useState<RewardResult | null>(null);
  const [isRewardApplied, setIsRewardApplied] = useState(false);
  
  // New Customer Form State
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

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
  const [orderCustomSku, setOrderCustomSku] = useState<{ items: { skuId: string, quantity: number }[], reason: string } | null>(null);
  
  // Temp state for modal builder
  const [customSkuList, setCustomSkuList] = useState<{skuId: string, quantity: number}[]>([]);
  const [tempSkuId, setTempSkuId] = useState('');
  const [tempSkuQty, setTempSkuQty] = useState('');
  const [customSkuReasonVal, setCustomSkuReasonVal] = useState('');

  // -- DEBUG / WEBHOOK STATE --
  const [debugPayload, setDebugPayload] = useState<WebhookPayload | null>(null);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [isSendingWebhook, setIsSendingWebhook] = useState(false);

  // -- HELPERS --
  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name || id;
  const getSkuName = (id: string) => skus.find(s => s.id === id)?.name || id;
  
  const getPlatformStyle = (platform: SalesPlatform) => {
    switch (platform) {
      case 'POS': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ZOMATO': return 'bg-red-100 text-red-800 border-red-200';
      case 'SWIGGY': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  // Derive unique categories for filter
  const uniqueCategories = useMemo(() => {
     const cats = new Set(menuItems.map(m => m.category || 'Uncategorized'));
     return ['All', ...Array.from(cats).sort()];
  }, [menuItems]);

  // -- EFFECTS --
  
  // Auto-fill new customer form based on search input
  useEffect(() => {
      if (!customerSearch) {
          setNewCustomerName('');
          setNewCustomerPhone('');
          return;
      }

      const isNumeric = /^\d+$/.test(customerSearch);
      if (isNumeric) {
          setNewCustomerPhone(customerSearch.slice(0, 10));
      } else {
          setNewCustomerName(customerSearch);
      }
  }, [customerSearch]);

  // -- HANDLERS --

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/\D/g, ''); // Strip non-digits
      if (val.length <= 10) {
          setNewCustomerPhone(val);
      }
  };

  // -- HISTORY LOGIC --
  const filteredOrders = useMemo(() => {
    // Sort by timestamp desc (newest first)
    return orders.filter(o => {
      if (o.date !== date) return false;
      if (selectedBranch !== 'ALL' && o.branchId !== selectedBranch) return false;
      if (selectedPlatform !== 'ALL' && o.platform !== selectedPlatform) return false;
      return true;
    }).sort((a,b) => b.timestamp - a.timestamp);
  }, [orders, date, selectedBranch, selectedPlatform]);

  // -- POS LOGIC --
  const addToCart = (item: MenuItem, variant: 'FULL' | 'HALF' = 'FULL', priceOverride?: number) => {
     const priceToUse = priceOverride !== undefined 
        ? priceOverride 
        : (variant === 'HALF' && item.halfPrice ? item.halfPrice : item.price);
        
     const cartItemKey = `${item.id}-${variant}`;

     setCart(prev => {
        // If price override is present (Free Item), treat as unique entry
        if (priceOverride === 0) {
             return [...prev, {
              id: `reward-${Date.now()}`,
              menuItemId: item.id,
              name: item.name,
              price: 0,
              quantity: 1,
              variant: variant
           } as OrderItem];
        }

        const existing = prev.find(i => `${i.menuItemId}-${i.variant || 'FULL'}` === cartItemKey && i.price === priceToUse);
        if(existing) {
           return prev.map(i => `${i.menuItemId}-${i.variant || 'FULL'}` === cartItemKey && i.price === priceToUse ? { ...i, quantity: i.quantity + 1 } : i);
        } else {
           return [...prev, {
              id: `temp-${Date.now()}`,
              menuItemId: item.id,
              name: item.name,
              price: priceToUse,
              quantity: 1,
              variant: variant
           } as OrderItem];
        }
     });
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

  const cartTotal = useMemo(() => {
     const itemsTotal = cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
     const customAmt = orderCustomAmount ? orderCustomAmount.amount : 0;
     return itemsTotal + customAmt;
  }, [cart, orderCustomAmount]);

  const splitTotal = useMemo(() => {
      const c = parseFloat(splitInputs.CASH) || 0;
      const u = parseFloat(splitInputs.UPI) || 0;
      const d = parseFloat(splitInputs.CARD) || 0;
      return c + u + d;
  }, [splitInputs]);

  const remainingSplit = cartTotal - splitTotal;

  const applyCustomAmount = () => {
    if (!customAmountVal) return;
    setOrderCustomAmount({
      amount: parseFloat(customAmountVal),
      reason: customAmountReason || 'Miscellaneous'
    });
    setIsCustomAmountOpen(false);
    setCustomAmountVal('');
    setCustomAmountReason('');
  };

  // Link Existing Customer & Check Rewards
  const handleLinkCustomer = (phone: string, name?: string) => {
     const existing = customers.find(c => c.phoneNumber === phone);
     const customerName = existing ? existing.name : (name || 'New Customer');
     const customerId = existing ? existing.id : phone;

     setLinkedCustomer({ 
         name: customerName, 
         phone: phone, 
         id: customerId
     });
     
     // Reset Search
     setNewCustomerPhone('');
     setNewCustomerName('');
     setCustomerSearch('');
     setIsCustomerModalOpen(false);
     
     // Check Rewards
     const reward = checkCustomerReward(customerId);
     setActiveRewardResult(reward);
     setIsRewardApplied(false); // Reset application status when linking new customer
  };

  const applyReward = () => {
    if(!activeRewardResult) return;
    const { rule } = activeRewardResult;
    
    if(rule.type === 'FREE_ITEM') {
        let item = menuItems.find(m => m.id === rule.value);
        
        // --- SMART FALLBACK FOR LEGACY DATA ---
        // If the rule still points to an old SKU ID (not a Menu ID),
        // try to find a menu item that contains this SKU.
        if (!item) {
            console.warn(`Legacy Reward Detected: Rule value '${rule.value}' not found in Menu. Attempting SKU lookup...`);
            item = menuItems.find(m => m.ingredients.some(i => i.skuId === rule.value));
        }
        // --------------------------------------

        if(item) {
            addToCart(item, rule.rewardVariant || 'FULL', 0);
            setIsRewardApplied(true);
        } else {
            alert("Reward item configuration invalid. Please check Membership Settings.");
        }
    } else if (rule.type === 'DISCOUNT_PERCENT') {
        alert(`Please apply a custom discount of ${rule.value}% manually.`);
        setIsRewardApplied(true);
    }
  };

  const handleCheckout = async () => {
      if (cart.length === 0 && !orderCustomAmount && !orderCustomSku) return;
      
      // Validation: Payment Split
      if (paymentMode === 'SPLIT' && Math.abs(cartTotal - splitTotal) > 1) {
          alert("Split amounts must match total order value.");
          return;
      }

      // Validation: Customer Requirement
      if (appSettings.require_customer_phone && !linkedCustomer) {
          alert("Customer is required for this order. Please link a customer.");
          setIsCustomerModalOpen(true);
          return;
      }

      // Prepare Payload
      const newOrder: Order = {
          id: `ord-${Date.now()}`,
          branchId: posBranchId,
          customerId: linkedCustomer?.id,
          customerName: linkedCustomer?.name,
          platform: posPlatform,
          totalAmount: cartTotal,
          status: 'COMPLETED' as const,
          paymentMethod: (paymentMode === 'SPLIT' ? 'SPLIT' : posPaymentMethod) as 'SPLIT' | 'CASH' | 'UPI' | 'CARD',
          paymentSplit: paymentMode === 'SPLIT' ? [
              { method: 'CASH', amount: parseFloat(splitInputs.CASH) || 0 },
              { method: 'UPI', amount: parseFloat(splitInputs.UPI) || 0 },
              { method: 'CARD', amount: parseFloat(splitInputs.CARD) || 0 }
          ].filter(s => s.amount > 0) as any : undefined,
          date: getLocalISOString(),
          timestamp: Date.now(),
          items: cart,
          customAmount: orderCustomAmount?.amount,
          customAmountReason: orderCustomAmount?.reason,
          customSkuItems: orderCustomSku?.items,
          customSkuReason: orderCustomSku?.reason
      };

      // Save Order
      await addOrder(newOrder, isRewardApplied && activeRewardResult?.coupon ? activeRewardResult.coupon.id : undefined);

      // Webhook Trigger (WhatsApp Invoice)
      if (appSettings.enable_whatsapp_webhook && appSettings.whatsapp_webhook_url) {
          const webhookContext: WebhookContext = {
              orderId: newOrder.id,
              orderDate: newOrder.date,
              cart: cart,
              cartTotal: cartTotal,
              menuItems: menuItems,
              skus: skus,
              currentUser: currentUser,
              linkedCustomer: linkedCustomer,
              customAmount: orderCustomAmount,
              customSku: orderCustomSku,
              paymentMethod: newOrder.paymentMethod,
              branchId: newOrder.branchId,
              platform: newOrder.platform
          };
          
          if (appSettings.debug_whatsapp_webhook) {
             const payload = constructWebhookPayload(webhookContext);
             setDebugPayload(payload);
             setIsDebugModalOpen(true);
          } else {
             sendWhatsAppInvoice(appSettings.whatsapp_webhook_url, webhookContext);
          }
      }

      // Reset
      setCart([]);
      setLinkedCustomer(null);
      setOrderCustomAmount(null);
      setOrderCustomSku(null);
      setSplitInputs({ CASH: '', UPI: '', CARD: '' });
      setIsRewardApplied(false);
      setActiveRewardResult(null);
      
      setActiveTab('HISTORY');
  };

  // -- RENDER HELPERS --
  
  // NEW: Render History Card
  const renderOrderCard = (order: Order) => (
    <div key={order.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3 relative group">
        <div className="flex justify-between items-start">
            <div>
                <span className="text-[10px] font-mono font-bold text-slate-400">#{order.id.slice(-6).toUpperCase()}</span>
                <h4 className="font-bold text-slate-700 text-sm">{order.customerName || 'Walk-in Customer'}</h4>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase ${getPlatformStyle(order.platform)}`}>
                {order.platform}
            </span>
        </div>
        
        <div className="flex-1 border-t border-dashed border-slate-100 pt-2 mt-1">
            <p className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
               <Clock size={10} /> {new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </p>
            <div className="text-xs text-slate-600 space-y-1">
                {order.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between">
                        <span className="truncate max-w-[150px]">{i.quantity}x {i.name} {i.variant === 'HALF' ? '(Half)' : ''}</span>
                    </div>
                ))}
                {order.customAmount ? <div className="text-slate-500 italic">+ Custom Charge (₹{order.customAmount})</div> : ''}
            </div>
        </div>

        <div className="flex justify-between items-end border-t border-slate-100 pt-3 mt-auto">
            <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Total Amount</p>
                <p className="text-lg font-bold text-slate-800">₹{order.totalAmount}</p>
            </div>
            <div className="flex gap-2">
                 <button 
                    onClick={() => { if(confirm('Delete this order?')) deleteOrder(order.id) }}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Order"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    </div>
  );

  const renderPosItem = (item: MenuItem) => {
      const hasHalf = item.halfPrice !== undefined;
      return (
          <div key={item.id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between hover:border-emerald-400 transition-all h-full">
              <div className="mb-2">
                  <h4 className="font-bold text-slate-700 text-sm leading-tight mb-1">{item.name}</h4>
                  {item.description && <p className="text-[10px] text-slate-400 leading-tight line-clamp-2">{item.description}</p>}
              </div>
              
              <div className="mt-auto pt-2">
                  {hasHalf ? (
                      <div className="flex gap-2">
                          <button 
                            onClick={() => addToCart(item, 'FULL')}
                            className="flex-1 bg-slate-800 text-white text-xs py-2 rounded-lg font-bold hover:bg-slate-700 transition-colors shadow-sm active:scale-95"
                          >
                              Full ₹{item.price}
                          </button>
                          <button 
                            onClick={() => addToCart(item, 'HALF')}
                            className="flex-1 bg-white text-orange-600 border border-orange-200 text-xs py-2 rounded-lg font-bold hover:bg-orange-50 transition-colors shadow-sm active:scale-95"
                          >
                              Half ₹{item.halfPrice}
                          </button>
                      </div>
                  ) : (
                      <button 
                        onClick={() => addToCart(item)}
                        className="w-full bg-slate-100 text-slate-700 border border-slate-200 text-xs py-2 rounded-lg font-bold hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-colors flex justify-between px-3 items-center active:scale-95"
                      >
                          <span>Add</span>
                          <span>₹{item.price}</span>
                      </button>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
        {/* Header Tabs */}
        <div className="flex justify-between items-center mb-4 px-1">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                    onClick={() => setActiveTab('HISTORY')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'HISTORY' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Receipt size={16} /> Sales History
                </button>
                <button
                    onClick={() => setActiveTab('NEW_ORDER')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'NEW_ORDER' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-emerald-600'}`}
                >
                    <PlusCircle size={16} /> New Order (POS)
                </button>
            </div>
        </div>

        {/* --- HISTORY VIEW --- */}
        {activeTab === 'HISTORY' && (
            <div className="flex-1 overflow-hidden flex flex-col">
                {/* Filters */}
                <div className="p-4 mb-4 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-slate-400" />
                        <input 
                            type="date" 
                            value={date} 
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Store size={16} className="text-slate-400" />
                        <select 
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="ALL">All Branches</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-slate-400" />
                        <select 
                            value={selectedPlatform}
                            onChange={(e) => setSelectedPlatform(e.target.value)}
                            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="ALL">All Platforms</option>
                            <option value="POS">POS</option>
                            <option value="ZOMATO">Zomato</option>
                            <option value="SWIGGY">Swiggy</option>
                        </select>
                    </div>
                </div>

                {/* Orders Grid (Replaces Table) */}
                <div className="flex-1 overflow-y-auto pb-20">
                    {filteredOrders.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Receipt size={48} className="mb-4 text-slate-300" />
                            <p>No orders found for this selection.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredOrders.map(renderOrderCard)}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* --- POS VIEW --- */}
        {activeTab === 'NEW_ORDER' && (
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-4 relative">
                {/* Left: Menu & Grid */}
                <div className="flex-1 flex flex-col bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                    {/* Category Filter */}
                    <div className="p-2 bg-white border-b border-slate-200 overflow-x-auto flex gap-2">
                        {uniqueCategories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-200'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Items Grid */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {menuItems
                                .filter(item => selectedCategory === 'All' || (item.category || 'Uncategorized') === selectedCategory)
                                .map(renderPosItem)
                            }
                        </div>
                    </div>
                </div>

                {/* Right: Cart & Checkout (Sidebar) */}
                <div className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl transform transition-transform duration-300 z-30 md:static md:translate-x-0 md:rounded-xl md:border md:border-slate-200 md:shadow-sm flex flex-col ${isMobileCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    {/* Mobile Header for Cart */}
                    <div className="md:hidden p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><ShoppingCart size={18}/> Current Order</h3>
                        <button onClick={() => setIsMobileCartOpen(false)}><X size={24} className="text-slate-500"/></button>
                    </div>

                    {/* Customer & Branch Info */}
                    <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50">
                        <div className="flex gap-2">
                            <select 
                                value={posBranchId} 
                                onChange={(e) => setPosBranchId(e.target.value)}
                                className="flex-1 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold outline-none"
                            >
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                            <select 
                                value={posPlatform} 
                                onChange={(e) => setPosPlatform(e.target.value as SalesPlatform)}
                                className="w-24 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold outline-none"
                            >
                                <option value="POS">POS</option>
                                <option value="ZOMATO">Zomato</option>
                                <option value="SWIGGY">Swiggy</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                            {linkedCustomer ? (
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-800">{linkedCustomer.name}</p>
                                    <p className="text-[10px] text-slate-500">{linkedCustomer.phone}</p>
                                </div>
                            ) : (
                                <span className="text-xs text-slate-400 italic">No customer linked</span>
                            )}
                            <button 
                                onClick={() => setIsCustomerModalOpen(true)}
                                className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded transition-colors"
                            >
                                {linkedCustomer ? <User size={16} /> : <PlusCircle size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Reward Banner */}
                    {activeRewardResult && !isRewardApplied && (
                        <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white p-3 mx-4 mt-4 rounded-lg shadow-md flex justify-between items-center animate-fade-in">
                            <div>
                                <p className="text-xs font-bold uppercase text-pink-100 flex items-center gap-1"><Gift size={12}/> Reward Available</p>
                                <p className="font-bold text-sm truncate w-40">{activeRewardResult.rule.description}</p>
                            </div>
                            <button 
                                onClick={applyReward}
                                className="bg-white text-pink-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-pink-50 transition-colors shadow-sm"
                            >
                                Apply
                            </button>
                        </div>
                    )}

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {cart.length === 0 && !orderCustomAmount && !orderCustomSku ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                <ShoppingCart size={48} className="mb-2" />
                                <p className="text-sm">Cart is empty</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {cart.map(item => (
                                    <div key={item.id} className={`flex justify-between items-start text-sm ${item.price === 0 ? 'bg-pink-50 border border-pink-100 p-2 rounded-lg' : ''}`}>
                                        <div className="flex-1">
                                            <p className={`font-medium ${item.price === 0 ? 'text-pink-700' : 'text-slate-700'}`}>
                                                {item.name} 
                                                {item.variant === 'HALF' && <span className="text-xs opacity-70 ml-1">(Half)</span>}
                                                {item.price === 0 && <span className="text-[10px] bg-pink-100 text-pink-600 px-1 rounded ml-2 font-bold uppercase">Free</span>}
                                            </p>
                                            <p className="text-xs text-slate-400">₹{item.price} x {item.quantity}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {item.price !== 0 && (
                                                <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50">
                                                    <button onClick={() => updateCartQty(item.id, -1)} className="px-2 py-1 hover:bg-slate-200 rounded-l-lg text-slate-500">-</button>
                                                    <span className="px-2 font-bold text-slate-700 text-xs">{item.quantity}</span>
                                                    <button onClick={() => updateCartQty(item.id, 1)} className="px-2 py-1 hover:bg-slate-200 rounded-r-lg text-slate-500">+</button>
                                                </div>
                                            )}
                                            <p className="font-bold text-slate-800 w-12 text-right">₹{item.price * item.quantity}</p>
                                            {item.price === 0 && (
                                                <button onClick={() => {
                                                    setCart(cart.filter(i => i.id !== item.id));
                                                    setIsRewardApplied(false);
                                                }} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                
                                {orderCustomAmount && (
                                    <div className="flex justify-between items-center text-sm py-2 border-t border-dashed border-slate-200">
                                        <div>
                                            <p className="font-medium text-slate-700">Custom Amount</p>
                                            <p className="text-xs text-slate-400">{orderCustomAmount.reason}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-slate-800">₹{orderCustomAmount.amount}</p>
                                            <button onClick={() => setOrderCustomAmount(null)} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Total & Checkout */}
                    <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
                        {/* Custom Actions */}
                        <div className="flex gap-2">
                            <button onClick={() => setIsCustomAmountOpen(true)} className="flex-1 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center justify-center gap-1">
                                <IndianRupee size={12}/> Custom Amt
                            </button>
                            {/* Only Admins can add Custom SKUs (Raw items) */}
                            {currentUser?.role === 'ADMIN' && (
                                <button onClick={() => setIsCustomSkuOpen(true)} className="flex-1 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center justify-center gap-1">
                                    <Box size={12}/> Custom Items
                                </button>
                            )}
                        </div>

                        <div className="flex justify-between items-end border-t border-slate-200 pt-3">
                            <span className="text-slate-500 font-bold">Total</span>
                            <span className="text-2xl font-bold text-slate-800">₹{cartTotal}</span>
                        </div>

                        {/* Payment Method */}
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                            <div className="flex gap-1 mb-2">
                                <button onClick={() => setPaymentMode('SINGLE')} className={`flex-1 py-1.5 text-xs font-bold rounded ${paymentMode === 'SINGLE' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>Single Pay</button>
                                <button onClick={() => setPaymentMode('SPLIT')} className={`flex-1 py-1.5 text-xs font-bold rounded ${paymentMode === 'SPLIT' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>Split Pay</button>
                            </div>
                            
                            {paymentMode === 'SINGLE' ? (
                                <div className="flex gap-2">
                                    {['CASH', 'UPI', 'CARD'].map(m => (
                                        <button 
                                            key={m} 
                                            onClick={() => setPosPaymentMethod(m as any)}
                                            className={`flex-1 py-2 text-xs font-bold rounded border ${posPaymentMethod === m ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-500 border-slate-200'}`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {['CASH', 'UPI', 'CARD'].map(m => (
                                        <div key={m} className="flex items-center gap-2">
                                            <span className="text-xs font-bold w-12 text-slate-500">{m}</span>
                                            <input 
                                                type="number" 
                                                placeholder="0"
                                                value={splitInputs[m as keyof typeof splitInputs]}
                                                onChange={(e) => setSplitInputs({...splitInputs, [m]: e.target.value})}
                                                className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>
                                    ))}
                                    <div className={`text-xs text-right font-bold ${Math.abs(remainingSplit) > 1 ? 'text-red-500' : 'text-emerald-500'}`}>
                                        Remaining: ₹{remainingSplit}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={handleCheckout}
                            disabled={cart.length === 0 && !orderCustomAmount}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Complete Order
                        </button>
                    </div>
                </div>

                {/* Mobile Floating Button */}
                {!isMobileCartOpen && (
                    <button 
                        onClick={() => setIsMobileCartOpen(true)}
                        className="md:hidden fixed bottom-6 right-6 bg-slate-900 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center z-20"
                    >
                        <div className="relative">
                            <ShoppingCart size={24} />
                            {cart.length > 0 && <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-slate-900">{cart.length}</span>}
                        </div>
                    </button>
                )}
            </div>
        )}

        {/* --- CUSTOMER MODAL --- */}
        {isCustomerModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                        <h3 className="font-bold text-slate-800">Link Customer</h3>
                        <button onClick={() => setIsCustomerModalOpen(false)}><X size={20} className="text-slate-400"/></button>
                    </div>
                    <div className="p-4 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input 
                                type="text"
                                autoFocus
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                placeholder="Search Name or Phone"
                                className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        {/* Search Results */}
                        {customerSearch && (
                            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                                {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phoneNumber.includes(customerSearch)).map(c => (
                                    <button 
                                        key={c.id} 
                                        onClick={() => handleLinkCustomer(c.phoneNumber, c.name)}
                                        className="w-full text-left p-3 hover:bg-slate-50 flex justify-between items-center group"
                                    >
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{c.name}</p>
                                            <p className="text-xs text-slate-500">{c.phoneNumber}</p>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500"/>
                                    </button>
                                ))}
                                {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phoneNumber.includes(customerSearch)).length === 0 && (
                                    <div className="p-3 text-center text-xs text-slate-400">No existing customer found.</div>
                                )}
                            </div>
                        )}

                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-slate-200"></div>
                            <span className="flex-shrink-0 mx-2 text-xs text-slate-400 font-bold uppercase">Or Create New</span>
                            <div className="flex-grow border-t border-slate-200"></div>
                        </div>

                        <div className="space-y-3">
                            <input 
                                type="text"
                                value={newCustomerName}
                                onChange={(e) => setNewCustomerName(e.target.value)}
                                placeholder="Customer Name"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <input 
                                type="text"
                                value={newCustomerPhone}
                                onChange={handlePhoneInput}
                                placeholder="Phone Number (10 digits)"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <button 
                                onClick={() => handleLinkCustomer(newCustomerPhone, newCustomerName)}
                                disabled={!newCustomerPhone || newCustomerPhone.length < 10 || !newCustomerName}
                                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                Add & Link Customer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- CUSTOM AMOUNT MODAL --- */}
        {isCustomAmountOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                    <h3 className="font-bold text-lg mb-4 text-slate-800">Add Custom Charge</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Amount</label>
                            <input 
                                type="number"
                                autoFocus
                                value={customAmountVal}
                                onChange={(e) => setCustomAmountVal(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-lg font-bold"
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Reason</label>
                            <input 
                                type="text"
                                value={customAmountReason}
                                onChange={(e) => setCustomAmountReason(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                placeholder="e.g. Delivery Charge"
                            />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setIsCustomAmountOpen(false)} className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 font-bold">Cancel</button>
                            <button onClick={applyCustomAmount} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold">Add</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- CUSTOM SKU MODAL (ADMIN ONLY) --- */}
        {isCustomSkuOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                    <h3 className="font-bold text-lg mb-4 text-slate-800">Add Raw Items (Unlisted)</h3>
                    
                    <div className="mb-4 space-y-2">
                        <div className="flex gap-2">
                            <select 
                                value={tempSkuId}
                                onChange={(e) => setTempSkuId(e.target.value)}
                                className="flex-1 border border-slate-300 rounded-lg px-2 py-2 text-sm"
                            >
                                <option value="">Select SKU</option>
                                {skus.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <input 
                                type="number"
                                value={tempSkuQty}
                                onChange={(e) => setTempSkuQty(e.target.value)}
                                className="w-20 border border-slate-300 rounded-lg px-2 py-2 text-sm"
                                placeholder="Qty"
                            />
                            <button 
                                onClick={() => {
                                    if(tempSkuId && tempSkuQty) {
                                        setCustomSkuList([...customSkuList, {skuId: tempSkuId, quantity: parseInt(tempSkuQty)}]);
                                        setTempSkuId('');
                                        setTempSkuQty('');
                                    }
                                }}
                                className="bg-indigo-100 text-indigo-700 p-2 rounded-lg"
                            >
                                <Plus size={20}/>
                            </button>
                        </div>
                        <input 
                            type="text"
                            value={customSkuReasonVal}
                            onChange={(e) => setCustomSkuReasonVal(e.target.value)}
                            placeholder="Reason (e.g. Special Order)"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-40 overflow-y-auto mb-4">
                        {customSkuList.length === 0 ? <p className="text-xs text-slate-400 text-center">No items added.</p> : (
                            <ul className="space-y-1">
                                {customSkuList.map((item, idx) => (
                                    <li key={idx} className="flex justify-between text-sm">
                                        <span>{getSkuName(item.skuId)}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold">{item.quantity} pcs</span>
                                            <button onClick={() => setCustomSkuList(customSkuList.filter((_, i) => i !== idx))} className="text-red-500"><X size={12}/></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => setIsCustomSkuOpen(false)} className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 font-bold">Cancel</button>
                        <button 
                            onClick={() => {
                                if(customSkuList.length > 0 && customSkuReasonVal) {
                                    setOrderCustomSku({ items: customSkuList, reason: customSkuReasonVal });
                                    setIsCustomSkuOpen(false);
                                }
                            }} 
                            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- WEBHOOK DEBUG MODAL --- */}
        {isDebugModalOpen && debugPayload && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                        <div className="flex items-center gap-3">
                            <div className="bg-amber-100 text-amber-600 p-2 rounded-lg">
                                <Bug size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">Webhook Debug</h3>
                                <p className="text-xs text-slate-500">Review JSON payload before sending.</p>
                            </div>
                        </div>
                        <button onClick={() => setIsDebugModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-auto bg-slate-900 p-4">
                        <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap">
                            {JSON.stringify(debugPayload, null, 2)}
                        </pre>
                    </div>

                    <div className="p-5 border-t border-slate-100 bg-white rounded-b-xl flex justify-end gap-3">
                        <button 
                            onClick={() => {
                                setIsDebugModalOpen(false);
                                setCart([]);
                                setLinkedCustomer(null);
                                setOrderCustomAmount(null);
                                setOrderCustomSku(null);
                                setSplitInputs({ CASH: '', UPI: '', CARD: '' });
                                setIsRewardApplied(false);
                                setActiveRewardResult(null);
                                setActiveTab('HISTORY');
                            }} 
                            className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                        >
                            Skip / Cancel
                        </button>
                        <button 
                            onClick={async () => {
                                setIsSendingWebhook(true);
                                try {
                                    await sendWebhookRequest(appSettings.whatsapp_webhook_url, debugPayload);
                                    alert("Webhook Sent Successfully!");
                                } catch(e) {
                                    alert("Failed to send webhook. Check console for details.");
                                    console.error(e);
                                }
                                setIsSendingWebhook(false);
                                setIsDebugModalOpen(false);
                                // Proceed to clear cart
                                setCart([]);
                                setLinkedCustomer(null);
                                setOrderCustomAmount(null);
                                setOrderCustomSku(null);
                                setSplitInputs({ CASH: '', UPI: '', CARD: '' });
                                setIsRewardApplied(false);
                                setActiveRewardResult(null);
                                setActiveTab('HISTORY');
                            }}
                            disabled={isSendingWebhook}
                            className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 flex items-center gap-2 transition-colors disabled:opacity-70"
                        >
                            {isSendingWebhook ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>}
                            Send Webhook
                        </button>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};

export default Orders;