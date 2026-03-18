import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, getCurrentUser, getCurrentUserId, setCurrentUserId, checkDailyReset, updateUser } from './storage';

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
    // Try to fetch server-side authoritative user state and merge it into localStorage
    (async () => {
      try {
        const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
        if (u) {
          const base = API_BASE || '';
          // API_BASE already points at the API root (e.g. '/api'), so avoid doubling '/api' in the path.
          // Use the users path relative to the API root.
          const resp = await fetch(`${base}/users/${u.id}`);
          if (resp.ok) {
            const data = await resp.json();
            if (data && data.user) {
              // Merge server fields into local user record
              try {
                updateUser(u.id, data.user);
              } catch (e) {
                // ignore if user missing locally
              }
            }
          }
        }
      } catch (e) {
        // ignore network errors
      }
      const latest = getCurrentUser();
      setUser(latest ? { ...latest } : null);
    })();
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
