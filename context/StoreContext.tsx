

import React, { createContext, useContext, useState, useEffect } from 'react';
import { SKU, Branch, Transaction, SalesRecord, ArchivedTransaction, Customer, MembershipRule, MenuItem, AttendanceRecord } from '../types';
import { INITIAL_BRANCHES, INITIAL_SKUS, INITIAL_CUSTOMERS, INITIAL_MEMBERSHIP_RULES, INITIAL_MENU_ITEMS } from '../constants';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

interface StoreContextType {
  skus: SKU[];
  menuItems: MenuItem[];
  branches: Branch[];
  transactions: Transaction[];
  salesRecords: SalesRecord[];
  customers: Customer[];
  membershipRules: MembershipRule[];
  deletedTransactions: ArchivedTransaction[];
  attendanceRecords: AttendanceRecord[];
  
  addBatchTransactions: (txs: Omit<Transaction, 'id' | 'timestamp' | 'batchId'>[]) => Promise<void>;
  deleteTransactionBatch: (batchId: string, deletedBy: string) => Promise<void>;
  addSalesRecords: (records: Omit<SalesRecord, 'id' | 'timestamp'>[]) => Promise<void>;
  deleteSalesRecordsForDate: (date: string, branchId: string, platform?: string) => Promise<void>;
  
  addSku: (sku: Omit<SKU, 'id' | 'order'>) => Promise<void>;
  updateSku: (sku: SKU) => Promise<void>;
  deleteSku: (id: string) => Promise<void>;
  reorderSku: (id: string, direction: 'up' | 'down') => Promise<void>;

  addMenuItem: (item: Omit<MenuItem, 'id'> & { id?: string }) => Promise<void>;
  updateMenuItem: (item: MenuItem) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
  
  addBranch: (branch: Omit<Branch, 'id'>) => Promise<void>;
  updateBranch: (branch: Branch) => Promise<void>;
  deleteBranch: (id: string) => Promise<void>;
  
  addCustomer: (customer: Omit<Customer, 'id' | 'joinedAt' | 'totalSpend' | 'orderCount' | 'lastOrderDate'>) => Promise<void>;
  updateCustomer: (customer: Customer) => Promise<void>;
  
  addMembershipRule: (rule: Omit<MembershipRule, 'id'>) => Promise<void>;
  deleteMembershipRule: (id: string) => Promise<void>;

  addAttendance: (record: Omit<AttendanceRecord, 'id'>) => Promise<void>;

