// ABOUTME: Shared auth context — holds the app JWT and user profile for the whole tree.
// ABOUTME: Exposes login (exchange Google credential for app JWT) and logout helpers.
import { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

const TOKEN_KEY = 'app_token';
const USER_KEY = 'app_user';

const baseURL = import.meta.env.VITE_API_URL || '';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [user, setUserState] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  const login = useCallback(async (googleCredential) => {
    const { data } = await axios.post(`${baseURL}/api/auth/google`, {
      credential: googleCredential,
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setTokenState(data.token);
    setUserState(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setTokenState('');
    setUserState(null);
  }, []);

  const value = { token, user, isAuthenticated: !!token, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
