import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Permission } from '../types';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: Permission;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredPermission }) => {
  const { currentUser, hasPermission, isLoading } = useAuth();

  // Show loading state while AuthContext initializes (fetches users & checks local storage)
  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f9faf7]">
        <Loader2 className="w-8 h-8 text-[#95a77c] animate-spin mb-3" />
        <p className="text-[#403424]/60 text-sm font-medium tracking-wide">Restoring Session...</p>
      </div>
    );
  }

  // Once loaded, check if user is logged in
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Check Permissions
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-fade-in">
        <div className="bg-red-100 text-red-600 p-4 rounded-full mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Access Denied</h2>
        <p className="text-slate-500 mt-2">You do not have permission to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;