  resetData: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [skus, setSkus] = useState<SKU[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [deletedTransactions, setDeletedTransactions] = useState<ArchivedTransaction[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [membershipRules, setMembershipRules] = useState<MembershipRule[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // --- Fetch Initial Data from Supabase ---
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!isSupabaseConfigured()) {
        // Fallback to initial constants if no DB
        if (skus.length === 0) setSkus(INITIAL_SKUS);
        if (menuItems.length === 0) setMenuItems(INITIAL_MENU_ITEMS);
        if (branches.length === 0) setBranches(INITIAL_BRANCHES);
        if (customers.length === 0) setCustomers(INITIAL_CUSTOMERS);
        if (membershipRules.length === 0) setMembershipRules(INITIAL_MEMBERSHIP_RULES);
        return; 
    }

    try {
      // 1. Fetch SKUs
      const { data: skusData, error: skuError } = await supabase
        .from('skus')
        .select('*')
        .order('order', { ascending: true });
      
      if (skuError) throw skuError;
      if (skusData && skusData.length > 0) {
        const mappedSkus = skusData.map((s: any) => ({
          ...s,
          piecesPerPacket: s.pieces_per_packet
        }));
        setSkus(mappedSkus);
      } else {
        setSkus(INITIAL_SKUS);
      }

      // 2. Fetch Menu Items
      const { data: menuData, error: menuError } = await supabase.from('menu_items').select('*');
      if (menuData && menuData.length > 0) {
        const mappedMenu = menuData.map((m: any) => ({
            ...m,
            // Assuming ingredients is stored as JSONB column in DB, or we fallback if structure mismatch
            ingredients: m.ingredients || []
        }));
        setMenuItems(mappedMenu);
      } else {
        setMenuItems(INITIAL_MENU_ITEMS);
      }

      // 3. Fetch Branches
      const { data: branchData, error: branchError } = await supabase.from('branches').select('*');
      if (branchError) throw branchError;
      if (branchData && branchData.length > 0) setBranches(branchData);
      else setBranches(INITIAL_BRANCHES);

      // 4. Fetch Transactions (Last 30 days)
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .order('timestamp', { ascending: false });
      
      if (txError) throw txError;
      if (txData) {
        const mappedTx = txData.map((t: any) => ({
          ...t,
          batchId: t.batch_id,
          skuId: t.sku_id,
          branchId: t.branch_id,
          quantityPieces: t.quantity_pieces,
          imageUrls: t.image_urls,
          userId: t.user_id,
          userName: t.user_name
        }));
        setTransactions(mappedTx);
      }

      // 5. Fetch Deleted Transactions
      const { data: delData, error: delError } = await supabase
        .from('deleted_transactions')
        .select('*')
        .order('deleted_at', { ascending: false });

      if (delError) console.warn("Could not fetch deleted transactions", delError);
      if (delData) {
         const mappedDel = delData.map((t: any) => ({
            ...t,
            batchId: t.batch_id,
            skuId: t.sku_id,
            branchId: t.branch_id,
            quantityPieces: t.quantity_pieces,
            imageUrls: t.image_urls,
            userId: t.user_id,
            userName: t.user_name,
            deletedAt: t.deleted_at,
            deletedBy: t.deleted_by
         }));
         setDeletedTransactions(mappedDel);
      }

      // 6. Fetch Sales Records
      const { data: salesData, error: salesError } = await supabase
        .from('sales_records')
        .select('*')
        .order('timestamp', { ascending: false });
      
      if (salesError) throw salesError;
      if (salesData) {
        const mappedSales = salesData.map((s: any) => ({
          ...s,
          branchId: s.branch_id,
          skuId: s.sku_id,
          quantitySold: s.quantity_sold,
          customerId: s.customer_id,
          orderAmount: s.order_amount
        }));
        setSalesRecords(mappedSales);
      }

      // 7. Fetch Customers
      const { data: custData, error: custError } = await supabase.from('customers').select('*');
      if (custError && custError.code !== 'PGRST116') console.warn("Customers fetch issue", custError);
      if (custData && custData.length > 0) {
        const mappedCust = custData.map((c: any) => ({
           ...c,
           phoneNumber: c.phone_number,
           totalSpend: c.total_spend,
           orderCount: c.order_count,
           joinedAt: c.joined_at,
           lastOrderDate: c.last_order_date
        }));
        setCustomers(mappedCust);
      } else {
         setCustomers(INITIAL_CUSTOMERS);
      }

      // 8. Fetch Membership Rules
      const { data: rulesData, error: rulesError } = await supabase.from('membership_rules').select('*');
      if (rulesData && rulesData.length > 0) {
        const mappedRules = rulesData.map((r: any) => ({
           ...r,
           triggerOrderCount: r.trigger_order_count,
           timeFrameDays: r.time_frame_days
        }));
        setMembershipRules(mappedRules);
      } else {
        setMembershipRules(INITIAL_MEMBERSHIP_RULES);
      }

      // 9. Fetch Attendance
      const { data: attData, error: attError } = await supabase.from('attendance').select('*').order('timestamp', { ascending: false });
      if (!attError && attData) {
          const mappedAtt = attData.map((a: any) => ({
            id: a.id,
            userId: a.user_id,
            userName: a.user_name,
            branchId: a.branch_id,
            date: a.date,
            timestamp: a.timestamp,
            imageUrl: a.image_url
          }));
          setAttendanceRecords(mappedAtt);
      }

    } catch (error) {
      console.warn("StoreContext: Error fetching data (Offline Mode):", error);
    }
  };

  // --- POS LISTENER ---
  useEffect(() => {
    const handlePosMessage = async (event: MessageEvent) => {
      if (event.data && event.data.type === 'PAKAJA_IMPORT_SALES' && event.data.payload) {
        try {
          const { date, items, platform, branchId, timestamp, customer, totalAmount } = event.data.payload;
          
          if (!date || !Array.isArray(items) || !platform || !branchId) return;
          if (!['POS', 'ZOMATO', 'SWIGGY'].includes(platform)) return;

          const batchTimestamp = timestamp || Date.now();
          let linkedCustomerId = null;
          let orderTotalValue = 0;

          // 1. Calculate Order Value
          // Priority A: Use the 'totalAmount' sent explicitly by the POS
          if (totalAmount && typeof totalAmount === 'number') {
             orderTotalValue = totalAmount;
          } 
          // Priority B: Fallback calculation using our Menu Items list
          else {
             items.forEach((item: any) => {
                const menuItem = menuItems.find(m => m.id === item.skuId);
                if (menuItem) {
                    orderTotalValue += (menuItem.price * Number(item.quantity));
                } else {
                    // Deep fallback: check if it matches a raw SKU via ingredient map
                    const ingredientMatch = menuItems.find(m => m.ingredients.some(i => i.skuId === item.skuId));
                    if (ingredientMatch) {
                        orderTotalValue += (ingredientMatch.price * Number(item.quantity));
                    }
                }
             });
          }

          // 2. Handle Customer (Create or Update)
          // Enforcement: ID MUST be the Phone Number
          if (customer && customer.phoneNumber) {
            const cleanPhone = customer.phoneNumber.trim();
            // We use the phone number itself as the Unique ID
            linkedCustomerId = cleanPhone;

            const existingCustomer = customers.find(c => c.id === cleanPhone);
            
            if (existingCustomer) {
               const updatedCustomer = {
                 ...existingCustomer,
                 totalSpend: existingCustomer.totalSpend + orderTotalValue,
                 orderCount: existingCustomer.orderCount + 1,
                 lastOrderDate: date
               };
               await updateCustomer(updatedCustomer);
            } else {
               const newCustomer: Customer = {
                 id: cleanPhone, // ID IS PHONE NUMBER
                 name: customer.name || 'Unknown',
                 phoneNumber: cleanPhone,
                 totalSpend: orderTotalValue,
                 orderCount: 1,
                 joinedAt: new Date().toISOString(),
                 lastOrderDate: date
               };
               
               if (isSupabaseConfigured()) {
                  await supabase.from('customers').insert({
                     id: newCustomer.id,
                     name: newCustomer.name,
                     phone_number: newCustomer.phoneNumber,
                     total_spend: newCustomer.totalSpend,
                     order_count: newCustomer.orderCount,
                     joined_at: newCustomer.joinedAt,
                     last_order_date: newCustomer.lastOrderDate
                  });
               }
               setCustomers(prev => [...prev, newCustomer]);
            }
          }

          // 3. Create Sales Records
          const recordsToInsert = items.map((item: any) => ({
             id: generateId(),
             timestamp: batchTimestamp,
             date,
             branch_id: branchId,
             platform,
             sku_id: item.skuId, 
             quantity_sold: Number(item.quantity),
             customer_id: linkedCustomerId, // Links to phone number ID
             order_amount: orderTotalValue
          }));

          if (isSupabaseConfigured()) {
            const { error } = await supabase.from('sales_records').insert(recordsToInsert);
            if (error) throw error;
          }

          // Optimistic Update
          const newRecordsLocal = recordsToInsert.map((r: any) => ({
             id: r.id,
             timestamp: r.timestamp,
             date: r.date,
             branchId: r.branch_id,
             platform: r.platform,
             skuId: r.sku_id,
             quantitySold: r.quantity_sold,
             customerId: r.customer_id,
             orderAmount: r.order_amount
          }));
          setSalesRecords(prev => [...prev, ...newRecordsLocal]);
          
        } catch (e) {
          console.error("Failed to process POS message", e);
        }
      }
    };
    window.addEventListener('message', handlePosMessage);
    return () => window.removeEventListener('message', handlePosMessage);
  }, [skus, menuItems, customers]); 

  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  // ... [Existing transaction methods remain the same] ...
  const addBatchTransactions = async (txs: Omit<Transaction, 'id' | 'timestamp' | 'batchId'>[]) => {
    if (txs.length === 0) return;
    const batchId = generateId();
    const timestamp = Date.now();

    const dbRows = txs.map(t => ({
      id: generateId(),
      batch_id: batchId,
      timestamp,
      date: t.date,
      branch_id: t.branchId,
      sku_id: t.skuId,
      type: t.type,
      quantity_pieces: t.quantityPieces,
      image_urls: t.imageUrls || [],
      user_id: t.userId,
      user_name: t.userName
    }));

    if (isSupabaseConfigured()) {
       const { error } = await supabase.from('transactions').insert(dbRows);
       if (error) console.error("Error adding transactions:", error);
    }
    
    const localTxs: Transaction[] = dbRows.map(r => ({
        id: r.id,
        batchId: r.batch_id,
        timestamp: r.timestamp,
        date: r.date,
        branchId: r.branch_id,
        skuId: r.sku_id,
        type: r.type as any,
        quantityPieces: r.quantity_pieces,
        imageUrls: r.image_urls,
        userId: r.user_id,
        userName: r.user_name
    }));
    setTransactions(prev => [...localTxs, ...prev]);
  };

  const deleteTransactionBatch = async (batchId: string, deletedBy: string) => {
    if (!batchId) return;
    const itemsToDelete = transactions.filter(t => t.batchId === batchId);
    if (itemsToDelete.length === 0) return;

    const deletedAt = new Date().toISOString();
    const archiveRows = itemsToDelete.map(t => ({
      id: t.id,
      batch_id: t.batchId,
      timestamp: t.timestamp,
      date: t.date,
      branch_id: t.branchId,
      sku_id: t.skuId,
      type: t.type,
      quantity_pieces: t.quantityPieces,
      image_urls: t.imageUrls || [],
      user_id: t.userId,
      user_name: t.userName,
      deleted_at: deletedAt,
      deleted_by: deletedBy
    }));

    const archivedItems: ArchivedTransaction[] = itemsToDelete.map(t => ({
       ...t,
       deletedAt,
       deletedBy
    }));
    
    setTransactions(prev => prev.filter(t => t.batchId !== batchId));
    setDeletedTransactions(prev => [...archivedItems, ...prev]);

    if (isSupabaseConfigured()) {
       const { error: insertError } = await supabase.from('deleted_transactions').insert(archiveRows);
       if (!insertError) {
          await supabase.from('transactions').delete().eq('batch_id', batchId);
       }
    }
  };

  const addSalesRecords = async (records: Omit<SalesRecord, 'id' | 'timestamp'>[]) => {
     if (records.length === 0) return;
     const timestamp = Date.now();
     
     const dbRows = records.map(r => ({
       id: generateId(),
       timestamp,
       date: r.date,
       branch_id: r.branchId,
       platform: r.platform,
       sku_id: r.skuId,
       quantity_sold: r.quantitySold,
       customer_id: r.customerId,
       order_amount: r.orderAmount
     }));

     if (isSupabaseConfigured()) {
        const { error } = await supabase.from('sales_records').insert(dbRows);
        if (error) console.error("Error adding sales records:", error);
     }

     const localRecords: SalesRecord[] = dbRows.map(r => ({
         id: r.id,
         timestamp: r.timestamp,
         date: r.date,
         branchId: r.branch_id,
         platform: r.platform as any,
         skuId: r.sku_id,
         quantitySold: r.quantity_sold,
         customerId: r.customer_id,
         orderAmount: r.order_amount
     }));
     setSalesRecords(prev => [...prev, ...localRecords]);
  };

  const deleteSalesRecordsForDate = async (date: string, branchId: string, platform?: string) => {
    if (isSupabaseConfigured()) {
        let query = supabase.from('sales_records').delete().eq('date', date).eq('branch_id', branchId);
        if (platform) {
            query = query.eq('platform', platform);
        }
        await query;
    }

    setSalesRecords(prev => prev.filter(r => {
        if (r.date !== date || r.branchId !== branchId) return true;
        if (platform && r.platform !== platform) return true;
        return false;
    }));
  };

  const addSku = async (skuData: Omit<SKU, 'id' | 'order'>) => {
    const newSku = {
      id: `sku-${Date.now()}`,
      ...skuData,
      order: skus.length,
    };
    
    if (isSupabaseConfigured()) {
        const dbRow = {
            id: newSku.id,
            name: newSku.name,
            category: newSku.category,
            dietary: newSku.dietary,
            pieces_per_packet: newSku.piecesPerPacket,
            order: newSku.order
        };
        await supabase.from('skus').insert(dbRow);
    }

    setSkus(prev => [...prev, newSku as SKU]);
  };

  const updateSku = async (updatedSku: SKU) => {
    if (isSupabaseConfigured()) {
        const dbRow = {
            name: updatedSku.name,
            category: updatedSku.category,
            dietary: updatedSku.dietary,
            pieces_per_packet: updatedSku.piecesPerPacket,
            order: updatedSku.order
        };
        await supabase.from('skus').update(dbRow).eq('id', updatedSku.id);
    }
    setSkus(prev => prev.map(s => s.id === updatedSku.id ? updatedSku : s));
  };

  const deleteSku = async (id: string) => {
    if (isSupabaseConfigured()) {
        await supabase.from('skus').delete().eq('id', id);
    }
    setSkus(prev => prev.filter(s => s.id !== id));
  };

  const reorderSku = async (id: string, direction: 'up' | 'down') => {
    const index = skus.findIndex(s => s.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === skus.length - 1) return;

    const newSkus = [...skus];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSkus[index], newSkus[targetIndex]] = [newSkus[targetIndex], newSkus[index]];
    
    const reordered = newSkus.map((s, idx) => ({ ...s, order: idx }));
    setSkus(reordered);

    if (isSupabaseConfigured()) {
        for (const s of reordered) {
            await supabase.from('skus').update({ order: s.order }).eq('id', s.id);
        }
    }
  };

