
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { SKU, Branch, Transaction, SalesRecord, ArchivedTransaction, Customer, MembershipRule, MenuItem, AttendanceRecord, Order, OrderItem, MenuCategory } from '../types';
import { INITIAL_BRANCHES, INITIAL_SKUS, INITIAL_CUSTOMERS, INITIAL_MEMBERSHIP_RULES, INITIAL_MENU_ITEMS, INITIAL_MENU_CATEGORIES } from '../constants';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

interface StoreContextType {
  skus: SKU[];
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
  branches: Branch[];
  transactions: Transaction[];
  salesRecords: SalesRecord[]; // Now derived from Orders
  orders: Order[]; 
  customers: Customer[];
  membershipRules: MembershipRule[];
  deletedTransactions: ArchivedTransaction[];
  attendanceRecords: AttendanceRecord[];
  
  addBatchTransactions: (txs: Omit<Transaction, 'id' | 'timestamp' | 'batchId'>[]) => Promise<void>;
  deleteTransactionBatch: (batchId: string, deletedBy: string) => Promise<void>;
  
  // Sales & Orders
  addSalesRecords: (records: Omit<SalesRecord, 'id' | 'timestamp'>[]) => Promise<void>; // Kept for manual reconciliation
  addOrder: (orderData: Omit<Order, 'id' | 'timestamp'>) => Promise<void>; 
  deleteOrder: (orderId: string) => Promise<void>;
  deleteSalesRecordsForDate: (date: string, branchId: string, platform?: string) => Promise<void>;
  
  addSku: (sku: Omit<SKU, 'id' | 'order'>) => Promise<void>;
  updateSku: (sku: SKU) => Promise<void>;
  deleteSku: (id: string) => Promise<void>;
  reorderSku: (id: string, direction: 'up' | 'down') => Promise<void>;

  addMenuItem: (item: Omit<MenuItem, 'id'> & { id?: string }) => Promise<void>;
  updateMenuItem: (item: MenuItem) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
  
  // Menu Categories
  addMenuCategory: (category: Omit<MenuCategory, 'id'>) => Promise<void>;
  updateMenuCategory: (category: MenuCategory, oldName: string) => Promise<void>;
  deleteMenuCategory: (id: string, name: string) => Promise<void>;
  reorderMenuCategory: (id: string, direction: 'up' | 'down') => Promise<void>;

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
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [deletedTransactions, setDeletedTransactions] = useState<ArchivedTransaction[]>([]);
  
