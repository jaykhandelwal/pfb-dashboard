import React, { createContext, useContext, useState, useEffect } from 'react';
import { SKU, Branch, Transaction, SalesRecord } from '../types';
import { INITIAL_BRANCHES, INITIAL_SKUS } from '../constants';

interface StoreContextType {
  skus: SKU[];
  branches: Branch[];
  transactions: Transaction[];
  salesRecords: SalesRecord[];
  addBatchTransactions: (txs: Omit<Transaction, 'id' | 'timestamp' | 'batchId'>[]) => void;
  addSalesRecords: (records: Omit<SalesRecord, 'id' | 'timestamp'>[]) => void;
  deleteSalesRecordsForDate: (date: string, branchId: string, platform?: string) => void;
  addSku: (sku: Omit<SKU, 'id' | 'order'>) => void;
  updateSku: (sku: SKU) => void;
  deleteSku: (id: string) => void;
  reorderSku: (id: string, direction: 'up' | 'down') => void;
  addBranch: (branch: Omit<Branch, 'id'>) => void;
  updateBranch: (branch: Branch) => void;
  deleteBranch: (id: string) => void;
  resetData: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [skus, setSkus] = useState<SKU[]>(INITIAL_SKUS);
  const [branches, setBranches] = useState<Branch[]>(INITIAL_BRANCHES);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);

  // Load from local storage on mount
  useEffect(() => {
    const storedTx = localStorage.getItem('pakaja_transactions');
    if (storedTx) {
      try {
        const rawData = JSON.parse(storedTx);
        const cleanData = Array.isArray(rawData) ? rawData.map((t: any) => ({
          ...t,
          branchId: t.branchId || t.cartId
        })) : [];
        setTransactions(cleanData);
      } catch (e) {
        console.error("Failed to parse transactions", e);
      }
    }

    const storedSales = localStorage.getItem('pakaja_sales');
    if (storedSales) {
      try {
        const parsed = JSON.parse(storedSales);
        if (Array.isArray(parsed)) setSalesRecords(parsed);
      } catch (e) {
        console.error("Failed to parse sales records", e);
      }
    }
    
    const storedSkus = localStorage.getItem('pakaja_skus');
    if (storedSkus) {
      try {
        let parsedSkus = JSON.parse(storedSkus);
        if (Array.isArray(parsedSkus)) {
          parsedSkus = parsedSkus.map((s: any, idx: number) => ({
            ...s,
            order: typeof s.order === 'number' ? s.order : idx
          })).sort((a: any, b: any) => a.order - b.order);
          setSkus(parsedSkus);
        }
      } catch (e) {
        console.error("Failed to parse SKUs", e);
        setSkus(INITIAL_SKUS);
      }
    }

    const storedBranches = localStorage.getItem('pakaja_branches');
    if (storedBranches) {
      try {
        const parsedBranches = JSON.parse(storedBranches);
        if (Array.isArray(parsedBranches)) setBranches(parsedBranches);
      } catch (e) {
         console.error("Failed to parse Branches", e);
         setBranches(INITIAL_BRANCHES);
      }
    }
  }, []);

  // POS BRIDGE LISTENER
  useEffect(() => {
    const handlePosMessage = (event: MessageEvent) => {
      // Listen for PAKAJA_IMPORT_SALES
      if (event.data && event.data.type === 'PAKAJA_IMPORT_SALES' && event.data.payload) {
        try {
          const { date, items, platform, branchId, timestamp } = event.data.payload;
          
          if (!date || !Array.isArray(items) || !platform || !branchId) {
            console.warn("Invalid sales import payload");
            return;
          }
          
          // STRICT VALIDATION: Only allow supported platforms
          if (!['POS', 'ZOMATO', 'SWIGGY'].includes(platform)) {
              console.warn("Invalid platform. Must be POS, ZOMATO, or SWIGGY");
              return;
          }

          // Use provided timestamp or fallback to now. 
          // Providing timestamp allows syncing historical orders accurately.
          const batchTimestamp = timestamp || Date.now();

          // Create new record objects
          const newRecords: SalesRecord[] = items.map((item: any) => ({
             id: `auto-${batchTimestamp}-${Math.random().toString(36).substr(2, 9)}`,
             timestamp: batchTimestamp,
             date,
             branchId,
             platform, // TypeScript now guarantees this is valid via strict check above
             skuId: item.skuId,
             quantitySold: Number(item.quantity)
          }));

          setSalesRecords(prev => {
             // Append new records.
             return [...prev, ...newRecords];
          });
          
          console.log(`Successfully imported ${newRecords.length} sales records from ${platform}`);

        } catch (e) {
          console.error("Failed to process POS message", e);
        }
      }
    };

    window.addEventListener('message', handlePosMessage);
    return () => window.removeEventListener('message', handlePosMessage);
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem('pakaja_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('pakaja_sales', JSON.stringify(salesRecords));
  }, [salesRecords]);

  useEffect(() => {
    localStorage.setItem('pakaja_skus', JSON.stringify(skus));
  }, [skus]);

  useEffect(() => {
    localStorage.setItem('pakaja_branches', JSON.stringify(branches));
  }, [branches]);

  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  const addBatchTransactions = (txs: Omit<Transaction, 'id' | 'timestamp' | 'batchId'>[]) => {
    if (txs.length === 0) return;
    const batchId = generateId();
    const timestamp = Date.now();
    const newTxs: Transaction[] = txs.map(t => ({
      ...t,
      id: generateId(),
      batchId,
      timestamp,
    }));
    setTransactions(prev => [...newTxs, ...prev]);
  };

  const addSalesRecords = (records: Omit<SalesRecord, 'id' | 'timestamp'>[]) => {
     if (records.length === 0) return;
     const timestamp = Date.now();
     const newRecords: SalesRecord[] = records.map(r => ({
       ...r,
       id: generateId(),
       timestamp
     }));
     setSalesRecords(prev => [...prev, ...newRecords]);
  };

  const deleteSalesRecordsForDate = (date: string, branchId: string, platform?: string) => {
    setSalesRecords(prev => prev.filter(r => {
      if (r.date !== date || r.branchId !== branchId) return true;
      if (platform && r.platform !== platform) return true;
      return false; // Delete this record
    }));
  };

  const addSku = (skuData: Omit<SKU, 'id' | 'order'>) => {
    const newSku: SKU = {
      ...skuData,
      id: `sku-${Date.now()}`,
      order: skus.length,
    };
    setSkus(prev => [...prev, newSku]);
  };

  const updateSku = (updatedSku: SKU) => {
    setSkus(prev => prev.map(s => s.id === updatedSku.id ? updatedSku : s));
  };

  const deleteSku = (id: string) => {
    setSkus(prev => prev.filter(s => s.id !== id));
  };

  const reorderSku = (id: string, direction: 'up' | 'down') => {
    setSkus(prev => {
      const index = prev.findIndex(s => s.id === id);
      if (index === -1) return prev;
      if (direction === 'up' && index === 0) return prev;
      if (direction === 'down' && index === prev.length - 1) return prev;

      const newSkus = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newSkus[index], newSkus[targetIndex]] = [newSkus[targetIndex], newSkus[index]];
      return newSkus.map((s, idx) => ({ ...s, order: idx }));
    });
  };

  const addBranch = (branchData: Omit<Branch, 'id'>) => {
    const newBranch: Branch = {
      ...branchData,
      id: `branch-${Date.now()}`
    };
    setBranches(prev => [...prev, newBranch]);
  };

  const updateBranch = (updatedBranch: Branch) => {
    setBranches(prev => prev.map(b => b.id === updatedBranch.id ? updatedBranch : b));
  };

  const deleteBranch = (id: string) => {
    setBranches(prev => prev.filter(b => b.id !== id));
  };

  const resetData = () => {
    setTransactions([]);
    setSalesRecords([]);
    setSkus(INITIAL_SKUS);
    setBranches(INITIAL_BRANCHES);
    localStorage.removeItem('pakaja_transactions');
    localStorage.removeItem('pakaja_sales');
    localStorage.removeItem('pakaja_skus');
    localStorage.removeItem('pakaja_branches');
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