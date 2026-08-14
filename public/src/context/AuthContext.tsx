import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { AuthState } from '../types/user';

interface AuthContextType extends AuthState {
  login: (credentials: { username: string; password: string; twoFactorPassword?: string }) => Promise<unknown>;
  register: (data: { username: string; password: string; termsAccepted: boolean }) => Promise<unknown>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<AuthState>) => void;
  loadAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { auth, login, register, logout, updateProfile, loadAuth } = useAuth();

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  return (
    <AuthContext.Provider value={{ ...auth, login, register, logout, updateProfile, loadAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within AuthProvider');
  return context;
};