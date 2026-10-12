'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { login as apiLogin, logout as apiLogout, refreshSession, type AuthUser } from './api';
import { useQueryClient } from '@tanstack/react-query';

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthUser };

interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const queryClient = useQueryClient();
  // Restore the session after a page load. React may run this effect twice in
  // development; both runs share a single request thanks to refreshSession().
  useEffect(() => {
    let active = true;
    refreshSession().then((result) => {
      if (!active) return;
      setState(result ? { status: 'authenticated', user: result.user } : { status: 'anonymous' });
    });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiLogin(email, password);
      queryClient.clear(); // never show data that was cached for a previous user
      setState({ status: 'authenticated', user: result.user });
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // The session is dropped locally either way.
    }
    queryClient.clear(); // the next person on this browser must start from nothing
    setState({ status: 'anonymous' });
  }, [queryClient]);

  const value = useMemo(() => ({ state, login, logout }), [state, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}