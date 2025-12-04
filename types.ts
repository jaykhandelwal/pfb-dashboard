
export enum TransactionType {
  CHECK_OUT = 'CHECK_OUT', // Freezer -> Branch
  CHECK_IN = 'CHECK_IN',    // Branch -> Freezer (Returns)
  WASTE = 'WASTE',          // Branch -> Trash (Loss)
  RESTOCK = 'RESTOCK',      // Supplier -> Freezer (Incoming Stock)
  ADJUSTMENT = 'ADJUSTMENT' // Manual Correction (Stocktake)
}

export enum SKUCategory {
  STEAM = 'Steam',
  KURKURE = 'Kurkure',
  ROLL = 'Roll',
  WHEAT = 'Wheat',
  CONSUMABLES = 'Consumables'
}

export enum SKUDietary {
  VEG = 'Veg',
  NON_VEG = 'Non-Veg',
  NA = 'N/A'
}

export interface SKU {
  id: string;
  name: string;
  category: SKUCategory; // e.g. Steam, Kurkure
  dietary: SKUDietary;   // e.g. Veg, Non-Veg
  piecesPerPacket: number; // Inventory unit size
  order: number; // For custom sorting
}

export interface Branch {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  batchId: string; // Group ID for multiple items saved together
  date: string; // ISO Date string YYYY-MM-DD
  timestamp: number;
  skuId: string;
  branchId: string; // For RESTOCK, this can be 'FRIDGE' or null
  type: TransactionType;
  quantityPieces: number; // Raw count of momos
  imageUrls?: string[]; // Optional: Array of Base64 strings of wastage photos
  userId?: string; // ID of the user who performed the action
  userName?: string; // Name of the user at the time of action
}

export interface ArchivedTransaction extends Transaction {
  deletedAt: string; // ISO Date of deletion
  deletedBy: string; // Name of user who deleted it
}

// --- Sales & Reconciliation ---

// Strict platforms only
export type SalesPlatform = 'POS' | 'ZOMATO' | 'SWIGGY';

export interface SalesRecord {
  id: string;
  date: string;
  branchId: string;
  platform: SalesPlatform;
  skuId: string;
  quantitySold: number; // In pieces/plates
  timestamp: number;
}

export interface DailyReportItem {
  skuName: string;
  category: SKUCategory;
  dietary: SKUDietary;
  taken: number;
  returned: number;
  waste: number;
  sold: number; // Net consumption (Taken - Returned - Waste)
}

export interface DashboardStats {
  totalPiecesSold: number;
  topSellingSku: string;
  returnRate: number;
  branchPerformance: Record<string, number>; // BranchID -> Pieces Sold
}

// --- Auth & User Management ---

export type Role = 'ADMIN' | 'MANAGER' | 'STAFF';

export type Permission = 
  | 'VIEW_DASHBOARD'
  | 'VIEW_ANALYTICS' // New: Permission to see sales reports/charts
  | 'MANAGE_OPERATIONS'
  | 'MANAGE_INVENTORY'
  | 'MANAGE_WASTAGE'
  | 'MANAGE_SKUS'
  | 'MANAGE_BRANCHES'
  | 'MANAGE_USERS'
  | 'VIEW_LOGS'
  | 'MANAGE_RECONCILIATION' // New: Permission for sales matching
  | 'VIEW_ORDERS'; // New: View individual sales orders

export interface User {
  id: string;
  name: string;
  code: string; // Changed from 'pin' to 'code' to support alphanumeric
  role: Role;
  permissions: Permission[];
}

// Add global window extension for Android Bridge
declare global {
  interface Window {
    PAKAJA_AUTH_CODE?: string;
  }
}