  // --- Menu Item CRUD ---
  
  const addMenuItem = async (itemData: Omit<MenuItem, 'id'> & { id?: string }) => {
    const newItem = {
      id: itemData.id || `menu-${Date.now()}`,
      ...itemData
    };
    if (isSupabaseConfigured()) {
       await supabase.from('menu_items').insert({
          id: newItem.id,
          name: newItem.name,
          price: newItem.price,
          description: newItem.description,
          ingredients: newItem.ingredients // Supabase handles JSONB
       });
    }
    setMenuItems(prev => [...prev, newItem]);
  };

  const updateMenuItem = async (updated: MenuItem) => {
    if (isSupabaseConfigured()) {
       await supabase.from('menu_items').update({
          name: updated.name,
          price: updated.price,
          description: updated.description,
          ingredients: updated.ingredients
       }).eq('id', updated.id);
    }
    setMenuItems(prev => prev.map(m => m.id === updated.id ? updated : m));
  };

  const deleteMenuItem = async (id: string) => {
    if (isSupabaseConfigured()) {
       await supabase.from('menu_items').delete().eq('id', id);
    }
    setMenuItems(prev => prev.filter(m => m.id !== id));
  };

  const addBranch = async (branchData: Omit<Branch, 'id'>) => {
    const newBranch = {
      id: `branch-${Date.now()}`,
      ...branchData
    };

    if (isSupabaseConfigured()) {
        await supabase.from('branches').insert(newBranch);
    }
    setBranches(prev => [...prev, newBranch]);
  };

