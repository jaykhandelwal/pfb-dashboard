import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Permission } from '../types';
import { INITIAL_ADMIN_USER } from '../constants';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

// Global declaration for Window
declare global {
  interface Window {
    PAKAJA_AUTH_CODE?: string;
  }
}

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  isLoading: boolean;
  login: (code: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  addUser: (user: Omit<User, 'id'>) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Auth: Fetch Users & Check Session
  useEffect(() => {
    const initializeAuth = async () => {
      let fetchedUsers: User[] = [];

      try {
        if (isSupabaseConfigured()) {
          // 1. Fetch Users from Supabase
          const { data, error } = await supabase.from('users').select('*');

          if (error) throw error;

          if (data && data.length > 0) {
            fetchedUsers = data.map(mapUser);
          } else {
            // If DB is empty, seed with Initial Admin (First Run)
            const { error: seedError } = await supabase.from('users').insert(INITIAL_ADMIN_USER);
            if (!seedError) {
              fetchedUsers = [INITIAL_ADMIN_USER];
            } else {
              fetchedUsers = [INITIAL_ADMIN_USER];
            }
          }
        } else {
          console.log("Supabase not configured. Using offline fallback users.");
          fetchedUsers = [INITIAL_ADMIN_USER];
        }
      } catch (e) {
        console.warn("Auth Initialization encountered an issue (Using Fallback):", e);
        fetchedUsers = [INITIAL_ADMIN_USER];
      }

      setUsers(fetchedUsers);

      // 2. Check for Active Session
      try {
        // Priority A: Android Bridge Global Variable (One-time use)
        if (window.PAKAJA_AUTH_CODE) {
          const autoUser = fetchedUsers.find(u => u.code === window.PAKAJA_AUTH_CODE);
          if (autoUser) {
            setCurrentUser(autoUser);
            persistSession(autoUser);
            delete window.PAKAJA_AUTH_CODE;
          }
        }
        // Priority B: LocalStorage (24h Persistence)
        else {
          const storedSession = localStorage.getItem('pakaja_session');
          if (storedSession) {
            const { user, timestamp } = JSON.parse(storedSession);
            const ONE_DAY = 24 * 60 * 60 * 1000;

            if (Date.now() - timestamp < ONE_DAY && user) {
              // Restore session from local storage immediately
              // We trust the local storage user object temporarily even if DB fetch failed

              // --- PATCH: Ensure admins have MANAGE_TASKS (Legacy Fix) ---
              if (user.role === 'ADMIN' && !user.permissions.includes('MANAGE_TASKS')) {
                user.permissions.push('MANAGE_TASKS');
              }
              // -----------------------------------------------------------

              setCurrentUser(user);

              // If we successfully fetched fresh users, try to update the current user with fresh data
              if (fetchedUsers.length > 0) {
                const freshUser = fetchedUsers.find(u => u.id === user.id);
                if (freshUser) {
                  setCurrentUser(freshUser);
                  persistSession(freshUser); // Update local storage with fresh data
                }
              }
            } else {
              localStorage.removeItem('pakaja_session'); // Expired
            }
          }
        }
      } catch (e) {
        console.error("Session Restoration Error:", e);
        localStorage.removeItem('pakaja_session');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // --- Realtime User Updates ---
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase.channel('auth-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload: any) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        setUsers(prev => {
          if (eventType === 'INSERT') {
            const mapped = mapUser(newRecord);
            if (prev.some(u => u.id === mapped.id)) return prev;
            return [...prev, mapped];
          } else if (eventType === 'UPDATE') {
            const mapped = mapUser(newRecord);

            // If the current logged in user was updated, reflect changes immediately
            if (currentUser && currentUser.id === mapped.id) {
              setCurrentUser(mapped);
              persistSession(mapped);
            }

            return prev.map(u => u.id === mapped.id ? mapped : u);
          } else if (eventType === 'DELETE') {
            return prev.filter(u => u.id !== oldRecord.id);
          }
          return prev;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // PostMessage Listener for dynamic login events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PAKAJA_LOGIN' && event.data.code) {
        const autoUser = users.find(u => u.code === event.data.code);
        if (autoUser) {
          setCurrentUser(autoUser);
          persistSession(autoUser);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [users]);

  // Mapper
  const mapUser = (u: any): User => {
    const user: User = {
      id: u.id,
      name: u.name,
      code: u.code,
      role: u.role,
      permissions: u.permissions,
      // Robust mapping for snake_case or camelCase
      defaultBranchId: u.default_branch_id || u.defaultBranchId,
      defaultPage: u.default_page || u.defaultPage,
      isLedgerAuditor: u.is_ledger_auditor || u.isLedgerAuditor || false,
      isStagedAttendanceEnabled: u.is_staged_attendance_enabled ?? u.isStagedAttendanceEnabled ?? false,
      stagedAttendanceConfig: typeof u.staged_attendance_config === 'string' ? JSON.parse(u.staged_attendance_config) : (u.staged_attendance_config || u.stagedAttendanceConfig || []),
      stagedAttendanceProgress: typeof u.staged_attendance_progress === 'string' ? JSON.parse(u.staged_attendance_progress) : (u.staged_attendance_progress || u.stagedAttendanceProgress)
    };
    // Runtime patch for admins to get new permissions immediately
    if (user.role === 'ADMIN') {
      const essentialPermissions: Permission[] = ['MANAGE_TASKS', 'MANAGE_LEDGER', 'MANAGE_MEMBERSHIP'];
      essentialPermissions.forEach(p => {
        if (!user.permissions.includes(p)) {
          user.permissions.push(p);
        }
      });
    }
    return user;
  };

  const persistSession = (user: User) => {
    localStorage.setItem('pakaja_session', JSON.stringify({
      user,
      timestamp: Date.now()
    }));
  };

  const login = async (code: string) => {
    // Artificial delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500));

    const user = users.find(u => u.code.toLowerCase() === code.toLowerCase());
    if (user) {
      setCurrentUser(user);
      persistSession(user);
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pakaja_session');
  };

  const hasPermission = (permission: Permission) => {
    if (!currentUser) return false;
    return currentUser.permissions.includes(permission);
  };

  const addUser = async (userData: Omit<User, 'id'>) => {
    const newUser = {
      id: `user-${Date.now()}`,
      ...userData
    };

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('users').insert({
        id: newUser.id,
        name: newUser.name,
        code: newUser.code,
        role: newUser.role,
        permissions: newUser.permissions,
        default_branch_id: newUser.defaultBranchId,
        default_page: newUser.defaultPage,
        is_ledger_auditor: newUser.isLedgerAuditor,
        is_staged_attendance_enabled: newUser.isStagedAttendanceEnabled,
        staged_attendance_config: newUser.stagedAttendanceConfig,
        staged_attendance_progress: newUser.stagedAttendanceProgress
      });
      if (error) {
        console.error("Error adding user to Supabase:", error);
        alert("Failed to add user to database. Please check console.");
      } else {
        setUsers(prev => [...prev, newUser]);
      }
    } else {
      // Offline mode
      setUsers(prev => [...prev, newUser]);
    }
  };

  const updateUser = async (updatedUser: User) => {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('users').update({
        name: updatedUser.name,
        code: updatedUser.code,
        role: updatedUser.role,
        permissions: updatedUser.permissions,
        default_branch_id: updatedUser.defaultBranchId,
        default_page: updatedUser.defaultPage,
        is_ledger_auditor: updatedUser.isLedgerAuditor,
        is_staged_attendance_enabled: updatedUser.isStagedAttendanceEnabled,
        staged_attendance_config: updatedUser.stagedAttendanceConfig,
        staged_attendance_progress: updatedUser.stagedAttendanceProgress
      }).eq('id', updatedUser.id);

      if (error) {
        console.error("Error updating user in Supabase:", error);
        alert("Failed to save user changes to database. Please check console.");
      } else {
        updateLocalState(updatedUser);
      }
    } else {
      updateLocalState(updatedUser);
    }
  };

  const updateLocalState = (updatedUser: User) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
      persistSession(updatedUser);
    }
  };

  const deleteUser = async (id: string) => {
    if (currentUser?.id === id) {
      alert("You cannot delete yourself.");
      return;
    }

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) {
        console.error("Error deleting user from Supabase:", error);
        alert("Failed to delete user from database.");
      } else {
        setUsers(prev => prev.filter(u => u.id !== id));
      }
    } else {
      setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      users,
      isLoading,
      login,
      logout,
      hasPermission,
      addUser,
      updateUser,
      deleteUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a AuthProvider');
  }
  return context;
};