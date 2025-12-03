import React, { createContext, useContext, useState, useEffect } from 'react';
import { SKU, Branch, Transaction, SalesRecord } from '../types';
import { INITIAL_BRANCHES, INITIAL_SKUS } from '../constants';
import { supabase } from '../services/supabaseClient';

interface StoreContextType {
  skus: SKU[];
  branches: Branch[];
  transactions: Transaction[];
  salesRecords: SalesRecord[];
  addBatchTransactions: (txs: Omit<Transaction, 'id' | 'timestamp' | 'batchId'>[]) => Promise<void>;
  addSalesRecords: (records: Omit<SalesRecord, 'id' | 'timestamp'>[]) => Promise<void>;
  deleteSalesRecordsForDate: (date: string, branchId: string, platform?: string) => Promise<void>;
  addSku: (sku: Omit<SKU, 'id' | 'order'>) => Promise<void>;
  updateSku: (sku: SKU) => Promise<void>;
  deleteSku: (id: string) => Promise<void>;
  reorderSku: (id: string, direction: 'up' | 'down') => Promise<void>;
  addBranch: (branch: Omit<Branch, 'id'>) => Promise<void>;
  updateBranch: (branch: Branch) => Promise<void>;
  deleteBranch: (id: string) => Promise<void>;
  resetData: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [skus, setSkus] = useState<SKU[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);

  // --- Fetch Initial Data from Supabase ---
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 1. Fetch SKUs
      const { data: skusData, error: skuError } = await supabase
        .from('skus')
        .select('*')
        .order('order', { ascending: true });
      
      if (skuError) throw skuError;
      if (skusData && skusData.length > 0) {
        // Map DB snake_case to TS camelCase if necessary (Supabase returns object keys as in DB)
        // Since we created DB columns matching our need (but snake_case), we map:
        const mappedSkus = skusData.map((s: any) => ({
          ...s,
          piecesPerPacket: s.pieces_per_packet
        }));
        setSkus(mappedSkus);
      } else {
        // If empty DB, seed initial data? Or just leave empty. 
        // For migration, we might want to manually seed or keep empty.
        // setSkus(INITIAL_SKUS); 
      }

      // 2. Fetch Branches
      const { data: branchData, error: branchError } = await supabase.from('branches').select('*');
      if (branchError) throw branchError;
      if (branchData) setBranches(branchData);

      // 3. Fetch Transactions (Last 30 days to keep it light? Or all for now)
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