  const updateBranch = async (updatedBranch: Branch) => {
    if (isSupabaseConfigured()) {
        await supabase.from('branches').update({ name: updatedBranch.name }).eq('id', updatedBranch.id);
    }
    setBranches(prev => prev.map(b => b.id === updatedBranch.id ? updatedBranch : b));
  };

  const deleteBranch = async (id: string) => {
    if (isSupabaseConfigured()) {
        await supabase.from('branches').delete().eq('id', id);
    }
    setBranches(prev => prev.filter(b => b.id !== id));
  };

  // --- Customer & Membership CRUD ---

  const addCustomer = async (customerData: Omit<Customer, 'id' | 'joinedAt' | 'totalSpend' | 'orderCount' | 'lastOrderDate'>) => {
     // Explicitly use phone number as ID if creating manually
     const phoneId = customerData.phoneNumber.trim();

     const newCustomer: Customer = {
        id: phoneId,
        ...customerData,
        joinedAt: new Date().toISOString(),
        totalSpend: 0,
        orderCount: 0,
        lastOrderDate: '-'
     };

     if (isSupabaseConfigured()) {
        await supabase.from('customers').insert({
            id: newCustomer.id,
            name: newCustomer.name,
            phone_number: newCustomer.phoneNumber,
            total_spend: 0,
            order_count: 0,
            joined_at: newCustomer.joinedAt,
            last_order_date: null
        });
     }
     setCustomers(prev => [...prev, newCustomer]);
  };

