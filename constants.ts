import { Branch, SKU, SKUCategory, SKUDietary, Permission, User } from './types';

export const INITIAL_BRANCHES: Branch[] = [
  { id: 'branch-1', name: 'Momo Mafia 01' },
  { id: 'branch-2', name: 'Momo Mafia 02' },
];

export const INITIAL_SKUS: SKU[] = [
  // Steam
  { id: 'sku-1', name: 'Veg Steam', category: SKUCategory.STEAM, dietary: SKUDietary.VEG, piecesPerPacket: 50, order: 0 },
  { id: 'sku-2', name: 'Paneer Steam', category: SKUCategory.STEAM, dietary: SKUDietary.VEG, piecesPerPacket: 50, order: 1 },
  { id: 'sku-3', name: 'Chicken Steam', category: SKUCategory.STEAM, dietary: SKUDietary.NON_VEG, piecesPerPacket: 50, order: 2 },

  // Kurkure
  { id: 'sku-4', name: 'Veg Kurkure', category: SKUCategory.KURKURE, dietary: SKUDietary.VEG, piecesPerPacket: 25, order: 3 },
  { id: 'sku-5', name: 'Paneer Kurkure', category: SKUCategory.KURKURE, dietary: SKUDietary.VEG, piecesPerPacket: 25, order: 4 },
  { id: 'sku-6', name: 'Chicken Kurkure', category: SKUCategory.KURKURE, dietary: SKUDietary.NON_VEG, piecesPerPacket: 25, order: 5 },

  // Wheat
  { id: 'sku-7', name: 'Veg Wheat', category: SKUCategory.WHEAT, dietary: SKUDietary.VEG, piecesPerPacket: 50, order: 6 },

  // Rolls
  { id: 'sku-8', name: 'Veg Spring Roll', category: SKUCategory.ROLL, dietary: SKUDietary.VEG, piecesPerPacket: 20, order: 7 },
  
  // Consumables
  { id: 'sku-9', name: 'Red Chutney', category: SKUCategory.CONSUMABLES, dietary: SKUDietary.NA, piecesPerPacket: 1, order: 8 },
  { id: 'sku-10', name: 'Mayonnaise', category: SKUCategory.CONSUMABLES, dietary: SKUDietary.NA, piecesPerPacket: 1, order: 9 },
  { id: 'sku-11', name: 'Oil Packets', category: SKUCategory.CONSUMABLES, dietary: SKUDietary.NA, piecesPerPacket: 1, order: 10 },
  { id: 'sku-12', name: 'Paper Plates', category: SKUCategory.CONSUMABLES, dietary: SKUDietary.NA, piecesPerPacket: 50, order: 11 },
];

export const MOCK_HISTORY_DAYS = 7;

// --- Auth Constants ---

export const ALL_PERMISSIONS: { id: Permission; label: string }[] = [
  { id: 'VIEW_DASHBOARD', label: 'View Dashboard (Inventory Status)' },
  { id: 'VIEW_ANALYTICS', label: 'View Analytics & Reports' },
  { id: 'MANAGE_OPERATIONS', label: 'Manage Operations (Check Out/Return)' },
  { id: 'MANAGE_INVENTORY', label: 'Manage Fridge Inventory' },
  { id: 'MANAGE_WASTAGE', label: 'Report Wastage' },
  { id: 'MANAGE_SKUS', label: 'Manage SKUs (Products)' },
  { id: 'MANAGE_BRANCHES', label: 'Manage Branches' },
  { id: 'MANAGE_USERS', label: 'Manage Users & Access' },
  { id: 'VIEW_LOGS', label: 'View Transaction Logs' },
  { id: 'MANAGE_RECONCILIATION', label: 'Sales Reconciliation (POS/Zomato)' },
  { id: 'VIEW_ORDERS', label: 'View Orders (POS/Online)' },
];

export const ROLE_PRESETS: Record<string, Permission[]> = {
  ADMIN: ALL_PERMISSIONS.map(p => p.id),
  MANAGER: ['VIEW_DASHBOARD', 'VIEW_ANALYTICS', 'MANAGE_OPERATIONS', 'MANAGE_INVENTORY', 'MANAGE_WASTAGE', 'VIEW_LOGS', 'MANAGE_RECONCILIATION', 'VIEW_ORDERS'],
  STAFF: ['VIEW_DASHBOARD', 'MANAGE_OPERATIONS', 'MANAGE_WASTAGE'], // Staff can view dashboard (Inventory) but not analytics
};

export const INITIAL_ADMIN_USER: User = {
  id: 'user-admin',
  name: 'Admin',
  code: 'admin', // Alphanumeric code
  role: 'ADMIN',
  permissions: ROLE_PRESETS.ADMIN,
};

// --- Utilities ---

/**
 * Returns a YYYY-MM-DD string representing the local date.
 * This prevents timezone issues where late-night operations count as the next day in UTC.
 */
export const getLocalISOString = (date: Date = new Date()): string => {
  const offset = date.getTimezoneOffset() * 60000; // Offset in milliseconds
  const localTime = new Date(date.getTime() - offset);
  return localTime.toISOString().slice(0, 10);
};