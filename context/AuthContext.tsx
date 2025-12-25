
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Permission } from '../types';
import { INITIAL_ADMIN_USER } from '../constants';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

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
              fetchedUsers = data.map((u: any) => ({
                 id: u.id,
                 name: u.name,
                 code: u.code,
                 role: u.role,
                 permissions: u.permissions,
                 defaultBranchId: u.default_branch_id,
                 defaultPage: u.default_page // Map from DB
              }));
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
            default_page: newUser.defaultPage
        });
        if (!error) {
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
            default_page: updatedUser.defaultPage
        }).eq('id', updatedUser.id);

        if (!error) {
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
        if (!error) {
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
