import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, getCurrentUser, getCurrentUserId, setCurrentUserId, checkDailyReset } from './storage';

interface AuthContextType {
  user: User | null;
  refreshUser: () => void;
  logout: () => void;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, refreshUser: () => {}, logout: () => {}, isLoggedIn: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize user synchronously from localStorage so consumers see the
  // correct logged-in state on first render (prevents redirect-on-refresh).
  const initialUser = (() => {
    try {
      const u = getCurrentUser();
      if (u) checkDailyReset(u.id);
      return u ? { ...u } : null;
    } catch {
      return null;
    }
  })();

  const [user, setUser] = useState<User | null>(initialUser);

  const refreshUser = useCallback(() => {
    const u = getCurrentUser();
    if (u) checkDailyReset(u.id);
    setUser(u ? { ...u } : null);
  }, []);

  const logout = useCallback(() => {
    setCurrentUserId(null);
    setUser(null);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, refreshUser, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
