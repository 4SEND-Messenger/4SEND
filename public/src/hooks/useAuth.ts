import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { initPush, clearPushToken } from '../services/push';
import { saveCurrentAccount } from '../services/storage';
import { getCryptoKey } from '../utils/crypto/keyStore';
import { updateSocketToken } from '../services/socket';
import type { AuthState, LoginCredentials, RegisterData } from '../types/user';

function isEncryptedToken(raw: string): boolean {
  try {
    const p = JSON.parse(raw);
    return p && typeof p === 'object' && p.v === 2 && typeof p.data === 'string' && typeof p.iv === 'string' && typeof p.aad === 'string';
  } catch { return false; }
}

const initialState: AuthState = {
  me: null,
  token: null,
  displayName: null,
  avatar: null,
  isVerified: false,
  role: 'user',
  isLoading: true,
  isAuthenticated: false
};

export const useAuth = () => {
  const [auth, setAuth] = useState<AuthState>(initialState);

  const loadAuth = useCallback(async () => {
    const rawToken = localStorage.getItem('4send_token');
    const user = localStorage.getItem('4send_user');
    if (!rawToken || !user) {
      setAuth({ ...initialState, isLoading: false });
      return;
    }

    const tokenIsEncrypted = isEncryptedToken(rawToken);
    if (tokenIsEncrypted && !getCryptoKey()) {
      setAuth({
        me: user,
        token: null,
        displayName: user,
        avatar: localStorage.getItem('4send_avatar'),
        isVerified: localStorage.getItem('4send_isVerified') === '1',
        role: localStorage.getItem('4send_role') || 'user',
        isLoading: false,
        isAuthenticated: false
      });
      return;
    }

    setAuth({
      me: user,
      token: tokenIsEncrypted ? '__encrypted__' : rawToken,
      displayName: user,
      avatar: localStorage.getItem('4send_avatar'),
      isVerified: localStorage.getItem('4send_isVerified') === '1',
      role: localStorage.getItem('4send_role') || 'user',
      isLoading: false,
      isAuthenticated: true
    });
    updateSocketToken();
    initPush().catch(() => {});
    try {
      const profile = await api.get<{ displayName?: string; avatar?: string; isVerified?: boolean }>(`/api/status/${encodeURIComponent(user)}`);
      const displayName = profile.displayName?.trim() || '';
      if (displayName) localStorage.setItem('4send_displayName', displayName);
      else localStorage.removeItem('4send_displayName');
      if (profile.avatar) localStorage.setItem('4send_avatar', profile.avatar);
      else localStorage.removeItem('4send_avatar');
      localStorage.setItem('4send_isVerified', profile.isVerified ? '1' : '0');
      setAuth(prev => prev.me === user ? {
        ...prev,
        displayName: displayName || user,
        avatar: profile.avatar || null,
        isVerified: !!profile.isVerified,
      } : prev);
      try { await saveCurrentAccount(); } catch {}
    } catch {}
  }, []);

  useEffect(() => { loadAuth(); }, [loadAuth]);

  useEffect(() => {
    let handling = false;
    const handleSessionExpired = () => {
      if (handling) return;
      handling = true;
      (async () => {
        await clearPushToken().catch(() => {});
        localStorage.clear();
        updateSocketToken();
        setAuth({ ...initialState, isLoading: false });
        handling = false;
      })();
    };
    window.addEventListener('4send:session-expired', handleSessionExpired);
    return () => window.removeEventListener('4send:session-expired', handleSessionExpired);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const res = await api.post<{ username: string; token: string; avatar?: string; isVerified?: boolean; displayName?: string }>('/auth/login', credentials);
    if (res.token) {
      localStorage.setItem('4send_token', res.token);
      localStorage.setItem('4send_user', res.username);
      if (res.avatar) localStorage.setItem('4send_avatar', res.avatar);
      else localStorage.removeItem('4send_avatar');
      if (res.isVerified) localStorage.setItem('4send_isVerified', '1');
      else localStorage.removeItem('4send_isVerified');
      if (res.displayName) localStorage.setItem('4send_displayName', res.displayName);
      else localStorage.removeItem('4send_displayName');
      loadAuth();
    }
    return res;
  };

  const register = async (data: RegisterData) => {
    const res = await api.post<{ username: string; token: string; avatar?: string; isVerified?: boolean; displayName?: string }>('/auth/register', data);
    if (res.token) {
      localStorage.setItem('4send_token', res.token);
      localStorage.setItem('4send_user', res.username);
      if (res.avatar) localStorage.setItem('4send_avatar', res.avatar);
      else localStorage.removeItem('4send_avatar');
      if (res.isVerified) localStorage.setItem('4send_isVerified', '1');
      else localStorage.removeItem('4send_isVerified');
      if (res.displayName) localStorage.setItem('4send_displayName', res.displayName);
      else localStorage.removeItem('4send_displayName');
      loadAuth();
    }
    return res;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {}
    await clearPushToken().catch(() => {});
    localStorage.clear();
    loadAuth();
  };

  const updateProfile = (data: Partial<AuthState>) => {
    setAuth(prev => ({ ...prev, ...data }));
  };

  return { auth, login, register, logout, updateProfile, loadAuth };
};