  const updateCustomer = async (updated: Customer) => {
     if (isSupabaseConfigured()) {
        await supabase.from('customers').update({
            name: updated.name,
            phone_number: updated.phoneNumber,
            total_spend: updated.totalSpend,
            order_count: updated.orderCount,
            last_order_date: updated.lastOrderDate === '-' ? null : updated.lastOrderDate
        }).eq('id', updated.id);
     }
     setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const addMembershipRule = async (rule: Omit<MembershipRule, 'id'>) => {
     const newRule: MembershipRule = {
        id: `rule-${Date.now()}`,
        ...rule
     };
     if (isSupabaseConfigured()) {
        await supabase.from('membership_rules').insert({
           id: newRule.id,
           trigger_order_count: newRule.triggerOrderCount,
           type: newRule.type,
           value: newRule.value,
           description: newRule.description,
           time_frame_days: newRule.timeFrameDays
        });
     }
     setMembershipRules(prev => [...prev, newRule]);
  };

  const deleteMembershipRule = async (id: string) => {
     if (isSupabaseConfigured()) {
        await supabase.from('membership_rules').delete().eq('id', id);
     }
     setMembershipRules(prev => prev.filter(r => r.id !== id));
  };

  // --- Attendance ---
  const addAttendance = async (record: Omit<AttendanceRecord, 'id'>) => {
      const newRecord: AttendanceRecord = {
          id: generateId(),
          ...record
      };

      if (isSupabaseConfigured()) {
          const { error } = await supabase.from('attendance').insert({
             id: newRecord.id,
             user_id: newRecord.userId,
             user_name: newRecord.userName,
             branch_id: newRecord.branchId,
             date: newRecord.date,
             timestamp: newRecord.timestamp,
             image_url: newRecord.imageUrl
          });
          if (error) console.error("Error adding attendance", error);
      }
      setAttendanceRecords(prev => [newRecord, ...prev]);
  };

  const resetData = async () => {
    if (isSupabaseConfigured()) {
        await supabase.from('transactions').delete().neq('id', '0');
        await supabase.from('sales_records').delete().neq('id', '0');
        await supabase.from('skus').delete().neq('id', '0');
        await supabase.from('menu_items').delete().neq('id', '0');
        await supabase.from('branches').delete().neq('id', '0');
        await supabase.from('deleted_transactions').delete().neq('id', '0');
        await supabase.from('customers').delete().neq('id', '0');
        await supabase.from('membership_rules').delete().neq('id', '0');
        await supabase.from('attendance').delete().neq('id', '0');
    }
    setTransactions([]);
    setSalesRecords([]);
    setSkus([]);
    setMenuItems([]);
    setBranches([]);
    setDeletedTransactions([]);
    setCustomers([]);
    setMembershipRules([]);
    setAttendanceRecords([]);
  };

  return (
    <StoreContext.Provider value={{ 
      skus, menuItems, branches, transactions, salesRecords, deletedTransactions, customers, membershipRules, attendanceRecords,
      addBatchTransactions, deleteTransactionBatch, addSalesRecords, deleteSalesRecordsForDate, 
      addSku, updateSku, deleteSku, reorderSku, addMenuItem, updateMenuItem, deleteMenuItem, 
      addBranch, updateBranch, deleteBranch,
      addCustomer, updateCustomer, addMembershipRule, deleteMembershipRule, addAttendance, resetData 
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
