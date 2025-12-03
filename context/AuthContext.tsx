import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Permission } from '../types';
import { INITIAL_ADMIN_USER } from '../constants';
import { supabase } from '../services/supabaseClient';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
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

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      
      if (data && data.length > 0) {
        setUsers(data);
      } else {
        // First run? Add default admin to DB
        await supabase.from('users').insert(INITIAL_ADMIN_USER);
        setUsers([INITIAL_ADMIN_USER]);
      }
    } catch (e) {
      console.error("Failed to load users", e);
      // Fallback if DB fails
      setUsers([INITIAL_ADMIN_USER]);
    }
  };

  // --- Auto Auth Logic ---
  useEffect(() => {
    // Check Global Variable
    if (window.PAKAJA_AUTH_CODE && users.length > 0) {
      const autoUser = users.find(u => u.code === window.PAKAJA_AUTH_CODE);
      if (autoUser) {
        setCurrentUser(autoUser);
        sessionStorage.setItem('pakaja_session_user', autoUser.id);
        delete window.PAKAJA_AUTH_CODE;
      }
    } else {
      // Check Session Storage
      const sessionUserId = sessionStorage.getItem('pakaja_session_user');
      if (sessionUserId && users.length > 0) {
        const found = users.find(u => u.id === sessionUserId);
        if (found) setCurrentUser(found);
      }
    }

    // PostMessage Listener
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PAKAJA_LOGIN' && event.data.code) {
        const autoUser = users.find(u => u.code === event.data.code);
        if (autoUser) {
          setCurrentUser(autoUser);
          sessionStorage.setItem('pakaja_session_user', autoUser.id);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [users]);

  const login = async (code: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const user = users.find(u => u.code.toLowerCase() === code.toLowerCase());
    if (user) {
      setCurrentUser(user);
      sessionStorage.setItem('pakaja_session_user', user.id);
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('pakaja_session_user');
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
    const { error } = await supabase.from('users').insert(newUser);
    if (!error) {
        setUsers(prev => [...prev, newUser]);
    }
  };

  const updateUser = async (updatedUser: User) => {
    const { error } = await supabase.from('users').update({
        name: updatedUser.name,
        code: updatedUser.code,
        role: updatedUser.role,
        permissions: updatedUser.permissions
    }).eq('id', updatedUser.id);

    if (!error) {
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        if (currentUser && currentUser.id === updatedUser.id) {
          setCurrentUser(updatedUser);
        }
    }
  };

  const deleteUser = async (id: string) => {
    if (currentUser?.id === id) {
      alert("You cannot delete yourself.");
      return;
    }
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (!error) {
        setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      users, 
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