      // 4. Fetch Sales Records
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
          quantitySold: s.quantity_sold
        }));
        setSalesRecords(mappedSales);
      }

    } catch (error) {
      console.error("Error fetching data from Supabase:", error);
    }
  };

  // --- POS LISTENER (Keep logic but save to DB) ---
  useEffect(() => {
    const handlePosMessage = async (event: MessageEvent) => {
      if (event.data && event.data.type === 'PAKAJA_IMPORT_SALES' && event.data.payload) {
        try {
          const { date, items, platform, branchId, timestamp } = event.data.payload;
          
          if (!date || !Array.isArray(items) || !platform || !branchId) return;
          if (!['POS', 'ZOMATO', 'SWIGGY'].includes(platform)) return;

          const batchTimestamp = timestamp || Date.now();
          const recordsToInsert = items.map((item: any) => ({
             id: generateId(),
             timestamp: batchTimestamp,
             date,
             branch_id: branchId,
             platform,
             sku_id: item.skuId,
             quantity_sold: Number(item.quantity)
          }));

          const { error } = await supabase.from('sales_records').insert(recordsToInsert);
          if (error) throw error;

          // Optimistic Update
          const newRecordsLocal = recordsToInsert.map((r: any) => ({
             id: r.id,
             timestamp: r.timestamp,
             date: r.date,
             branchId: r.branch_id,
             platform: r.platform,
             skuId: r.sku_id,
             quantitySold: r.quantity_sold
          }));
          setSalesRecords(prev => [...prev, ...newRecordsLocal]);
          
        } catch (e) {
          console.error("Failed to process POS message", e);
        }
      }
    };
    window.addEventListener('message', handlePosMessage);
    return () => window.removeEventListener('message', handlePosMessage);
  }, []);

  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  const addBatchTransactions = async (txs: Omit<Transaction, 'id' | 'timestamp' | 'batchId'>[]) => {
    if (txs.length === 0) return;
    const batchId = generateId();
    const timestamp = Date.now();

    // Prepare for DB
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

    const { error } = await supabase.from('transactions').insert(dbRows);
    
    if (!error) {
        // Prepare for Local State
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
    } else {
        console.error("Error adding transactions:", error);
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
       quantity_sold: r.quantitySold
     }));

     const { error } = await supabase.from('sales_records').insert(dbRows);

     if (!error) {
         const localRecords: SalesRecord[] = dbRows.map(r => ({
             id: r.id,
             timestamp: r.timestamp,
             date: r.date,
             branchId: r.branch_id,
             platform: r.platform as any,
             skuId: r.sku_id,
             quantitySold: r.quantity_sold
         }));
         setSalesRecords(prev => [...prev, ...localRecords]);
     } else {
         console.error("Error adding sales records:", error);
     }
  };

  const deleteSalesRecordsForDate = async (date: string, branchId: string, platform?: string) => {
    let query = supabase.from('sales_records').delete().eq('date', date).eq('branch_id', branchId);
    if (platform) {
        query = query.eq('platform', platform);
    }
    
    const { error } = await query;
    if (!error) {
        setSalesRecords(prev => prev.filter(r => {
            if (r.date !== date || r.branchId !== branchId) return true;
            if (platform && r.platform !== platform) return true;
            return false;
        }));
    } else {
        console.error("Error deleting sales records", error);
    }
  };

  const addSku = async (skuData: Omit<SKU, 'id' | 'order'>) => {
    const newSku = {
      id: `sku-${Date.now()}`,
      ...skuData,
      order: skus.length,
    };
    
    const dbRow = {
        id: newSku.id,
        name: newSku.name,
        category: newSku.category,
        dietary: newSku.dietary,
        pieces_per_packet: newSku.piecesPerPacket,
        order: newSku.order
    };

    const { error } = await supabase.from('skus').insert(dbRow);
    if (!error) {
        setSkus(prev => [...prev, newSku as SKU]);
    }
  };

  const updateSku = async (updatedSku: SKU) => {
    const dbRow = {
        name: updatedSku.name,
        category: updatedSku.category,
        dietary: updatedSku.dietary,
        pieces_per_packet: updatedSku.piecesPerPacket,
        order: updatedSku.order
    };

    const { error } = await supabase.from('skus').update(dbRow).eq('id', updatedSku.id);
    if (!error) {
        setSkus(prev => prev.map(s => s.id === updatedSku.id ? updatedSku : s));
    }
  };

  const deleteSku = async (id: string) => {
    const { error } = await supabase.from('skus').delete().eq('id', id);
    if (!error) {
        setSkus(prev => prev.filter(s => s.id !== id));
    }
  };

  const reorderSku = async (id: string, direction: 'up' | 'down') => {
    // Optimistic update locally
    const index = skus.findIndex(s => s.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === skus.length - 1) return;

    const newSkus = [...skus];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSkus[index], newSkus[targetIndex]] = [newSkus[targetIndex], newSkus[index]];
    
    // Remap order
    const reordered = newSkus.map((s, idx) => ({ ...s, order: idx }));
    setSkus(reordered);

    // Update DB (Batch update not trivial in simple REST, doing loop for simplicity or RPC)
    // For now, looping updates. In production, use an RPC function.
    for (const s of reordered) {
       await supabase.from('skus').update({ order: s.order }).eq('id', s.id);
    }
  };

  const addBranch = async (branchData: Omit<Branch, 'id'>) => {
    const newBranch = {
      id: `branch-${Date.now()}`,
      ...branchData
    };

    const { error } = await supabase.from('branches').insert(newBranch);
    if (!error) {
        setBranches(prev => [...prev, newBranch]);
    }
  };

  const updateBranch = async (updatedBranch: Branch) => {
    const { error } = await supabase.from('branches').update({ name: updatedBranch.name }).eq('id', updatedBranch.id);
    if (!error) {
        setBranches(prev => prev.map(b => b.id === updatedBranch.id ? updatedBranch : b));
    }
  };

  const deleteBranch = async (id: string) => {
    const { error } = await supabase.from('branches').delete().eq('id', id);
    if (!error) {
        setBranches(prev => prev.filter(b => b.id !== id));
    }
  };

  const resetData = async () => {
    // DANGEROUS: Wipes DB
    await supabase.from('transactions').delete().neq('id', '0');
    await supabase.from('sales_records').delete().neq('id', '0');
    await supabase.from('skus').delete().neq('id', '0');
    await supabase.from('branches').delete().neq('id', '0');
    // Seed initial?
    setTransactions([]);
    setSalesRecords([]);
    setSkus([]);
    setBranches([]);
  };

  return (
    <StoreContext.Provider value={{ skus, branches, transactions, salesRecords, addBatchTransactions, addSalesRecords, deleteSalesRecordsForDate, addSku, updateSku, deleteSku, reorderSku, addBranch, updateBranch, deleteBranch, resetData }}>
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