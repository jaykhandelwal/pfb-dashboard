import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Permission } from '../types';
import { INITIAL_ADMIN_USER } from '../constants';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  login: (code: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (user: User) => void;
  deleteUser: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  // Initialize Users & Handle Auto-Auth
  useEffect(() => {
    let loadedUsers: User[] = [INITIAL_ADMIN_USER];
    const storedUsers = localStorage.getItem('pakaja_users');
    
    if (storedUsers) {
      const parsed = JSON.parse(storedUsers);
      // Migration: Map old 'pin' to 'code' if 'code' doesn't exist
      loadedUsers = parsed.map((u: any) => ({
        ...u,
        code: u.code || u.pin || '0000' // Fallback for migration
      }));
      setUsers(loadedUsers);
    } else {
      // First time setup
      setUsers(loadedUsers);
      localStorage.setItem('pakaja_users', JSON.stringify(loadedUsers));
    }

    // --- SECURE AUTO AUTHENTICATION FOR ANDROID APP ---
    
    // Method 1: Global Variable Injection
    // The Android WebView can inject: window.PAKAJA_AUTH_CODE = 'mycode';
    if (window.PAKAJA_AUTH_CODE) {
      const autoUser = loadedUsers.find(u => u.code === window.PAKAJA_AUTH_CODE);
      if (autoUser) {
        setCurrentUser(autoUser);
        sessionStorage.setItem('pakaja_session_user', autoUser.id);
        // Security: Clear the variable immediately so it cannot be read by other scripts
        delete window.PAKAJA_AUTH_CODE;
      }
    } 
    // Method 2: Check Existing Session (if no injection)
    else {
      const sessionUserId = sessionStorage.getItem('pakaja_session_user');
      if (sessionUserId) {
        const found = loadedUsers.find(u => u.id === sessionUserId);
        if (found) setCurrentUser(found);
      }
    }

    // Method 3: PostMessage Listener (Async Injection)
    // The Android App can send a message: window.postMessage({ type: 'PAKAJA_LOGIN', code: '...' }, '*')
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PAKAJA_LOGIN' && event.data.code) {
        // We must re-fetch users from state or use the closure's loadedUsers
        // Using loadedUsers is safe here as this effect runs on mount
        const autoUser = loadedUsers.find(u => u.code === event.data.code);
        if (autoUser) {
          setCurrentUser(autoUser);
          sessionStorage.setItem('pakaja_session_user', autoUser.id);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Cleanup
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Save users when changed
  useEffect(() => {
    if (users.length > 0) {
      localStorage.setItem('pakaja_users', JSON.stringify(users));
    }
  }, [users]);

  const login = async (code: string) => {
    // Artificial delay for UX
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Case-insensitive check
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

  const addUser = (userData: Omit<User, 'id'>) => {
    const newUser: User = {
      ...userData,
      id: `user-${Date.now()}`
    };
    setUsers(prev => [...prev, newUser]);
  };

  const updateUser = (updatedUser: User) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    // If updating current user, update session too
    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
  };

  const deleteUser = (id: string) => {
    if (currentUser?.id === id) {
      alert("You cannot delete yourself.");
      return;
    }
    setUsers(prev => prev.filter(u => u.id !== id));
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