
import React from 'react';
import * as LucideIcons from 'lucide-react';

export const ICON_CATEGORIES = {
    'General': [
        'Info', 'HelpCircle', 'Settings', 'Bell', 'Calendar', 'Clock', 'Search', 'Filter',
        'Plus', 'Minus', 'Check', 'X', 'AlertTriangle', 'Shield', 'Lock', 'Unlock', 'Eye', 'EyeOff'
    ],
    'Finance': [
        'Wallet', 'Banknote', 'CreditCard', 'Coins', 'DollarSign', 'IndianRupee', 'LineChart',
        'TrendingUp', 'TrendingDown', 'PieChart', 'BarChart3', 'ArrowRightLeft', 'Receipt',
        'PiggyBank', 'Briefcase', 'Ticket', 'HandCoins'
    ],
    'Commerce': [
        'ShoppingCart', 'ShoppingBag', 'Store', 'Tag', 'Package', 'Box', 'Truck', 'Delivery',
        'Layers', 'LayoutGrid', 'Gift', 'Sticker', 'Award', 'Trophy', 'Smartphone'
    ],
    'Food & Beverage': [
        'Coffee', 'Utensils', 'UtensilsCrossed', 'Pizza', 'Beer', 'Wine', 'CupSoda',
        'Cake', 'Apple', 'Flame', 'GlassWater', 'Hop', 'IceCream'
    ],
    'Household': [
        'Home', 'Lamp', 'Bed', 'Bath', 'Trash2', 'Wind', 'Zap', 'Droplets', 'Thermometer',
        'Key', 'Sun', 'Moon', 'Cloud'
    ],
    'Transport': [
        'Car', 'Bike', 'Plane', 'Ship', 'Map', 'MapPin', 'Navigation', 'Compass', 'Fuel'
    ],
    'Personal': [
        'User', 'Users', 'UserPlus', 'Heart', 'Star', 'Smile', 'Focus', 'Gamepad2',
        'Music', 'Camera', 'Video', 'Book', 'Pencil', 'Wrench', 'Hammer', 'Scissors'
    ]
};

// Flatten for easy lookup
export const ALL_ICONS = Object.values(ICON_CATEGORIES).flat();

export const IconRenderer = ({ name, size = 16, color = 'currentColor', className = "" }: { name: string, size?: number, color?: string, className?: string }) => {
    const Icon = (LucideIcons as any)[name] || LucideIcons.HelpCircle;
    return <Icon size={size} color={color} className={className} />;
};