  // salesRecords is now split:
  // 1. manualSalesRecords: For legacy support or direct manual entry in Reconciliation page (rare)
  // 2. derivedSalesRecords: Automatically calculated from Orders (The main source)
  const [manualSalesRecords, setManualSalesRecords] = useState<SalesRecord[]>([]); 
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [membershipRules, setMembershipRules] = useState<MembershipRule[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // Derived State: Flatten Orders into Sales Records for Inventory Reports
  const salesRecords = useMemo(() => {
     // 1. Convert Orders to Sales Records
     const derived = orders.flatMap(order => {
        // Safe check for items array
        const safeItems = order.items || [];
        
        // A. Process Menu Items
        const itemRecords = safeItems.flatMap(item => {
           // If the item has a 'consumed' snapshot, use that (Inventory View)
           if (item.consumed && item.consumed.length > 0) {
              return item.consumed.map(c => ({
                 id: `${order.id}-${item.id}-${c.skuId}`, // Virtual ID
                 orderId: order.id,
                 date: order.date,
                 branchId: order.branchId,
                 platform: order.platform,
                 skuId: c.skuId,
                 quantitySold: c.quantity, // This is already total for the line item
                 customerId: order.customerId,
                 timestamp: order.timestamp,
                 orderAmount: 0 // Not relevant for inventory view
              }));
           } 
           // Fallback: If no consumption snapshot, maybe it's a direct SKU mapping?
           else {
             const potentialSku = skus.find(s => s.id === item.menuItemId);
             
             if (potentialSku) {
                return [{
                    id: `${order.id}-${item.id}`,
                    orderId: order.id,
                    date: order.date,
                    branchId: order.branchId,
                    platform: order.platform,
                    skuId: item.menuItemId, 
                    quantitySold: item.quantity,
                    customerId: order.customerId,
                    timestamp: order.timestamp,
                    orderAmount: item.price * item.quantity
                }];
             }
             return [];
           }
        });

        // B. Process Custom SKUs (Multiple)
        const customRecords: SalesRecord[] = [];
        if (order.customSkuItems && order.customSkuItems.length > 0) {
            order.customSkuItems.forEach((item, index) => {
                 customRecords.push({
                    id: `${order.id}-custom-sku-${index}`,
                    orderId: order.id,
                    date: order.date,
                    branchId: order.branchId,
                    platform: order.platform,
                    skuId: item.skuId,
                    quantitySold: item.quantity,
                    customerId: order.customerId,
                    timestamp: order.timestamp,
                    orderAmount: 0 // Custom SKUs have no price in the new model (billed via customAmount if needed)
                });
            });
        }
        // Legacy Support for old orders that might have singular fields (should be handled by fetching logic, but safety first)
        else if ((order as any).customSkuId && (order as any).customSkuQuantity) {
             customRecords.push({
                id: `${order.id}-custom-sku-legacy`,
                orderId: order.id,
                date: order.date,
                branchId: order.branchId,
                platform: order.platform,
                skuId: (order as any).customSkuId,
                quantitySold: (order as any).customSkuQuantity,
                customerId: order.customerId,
                timestamp: order.timestamp,
                orderAmount: 0
            });
        }

        return [...itemRecords, ...customRecords];
     });
     
     // 2. Combine with any manually entered records (from Reconciliation page)
     return [...derived, ...manualSalesRecords];
  }, [orders, manualSalesRecords, skus]);

  // --- Fetch Initial Data from Supabase ---
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!isSupabaseConfigured()) {
        // Fallback to initial constants if no DB
        if (skus.length === 0) setSkus(INITIAL_SKUS);
        if (menuItems.length === 0) setMenuItems(INITIAL_MENU_ITEMS);
        if (menuCategories.length === 0) setMenuCategories(INITIAL_MENU_CATEGORIES);
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
            ingredients: m.ingredients || [],
            halfIngredients: m.half_ingredients || [], // New: Explicit Half Plate Recipe
            halfPrice: m.half_price,
            category: m.category || 'Uncategorized' // Map Category
        }));
        setMenuItems(mappedMenu);
      } else {
        setMenuItems(INITIAL_MENU_ITEMS);
      }

      // 2b. Fetch Menu Categories (If table exists, otherwise fallback or empty)
      const { data: catData, error: catError } = await supabase.from('menu_categories').select('*').order('order', { ascending: true });
      if (catData && catData.length > 0) {
         setMenuCategories(catData);
      } else {
         // If no categories in DB, check if we have menu items with categories and seed?
         // For now, just use initial constants if empty
         if(menuItems.length === 0) {
            setMenuCategories(INITIAL_MENU_CATEGORIES);
         } else {
            // Extract from existing items if not present in DB
            const existingCats = new Set(menuItems.map(m => m.category || 'Uncategorized'));
            const derivedCats = Array.from(existingCats).map((name, idx) => ({
               id: `cat-${idx}`,
               name,
               order: idx,
               color: '#64748b'
            }));
            setMenuCategories(derivedCats);
         }
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

      // 6. Fetch Manual Sales Records (Re-enabled for manual entry persistence)
      const { data: manualData, error: manualError } = await supabase
        .from('sales_records')
        .select('*');
      
      if (manualData) {
         const mappedManual = manualData.map((r: any) => ({
             id: r.id,
             orderId: r.order_id,
             date: r.date,
             branchId: r.branch_id,
             platform: r.platform,
             skuId: r.sku_id,
             quantitySold: r.quantity_sold,
             timestamp: r.timestamp,
             customerId: r.customer_id,
             orderAmount: r.order_amount
         }));
         setManualSalesRecords(mappedManual);
      }

      // 7. Fetch Orders (Primary Source of Truth)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('timestamp', { ascending: false });
      
      if (!ordersError && ordersData) {
         const mappedOrders = ordersData.map((o: any) => ({
             id: o.id,
             branchId: o.branch_id,
             customerId: o.customer_id,
             customerName: o.customer_name,
             platform: o.platform,
             totalAmount: o.total_amount,
             status: o.status,
             paymentMethod: o.payment_method || 'CASH', // Fallback
             date: o.date,
             timestamp: o.timestamp,
             items: o.items || [], // Ensure array
             // New Fields
             customAmount: o.custom_amount,
             customAmountReason: o.custom_amount_reason,
             // Map new custom_sku_items, fallback to legacy fields if needed
             customSkuItems: o.custom_sku_items || (o.custom_sku_id ? [{ skuId: o.custom_sku_id, quantity: o.custom_sku_quantity }] : []),
             customSkuReason: o.custom_sku_reason
         }));
         setOrders(mappedOrders);
      }

      // 8. Fetch Customers
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

      // 9. Fetch Membership Rules
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

      // 10. Fetch Attendance
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

  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  // ... [Existing transaction methods] ...
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

  // --- ORDER & SALES LOGIC ---

  // 1. Manual Sales Records (Legacy / Reconciliation Page only)
  const addSalesRecords = async (records: Omit<SalesRecord, 'id' | 'timestamp'>[]) => {
     if (records.length === 0) return;
     const timestamp = Date.now();
     
     const localRecords: SalesRecord[] = records.map(r => ({
         id: generateId(),
         orderId: r.orderId,
         timestamp,
         date: r.date,
         branchId: r.branchId,
         platform: r.platform as any,
         skuId: r.skuId,
         quantitySold: r.quantitySold,
         customerId: r.customerId,
         orderAmount: r.orderAmount
     }));
     
     setManualSalesRecords(prev => [...prev, ...localRecords]);

     // Persist to Supabase
     if (isSupabaseConfigured()) {
        const dbRows = localRecords.map(r => ({
            id: r.id,
            order_id: r.orderId,
            date: r.date,
            branch_id: r.branchId,
            platform: r.platform,
            sku_id: r.skuId,
            quantity_sold: r.quantitySold,
            timestamp: r.timestamp,
            customer_id: r.customerId,
            order_amount: r.orderAmount
        }));
        const { error } = await supabase.from('sales_records').insert(dbRows);
        if (error) console.error("Error saving sales records", error);
    }
  };

  // 2. High-level function to Create an Order (Single Source of Truth)
  const addOrder = async (orderData: Omit<Order, 'id' | 'timestamp'>) => {
      const timestamp = Date.now();
      const orderId = generateId();

      // A. Calculate Snapshots (Ingredients Used for Standard Items)
      const itemsWithSnapshot: OrderItem[] = orderData.items.map(item => {
         // Standard Menu Item
         const menuItem = menuItems.find(m => m.id === item.menuItemId);
         
         let consumedSnapshot: { skuId: string; quantity: number }[] = [];
         
         if (menuItem) {
             if (item.variant === 'HALF') {
                 // Priority 1: Explicit Half Recipe
                 if (menuItem.halfIngredients && menuItem.halfIngredients.length > 0) {
                     consumedSnapshot = menuItem.halfIngredients.map(ing => ({
                         skuId: ing.skuId,
                         quantity: ing.quantity * item.quantity 
                     }));
                 } 
                 // Priority 2: Fallback to 0.5 * Full Recipe
                 else if (menuItem.ingredients && menuItem.ingredients.length > 0) {
                     consumedSnapshot = menuItem.ingredients.map(ing => ({
                         skuId: ing.skuId,
                         quantity: ing.quantity * item.quantity * 0.5
                     }));
                 }
             } else {
                 // Full Plate Logic
                 if (menuItem.ingredients && menuItem.ingredients.length > 0) {
                     consumedSnapshot = menuItem.ingredients.map(ing => ({
                         skuId: ing.skuId,
                         quantity: ing.quantity * item.quantity
                     }));
                 }
             }
         } else {
             // Fallback for direct SKU items (legacy / direct match)
             const matchingSku = skus.find(s => s.id === item.menuItemId);
             if (matchingSku) {
                 consumedSnapshot = [{ skuId: matchingSku.id, quantity: item.quantity }];
             }
         }

         return {
             ...item,
             consumed: consumedSnapshot // Save the calculated ingredients permanently
         };
      });

      // B. Create Order Object
      // Total Calculation: Items Total + Custom Amount
      const itemsTotal = orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const customTotal = orderData.customAmount || 0;
      
      const newOrder: Order = {
          id: orderId,
          timestamp,
          ...orderData,
          items: itemsWithSnapshot,
          totalAmount: orderData.totalAmount || (itemsTotal + customTotal)
      };

      // C. Handle Customer (Update/Create Logic)
      if (newOrder.customerId) {
          // Check if existing
          const existingCust = customers.find(c => c.id === newOrder.customerId);
          if (existingCust) {
              const updatedCust = {
                  ...existingCust,
                  totalSpend: existingCust.totalSpend + newOrder.totalAmount,
                  orderCount: existingCust.orderCount + 1,
                  lastOrderDate: newOrder.date,
                  name: newOrder.customerName || existingCust.name 
              };
              await updateCustomer(updatedCust);
          } else {
              // Create New
              const newCust: Customer = {
                  id: newOrder.customerId, // Phone is ID
                  name: newOrder.customerName || 'Unknown',
                  phoneNumber: newOrder.customerId,
                  totalSpend: newOrder.totalAmount,
                  orderCount: 1,
                  joinedAt: new Date().toISOString(),
                  lastOrderDate: newOrder.date
              };
              if (isSupabaseConfigured()) {
                  await supabase.from('customers').insert({
                     id: newCust.id,
                     name: newCust.name,
                     phone_number: newCust.phoneNumber,
                     total_spend: newCust.totalSpend,
                     order_count: newCust.orderCount,
                     joined_at: newCust.joinedAt,
                     last_order_date: newCust.lastOrderDate
                  });
              }
              setCustomers(prev => [...prev, newCust]);
          }
      }

      // D. Save to Supabase
      if (isSupabaseConfigured()) {
          const { error } = await supabase.from('orders').insert({
              id: newOrder.id,
              branch_id: newOrder.branchId,
              customer_id: newOrder.customerId,
              customer_name: newOrder.customerName,
              platform: newOrder.platform,
              total_amount: newOrder.totalAmount,
              status: newOrder.status,
              payment_method: newOrder.paymentMethod,
              date: newOrder.date,
              timestamp: newOrder.timestamp,
              items: newOrder.items,
              // New Fields
              custom_amount: newOrder.customAmount,
              custom_amount_reason: newOrder.customAmountReason,
              custom_sku_items: newOrder.customSkuItems, // Saved as JSONB array
              custom_sku_reason: newOrder.customSkuReason
          });
          if (error) console.error("Error creating order:", error);
      }
      setOrders(prev => [newOrder, ...prev]);
  };

  const deleteOrder = async (orderId: string) => {
    const orderToDelete = orders.find(o => o.id === orderId);
    if (!orderToDelete) return;

    // 1. Revert Customer Stats (If applicable)
    if (orderToDelete.customerId) {
       const customer = customers.find(c => c.id === orderToDelete.customerId);
       if (customer) {
           // Calculate new stats based on remaining orders
           const remainingOrders = orders.filter(o => o.customerId === orderToDelete.customerId && o.id !== orderId);
           
           // Sort by timestamp desc to find the new lastOrderDate
           remainingOrders.sort((a,b) => b.timestamp - a.timestamp);
           const newLastOrderDate = remainingOrders.length > 0 ? remainingOrders[0].date : '-';
           
           const updatedCust = {
               ...customer,
               totalSpend: Math.max(0, customer.totalSpend - orderToDelete.totalAmount),
               orderCount: Math.max(0, customer.orderCount - 1),
               lastOrderDate: newLastOrderDate
           };
           await updateCustomer(updatedCust);
       }
    }

    // 2. Remove from Supabase
    if (isSupabaseConfigured()) {
       await supabase.from('orders').delete().eq('id', orderId);
    }

    // 3. Remove from Local State
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  // --- POS LISTENER (Legacy / External Bridge) ---
  useEffect(() => {
    const handlePosMessage = async (event: MessageEvent) => {
      if (event.data && event.data.type === 'PAKAJA_IMPORT_SALES' && event.data.payload) {
        try {
          const { date, items, platform, branchId, timestamp, customer } = event.data.payload;
          
          if (!date || !Array.isArray(items) || !platform || !branchId) return;
          if (!['POS', 'ZOMATO', 'SWIGGY'].includes(platform)) return;

          // Transform external items format to internal OrderItem format
          const orderItems: OrderItem[] = items.map((i: any) => {
             const menuItem = menuItems.find(m => m.id === i.skuId);
             return {
                 id: generateId(),
                 menuItemId: i.skuId,
                 name: menuItem ? menuItem.name : 'External Item',
                 price: menuItem ? menuItem.price : 0,
                 quantity: Number(i.quantity),
                 variant: 'FULL'
             };
          });

          // Calculate total from system prices
          const totalAmount = orderItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

          await addOrder({
             branchId,
             date,
             platform,
             totalAmount,
             status: 'COMPLETED',
             paymentMethod: 'CASH', // Assumption for external
             items: orderItems,
             customerId: customer?.phoneNumber, // Link via phone
             customerName: customer?.name
          });
          
        } catch (e) {
          console.error("Failed to process POS message", e);
        }
      }
    };
    window.addEventListener('message', handlePosMessage);
    return () => window.removeEventListener('message', handlePosMessage);
  }, [menuItems, customers, addOrder]); 


  const deleteSalesRecordsForDate = async (date: string, branchId: string, platform?: string) => {
    // Only delete from manual records since others are derived from orders
    setManualSalesRecords(prev => prev.filter(r => {
        if (r.date !== date || r.branchId !== branchId) return true;
        if (platform && r.platform !== platform) return true;
        return false;
    }));

    if (isSupabaseConfigured()) {
       let query = supabase.from('sales_records').delete().eq('date', date).eq('branch_id', branchId);
       if (platform) {
          query = query.eq('platform', platform);
       }
       await query;
    }
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

  // --- Menu Category CRUD ---
  const addMenuCategory = async (categoryData: Omit<MenuCategory, 'id'>) => {
      const newCategory = {
         id: `cat-${Date.now()}`,
         ...categoryData,
         color: categoryData.color || '#64748b'
      };
      if (isSupabaseConfigured()) {
         await supabase.from('menu_categories').insert({
             id: newCategory.id,
             name: newCategory.name,
             order: newCategory.order,
             color: newCategory.color
         });
      }
      setMenuCategories(prev => [...prev, newCategory]);
  };

  const updateMenuCategory = async (updated: MenuCategory, oldName: string) => {
      // 1. Update Category Name
      if (isSupabaseConfigured()) {
          await supabase.from('menu_categories').update({
             name: updated.name,
             order: updated.order,
             color: updated.color
          }).eq('id', updated.id);
      }
      setMenuCategories(prev => prev.map(c => c.id === updated.id ? updated : c));

      // 2. Cascade Update to Menu Items (if name changed)
      if (oldName !== updated.name) {
         // Update Local
         setMenuItems(prev => prev.map(m => m.category === oldName ? { ...m, category: updated.name } : m));
         // Update DB
         if (isSupabaseConfigured()) {
             await supabase.from('menu_items').update({ category: updated.name }).eq('category', oldName);
         }
      }
  };

  const deleteMenuCategory = async (id: string, name: string) => {
      // 1. Delete Category
      if (isSupabaseConfigured()) {
          await supabase.from('menu_categories').delete().eq('id', id);
      }
      setMenuCategories(prev => prev.filter(c => c.id !== id));

      // 2. Set associated Menu Items to "Uncategorized"
      setMenuItems(prev => prev.map(m => m.category === name ? { ...m, category: 'Uncategorized' } : m));
      if (isSupabaseConfigured()) {
          await supabase.from('menu_items').update({ category: 'Uncategorized' }).eq('category', name);
      }
  };

  const reorderMenuCategory = async (id: string, direction: 'up' | 'down') => {
      const index = menuCategories.findIndex(c => c.id === id);
      if (index === -1) return;
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === menuCategories.length - 1) return;

      const newCats = [...menuCategories];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newCats[index], newCats[targetIndex]] = [newCats[targetIndex], newCats[index]];

      const reordered = newCats.map((c, idx) => ({ ...c, order: idx }));
      setMenuCategories(reordered);

      if (isSupabaseConfigured()) {
          for (const c of reordered) {
             await supabase.from('menu_categories').update({ order: c.order }).eq('id', c.id);
          }
      }
  };

  // --- Menu Item CRUD ---
  
  const addMenuItem = async (itemData: Omit<MenuItem, 'id'> & { id?: string }) => {
    const newItem = {
      id: itemData.id || `menu-${Date.now()}`,
      ...itemData,
      category: itemData.category || 'Uncategorized'
    };
    if (isSupabaseConfigured()) {
       await supabase.from('menu_items').insert({
          id: newItem.id,
          name: newItem.name,
          price: newItem.price,
          half_price: newItem.halfPrice,
          description: newItem.description,
          category: newItem.category, // Save Category
          ingredients: newItem.ingredients,
          half_ingredients: newItem.halfIngredients
       });
    }
    setMenuItems(prev => [...prev, newItem]);
  };

  const updateMenuItem = async (updated: MenuItem) => {
    if (isSupabaseConfigured()) {
       await supabase.from('menu_items').update({
          name: updated.name,
          price: updated.price,
          half_price: updated.halfPrice,
          description: updated.description,
          category: updated.category, // Update Category
          ingredients: updated.ingredients,
          half_ingredients: updated.halfIngredients
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
        await supabase.from('sales_records').delete().neq('id', '0'); // Restored
        await supabase.from('orders').delete().neq('id', '0'); // Reset orders
        await supabase.from('skus').delete().neq('id', '0');
        await supabase.from('menu_items').delete().neq('id', '0');
        await supabase.from('menu_categories').delete().neq('id', '0');
        await supabase.from('branches').delete().neq('id', '0');
        await supabase.from('deleted_transactions').delete().neq('id', '0');
        await supabase.from('customers').delete().neq('id', '0');
        await supabase.from('membership_rules').delete().neq('id', '0');
        await supabase.from('attendance').delete().neq('id', '0');
    }
    setTransactions([]);
    setManualSalesRecords([]);
    setOrders([]);
    setSkus([]);
    setMenuItems([]);
    setMenuCategories([]);
    setBranches([]);
    setDeletedTransactions([]);
    setCustomers([]);
    setMembershipRules([]);
    setAttendanceRecords([]);
  };

  return (
    <StoreContext.Provider value={{ 
      skus, menuItems, menuCategories, branches, transactions, salesRecords, orders, deletedTransactions, customers, membershipRules, attendanceRecords,
      addBatchTransactions, deleteTransactionBatch, addSalesRecords, addOrder, deleteOrder, deleteSalesRecordsForDate, 
      addSku, updateSku, deleteSku, reorderSku, addMenuItem, updateMenuItem, deleteMenuItem, 
      addMenuCategory, updateMenuCategory, deleteMenuCategory, reorderMenuCategory,
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
