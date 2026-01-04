


import { Branch, SKU, SKUCategory, SKUDietary, Permission, User, MembershipRule, Customer, MenuItem, MenuCategory } from './types';

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
  
  // Consumables (Price 0 usually, or internal cost)
  { id: 'sku-9', name: 'Red Chutney', category: SKUCategory.CONSUMABLES, dietary: SKUDietary.NA, piecesPerPacket: 1, order: 8 },
  { id: 'sku-10', name: 'Mayonnaise', category: SKUCategory.CONSUMABLES, dietary: SKUDietary.NA, piecesPerPacket: 1, order: 9 },
  { id: 'sku-11', name: 'Oil Packets', category: SKUCategory.CONSUMABLES, dietary: SKUDietary.NA, piecesPerPacket: 1, order: 10 },
  { id: 'sku-12', name: 'Paper Plates', category: SKUCategory.CONSUMABLES, dietary: SKUDietary.NA, piecesPerPacket: 50, order: 11 },
];

export const INITIAL_MENU_CATEGORIES: MenuCategory[] = [
  { id: 'cat-1', name: 'Steam', order: 0, color: '#3b82f6' }, // Blue
  { id: 'cat-2', name: 'Fried', order: 1, color: '#f59e0b' }, // Amber
  { id: 'cat-3', name: 'Kurkure', order: 2, color: '#ef4444' }, // Red
  { id: 'cat-4', name: 'Drinks', order: 3, color: '#10b981' }, // Emerald
  { id: 'cat-5', name: 'Platters', order: 4, color: '#8b5cf6' }, // Violet
];

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  { 
    id: 'menu-1', 
    name: 'Veg Steam Full Plate', 
    category: 'Steam',
    price: 100, 
    ingredients: [{ skuId: 'sku-1', quantity: 10 }] 
  },
  { 
    id: 'menu-2', 
    name: 'Paneer Steam Full Plate', 
    category: 'Steam',
    price: 120, 
    ingredients: [{ skuId: 'sku-2', quantity: 10 }]
  },
  { 
    id: 'menu-3', 
    name: 'Chicken Steam Full Plate', 
    category: 'Steam',
    price: 140, 
    ingredients: [{ skuId: 'sku-3', quantity: 10 }]
  },
  { 
    id: 'menu-4', 
    name: 'Mixed Platter (12pcs)', 
    category: 'Platters',
    price: 180, 
    description: '4 Veg, 4 Paneer, 4 Chicken',
    ingredients: [
        { skuId: 'sku-1', quantity: 4 },
        { skuId: 'sku-2', quantity: 4 },
        { skuId: 'sku-3', quantity: 4 }
    ]
  },
];

export const INITIAL_MEMBERSHIP_RULES: MembershipRule[] = [
  { 
    id: 'rule-1', 
    triggerOrderCount: 5, 
    type: 'DISCOUNT_PERCENT', 
    value: 20, 
    description: 'Get 20% Off on your 5th order!' 
  },
  { 
    id: 'rule-2', 
    triggerOrderCount: 10, 
    type: 'FREE_ITEM', 
    value: 'sku-1', 
    description: 'Free Veg Steam Plate on your 10th order!' 
  }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'cust-1', name: 'Rahul Sharma', phoneNumber: '9876543210', totalSpend: 5400, orderCount: 12, joinedAt: '2024-01-15', lastOrderDate: '2024-03-20' },
  { id: 'cust-2', name: 'Priya Singh', phoneNumber: '9988776655', totalSpend: 850, orderCount: 3, joinedAt: '2024-02-10', lastOrderDate: '2024-03-18' },
];

export const MOCK_HISTORY_DAYS = 7;

// --- Auth Constants ---

export const ALL_PERMISSIONS: { id: Permission; label: string }[] = [
  { id: 'VIEW_DASHBOARD', label: 'View Dashboard (Inventory Status)' },
  { id: 'VIEW_ANALYTICS', label: 'View Analytics & Reports' },
  { id: 'MANAGE_ATTENDANCE', label: 'Submit & View Attendance' },
  { id: 'MANAGE_OPERATIONS', label: 'Manage Operations (Check Out/Return)' },
  { id: 'MANAGE_INVENTORY', label: 'Manage Fridge Inventory' },
  { id: 'MANAGE_WASTAGE', label: 'Report Wastage' },
  { id: 'MANAGE_SKUS', label: 'Manage SKUs (Raw Material)' },
  { id: 'MANAGE_MENU', label: 'Manage Menu & Prices' },
  { id: 'MANAGE_BRANCHES', label: 'Manage Branches' },
  { id: 'MANAGE_USERS', label: 'Manage Users & Access' },
  { id: 'MANAGE_SETTINGS', label: 'Manage App Settings' },
  { id: 'VIEW_LOGS', label: 'View Transaction Logs' },
  { id: 'MANAGE_RECONCILIATION', label: 'Sales Reconciliation (POS/Zomato)' },
  { id: 'VIEW_ORDERS', label: 'View Orders (POS/Online)' },
  { id: 'MANAGE_CUSTOMERS', label: 'Manage Customers & CRM' },
  { id: 'MANAGE_MEMBERSHIP', label: 'Manage Membership & Rewards' },
];

export const ROLE_PRESETS: Record<string, Permission[]> = {
  ADMIN: ALL_PERMISSIONS.map(p => p.id),
  MANAGER: ['VIEW_DASHBOARD', 'VIEW_ANALYTICS', 'MANAGE_OPERATIONS', 'MANAGE_INVENTORY', 'MANAGE_WASTAGE', 'VIEW_LOGS', 'MANAGE_RECONCILIATION', 'VIEW_ORDERS', 'MANAGE_CUSTOMERS', 'MANAGE_MENU', 'MANAGE_ATTENDANCE', 'MANAGE_SETTINGS'],
  STAFF: ['VIEW_DASHBOARD', 'MANAGE_OPERATIONS', 'MANAGE_WASTAGE', 'VIEW_ORDERS', 'MANAGE_ATTENDANCE'], 
};

export const INITIAL_ADMIN_USER: User = {
  id: 'user-admin',
  name: 'Admin',
  code: 'admin', // Alphanumeric code
  role: 'ADMIN',
  permissions: ROLE_PRESETS.ADMIN,
  defaultPage: '/dashboard'
};

export const APP_PAGES = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/orders', label: 'POS & Orders' },
  { path: '/operations', label: 'Operations (Check In/Out)' },
  { path: '/attendance', label: 'Attendance' },
  { path: '/wastage', label: 'Wastage Report' },
  { path: '/inventory', label: 'Fridge Inventory' },
  { path: '/reconciliation', label: 'Sales Reconciliation' },
  { path: '/logs', label: 'Logs' },
];

// --- Utilities ---

export const getLocalISOString = (date: Date = new Date()): string => {
  const offset = date.getTimezoneOffset() * 60000;
  const localTime = new Date(date.getTime() - offset);
  return localTime.toISOString().slice(0, 10);
};