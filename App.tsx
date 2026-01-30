
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Operations from './pages/Operations';
import SkuManagement from './pages/SkuManagement';
import BranchManagement from './pages/BranchManagement';
import UserManagement from './pages/UserManagement';
import Wastage from './pages/Wastage';
import Logs from './pages/Logs';
import Inventory from './pages/Inventory';
import Reconciliation from './pages/Reconciliation';
import Orders from './pages/Orders';
import CustomerManagement from './pages/CustomerManagement';
import MembershipSettings from './pages/MembershipSettings';
import MenuManagement from './pages/MenuManagement';
import MenuCategoryManagement from './pages/MenuCategoryManagement';
import Attendance from './pages/Attendance';
import Tasks from './pages/Tasks';
import AppSettings from './pages/AppSettings';
import StockOrdering from './pages/StockOrdering';
import Ledger from './pages/Ledger';
import LedgerSettings from './pages/LedgerSettings';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { StoreProvider } from './context/StoreContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import UpdateNotification from './components/UpdateNotification';

// Root Redirect Component
const RootRedirect = () => {
  const { currentUser } = useAuth();

  // If user has no preference or legacy preference ('/'), default to dashboard
  // Otherwise respect their choice (e.g. /orders)
  const target = (!currentUser?.defaultPage || currentUser.defaultPage === '/')
    ? '/dashboard'
    : currentUser.defaultPage;

  return <Navigate to={target} replace />;
};

function App() {
  useEffect(() => {
    // Prevent mouse wheel from changing number input values
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number' && document.activeElement === target) {
        e.preventDefault();
      }
    };

    // On mobile, blur the active number input when starting a scroll gesture
    const handleTouchMove = () => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement.tagName === 'INPUT' && (activeElement as HTMLInputElement).type === 'number') {
        activeElement.blur();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return (
    <AuthProvider>
      <StoreProvider>
        <HashRouter>
          <Layout>
            <Routes>
              <Route path="/login" element={<Login />} />

              {/* Root Redirector - Redirects to default page */}
              <Route path="/" element={
                <ProtectedRoute>
                  <RootRedirect />
                </ProtectedRoute>
              } />

              {/* Explicit Dashboard Route */}
              <Route path="/dashboard" element={
                <ProtectedRoute requiredPermission="VIEW_DASHBOARD">
                  <Dashboard />
                </ProtectedRoute>
              } />

              <Route path="/orders" element={
                <ProtectedRoute requiredPermission="VIEW_ORDERS">
                  <Orders />
                </ProtectedRoute>
              } />

              <Route path="/customers" element={
                <ProtectedRoute requiredPermission="MANAGE_CUSTOMERS">
                  <CustomerManagement />
                </ProtectedRoute>
              } />

              <Route path="/membership" element={
                <ProtectedRoute requiredPermission="MANAGE_MEMBERSHIP">
                  <MembershipSettings />
                </ProtectedRoute>
              } />

              <Route path="/operations" element={
                <ProtectedRoute requiredPermission="MANAGE_OPERATIONS">
                  <Operations />
                </ProtectedRoute>
              } />

              <Route path="/attendance" element={
                <ProtectedRoute requiredPermission="MANAGE_ATTENDANCE">
                  <Attendance />
                </ProtectedRoute>
              } />

              <Route path="/tasks" element={
                <ProtectedRoute requiredPermission="MANAGE_TASKS">
                  <Tasks />
                </ProtectedRoute>
              } />

              <Route path="/inventory" element={
                <ProtectedRoute requiredPermission="MANAGE_INVENTORY">
                  <Inventory />
                </ProtectedRoute>
              } />

              <Route path="/stock-ordering" element={
                <ProtectedRoute requiredPermission="MANAGE_INVENTORY">
                  <StockOrdering />
                </ProtectedRoute>
              } />

              <Route path="/reconciliation" element={
                <ProtectedRoute requiredPermission="MANAGE_RECONCILIATION">
                  <Reconciliation />
                </ProtectedRoute>
              } />

              <Route path="/wastage" element={
                <ProtectedRoute requiredPermission="MANAGE_WASTAGE">
                  <Wastage />
                </ProtectedRoute>
              } />

              <Route path="/menu" element={
                <ProtectedRoute requiredPermission="MANAGE_MENU">
                  <MenuManagement />
                </ProtectedRoute>
              } />

              <Route path="/menu-categories" element={
                <ProtectedRoute requiredPermission="MANAGE_MENU">
                  <MenuCategoryManagement />
                </ProtectedRoute>
              } />

              <Route path="/skus" element={
                <ProtectedRoute requiredPermission="MANAGE_SKUS">
                  <SkuManagement />
                </ProtectedRoute>
              } />

              <Route path="/branches" element={
                <ProtectedRoute requiredPermission="MANAGE_BRANCHES">
                  <BranchManagement />
                </ProtectedRoute>
              } />

              <Route path="/users" element={
                <ProtectedRoute requiredPermission="MANAGE_USERS">
                  <UserManagement />
                </ProtectedRoute>
              } />

              <Route path="/settings" element={
                <ProtectedRoute requiredPermission="MANAGE_SETTINGS">
                  <AppSettings />
                </ProtectedRoute>
              } />

              <Route path="/ledger" element={
                <ProtectedRoute requiredPermission="MANAGE_LEDGER" requiredRole="ADMIN">
                  <Ledger />
                </ProtectedRoute>
              } />

              <Route path="/ledger-settings" element={
                <ProtectedRoute requiredPermission="MANAGE_LEDGER" requiredRole="ADMIN">
                  <LedgerSettings />
                </ProtectedRoute>
              } />

              <Route path="/logs" element={
                <ProtectedRoute requiredPermission="VIEW_LOGS">
                  <Logs />
                </ProtectedRoute>
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </HashRouter>
        <UpdateNotification />
      </StoreProvider>
    </AuthProvider>
  );
}

export default App;