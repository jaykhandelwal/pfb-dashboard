





import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ArrowRightLeft, Package, History, Store, Trash2, Snowflake, 
  Users, LogOut, Menu, X, Scale, Receipt, Contact, Award, Utensils, 
  ChevronDown, ChevronRight, Settings, TrendingUp, UserCheck, Tag
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Permission } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

type NavItem = {
  label: string;
  icon?: React.ReactNode;
  path?: string;
  permission?: Permission;
  children?: NavItem[];
  id?: string; // Unique ID for collapsible sections
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { currentUser, logout, hasPermission } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Track expanded state of dropdowns - Default collapsed
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // If no user (e.g. login page), render simple layout
  if (!currentUser) {
     return <main className="bg-[#eff2e7] min-h-screen">{children}</main>;
  }

  const navStructure: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, permission: 'VIEW_DASHBOARD' },
    { path: '/operations', label: 'Operations', icon: <ArrowRightLeft size={20} />, permission: 'MANAGE_OPERATIONS' },
    { path: '/attendance', label: 'Attendance', icon: <UserCheck size={20} />, permission: 'MANAGE_ATTENDANCE' },
    { path: '/wastage', label: 'Wastage', icon: <Trash2 size={20} />, permission: 'MANAGE_WASTAGE' },
    { path: '/inventory', label: 'Fridge Inventory', icon: <Snowflake size={20} />, permission: 'MANAGE_INVENTORY' },
    { path: '/reconciliation', label: 'Reconciliation', icon: <Scale size={20} />, permission: 'MANAGE_RECONCILIATION' },
    
    // Sales Group
    {
      id: 'sales',
      label: 'Sales',
      icon: <TrendingUp size={20} />,
      children: [
        { path: '/orders', label: 'Orders & Sales', icon: <Receipt size={18} />, permission: 'VIEW_ORDERS' },
        { path: '/customers', label: 'Customers', icon: <Contact size={18} />, permission: 'MANAGE_CUSTOMERS' },
        { path: '/membership', label: 'Membership Plan', icon: <Award size={18} />, permission: 'MANAGE_MEMBERSHIP' },
      ]
    },

    // Manage Group
    {
      id: 'manage',
      label: 'Manage',
      icon: <Settings size={20} />,
      children: [
        { path: '/menu', label: 'Menu & Pricing', icon: <Utensils size={18} />, permission: 'MANAGE_MENU' },
        { path: '/menu-categories', label: 'Menu Categories', icon: <Tag size={18} />, permission: 'MANAGE_MENU' },
        { path: '/skus', label: 'Raw SKUs', icon: <Package size={18} />, permission: 'MANAGE_SKUS' },
        { path: '/branches', label: 'Branches', icon: <Store size={18} />, permission: 'MANAGE_BRANCHES' },
        { path: '/users', label: 'User Management', icon: <Users size={18} />, permission: 'MANAGE_USERS' },
      ]
    },

    { path: '/logs', label: 'Transaction Logs', icon: <History size={20} />, permission: 'VIEW_LOGS' },
  ];

  // Helper to filter nav items based on permission
  const getFilteredNav = (items: NavItem[]): NavItem[] => {
    return items.reduce((acc: NavItem[], item) => {
      if (item.children) {
        const filteredChildren = getFilteredNav(item.children);
        if (filteredChildren.length > 0) {
          acc.push({ ...item, children: filteredChildren });
        }
      } else if (item.permission) {
        if (hasPermission(item.permission)) {
          acc.push(item);
        }
      } else {
        // No permission required (unlikely in this app, but good for safety)
        acc.push(item);
      }
      return acc;
    }, []);
  };

  const visibleNav = getFilteredNav(navStructure);

  const handleMobileNavClick = () => {
    setIsMobileMenuOpen(false);
  };

  // Render a single nav item (recursive for children)
  const renderNavItem = (item: NavItem, depth = 0) => {
    // If it's a Group (Parent)
    if (item.children && item.id) {
       const isExpanded = expandedSections[item.id];
       const isActiveParent = item.children.some(child => child.path === location.pathname);

       return (
         <div key={item.id} className="mb-1">
            <button
               onClick={() => toggleSection(item.id!)}
               className={`w-full flex items-center justify-between px-4 h-12 rounded-lg transition-colors font-medium text-base ${
                  isActiveParent ? 'text-[#403424] bg-[#403424]/5' : 'text-[#403424] hover:bg-[#403424]/5'
               }`}
            >
               <div className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.label}</span>
               </div>
               {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            
            {/* Children Container */}
            <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
               <div className="flex flex-col space-y-1 ml-4 border-l border-[#403424]/10 pl-2">
                  {item.children.map(child => renderNavItem(child, depth + 1))}
               </div>
            </div>
         </div>
       );
    }

    // If it's a Link (Leaf)
    const isActive = location.pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.path!}
        onClick={handleMobileNavClick}
        className={`flex items-center space-x-3 px-4 h-12 rounded-lg transition-colors font-medium text-base ${
          isActive 
            ? 'bg-[#95a77c] text-white shadow-md' 
            : 'text-[#403424] hover:bg-[#403424]/5'
        }`}
      >
        {item.icon}
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-[#f9faf7] text-[#403424] font-sans overflow-hidden">
      {/* Sidebar (Desktop) */}
      <aside className="w-64 bg-[#eff2e7] text-[#403424] flex-shrink-0 hidden md:flex flex-col shadow-xl z-20 border-r border-[#403424]/5">
        <div className="p-6 border-b border-[#403424]/10 flex flex-col items-center">
          <img src="https://pakaja.b-cdn.net/assets/logo.png" alt="Pakaja" className="h-16 w-auto object-contain mb-2" />
          <p className="text-xs text-[#403424] tracking-widest uppercase mt-1">Inventory Ops</p>
        </div>
        
        <div className="px-6 py-4 flex items-center gap-3 border-b border-[#403424]/10">
          <div className="w-10 h-10 rounded-full bg-[#403424]/5 flex items-center justify-center font-bold text-[#95a77c] border border-[#403424]/10">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold truncate">{currentUser.name}</p>
            <p className="text-[10px] text-[#403424] uppercase tracking-wide">{currentUser.role}</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#403424]/10">
          {visibleNav.map(item => renderNavItem(item))}
        </nav>
        
        <div className="p-4 border-t border-[#403424]/10">
          <button 
            onClick={logout}
            className="flex items-center space-x-3 px-4 h-12 w-full text-[#403424] hover:text-red-600 hover:bg-[#403424]/5 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header & Menu Container */}
      <div className="md:hidden fixed top-0 w-full z-50">
        {/* Header Bar */}
        <div className="bg-[#eff2e7] text-[#403424] px-4 h-16 flex justify-between items-center shadow-md relative z-50 border-b border-[#403424]/5">
           <div className="flex items-center gap-2">
              <img src="https://pakaja.b-cdn.net/assets/logo.png" alt="Pakaja" className="h-8 w-auto object-contain" />
           </div>
           
           <button 
             onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
             className="p-2 text-[#403424] hover:text-[#403424]/70 transition-colors"
           >
             {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
           </button>
        </div>

        {/* Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="absolute top-16 left-0 w-full bg-[#eff2e7] shadow-2xl border-t border-[#403424]/10 flex flex-col max-h-[85vh] overflow-y-auto animate-in slide-in-from-top-2 duration-200">
              {/* User Info (Mobile) */}
              <div className="p-4 bg-[#403424]/5 border-b border-[#403424]/10 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#403424]/10 flex items-center justify-center font-bold text-[#95a77c] border border-[#403424]/10">
                      {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                      <p className="text-sm font-bold text-[#403424]">{currentUser.name}</p>
                      <p className="text-[10px] text-[#403424] uppercase tracking-wide">{currentUser.role}</p>
                  </div>
              </div>

              {/* Navigation Links */}
              <nav className="flex flex-col p-2 space-y-1">
                  {visibleNav.map(item => renderNavItem(item))}
              </nav>

              {/* Logout (Mobile) */}
              <div className="p-4 border-t border-[#403424]/10 mt-2 pb-6">
                  <button 
                      onClick={() => {
                          handleMobileNavClick();
                          logout();
                      }}
                      className="flex items-center justify-center space-x-2 px-4 py-3 w-full text-red-600 bg-[#403424]/5 hover:bg-[#403424]/10 rounded-lg transition-colors font-medium border border-[#403424]/10"
                  >
                      <LogOut size={20} />
                      <span>Sign Out</span>
                  </button>
              </div>
          </div>
        )}
      </div>
      
      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
         <div 
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)} 
         />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full bg-[#f9faf7] relative z-0">
        <div className="max-w-7xl mx-auto p-4 md:p-8 mt-16 md:mt-0">
            {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;