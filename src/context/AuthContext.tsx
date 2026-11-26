import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setAuthToken } from '../services/api';
import type { User, UserRole } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  adminClaimed: boolean;
  envPasscodeConfigured: boolean;
  statusLoading: boolean;
  login: (email: string, password: string, role?: UserRole) => Promise<User>;
  register: (payload: { name: string; email: string; password: string; phone: string; zone?: string }) => Promise<User>;
  bootstrapAdmin: (payload: { name: string; email: string; password: string; phone?: string }) => Promise<User>;
  logout: () => void;
  updateProfile: (payload: { name: string; phone: string; zone: string }) => Promise<User>;
  refreshAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [adminClaimed, setAdminClaimed] = useState<boolean>(true);
  const [envPasscodeConfigured, setEnvPasscodeConfigured] = useState<boolean>(false);
  const [statusLoading, setStatusLoading] = useState<boolean>(true);

  const refreshAuthStatus = useCallback(async () => {
    try {
      const status = await api.getAuthStatus();
      setAdminClaimed(status.adminClaimed);
      setEnvPasscodeConfigured(status.envPasscodeConfigured);
    } catch {
      // Keep default state on transient error
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuthStatus();
  }, [refreshAuthStatus]);

  const applySession = useCallback((nextToken: string, nextUser: User) => {
    setAuthToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const login = useCallback(
    async (email: string, password: string, role?: UserRole) => {
      const res = await api.login({ email, password, role });
      applySession(res.token, res.user);
      return res.user;
    },
    [applySession]
  );

  const register = useCallback(
    async (payload: { name: string; email: string; password: string; phone: string; zone?: string }) => {
      const res = await api.register(payload);
      applySession(res.token, res.user);
      return res.user;
    },
    [applySession]
  );

  const bootstrapAdmin = useCallback(
    async (payload: { name: string; email: string; password: string; phone?: string }) => {
      const res = await api.bootstrapAdmin(payload);
      applySession(res.token, res.user);
      setAdminClaimed(true);
      return res.user;
    },
    [applySession]
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (payload: { name: string; phone: string; zone: string }) => {
    const res = await api.updateProfile(payload);
    setUser(res.user);
    return res.user;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        adminClaimed,
        envPasscodeConfigured,
        statusLoading,
        login,
        register,
        bootstrapAdmin,
        logout,
        updateProfile,
        refreshAuthStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
