// ABOUTME: Auth state hook — reads/writes the app JWT and user profile from localStorage.
// ABOUTME: Exposes login (exchange Google credential for app JWT) and logout helpers.
import { useState, useCallback } from 'react';
import axios from 'axios';

const TOKEN_KEY = 'app_token';
const USER_KEY = 'app_user';

const baseURL = import.meta.env.VITE_API_URL || '';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function useAuth() {
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

  return { token, user, isAuthenticated: !!token, login, logout };
}
