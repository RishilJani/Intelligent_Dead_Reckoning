import React, { createContext, useContext, useEffect, useState } from 'react';
import api from './api';

export interface User {
  id?: number | string;
  user_id?: number | string;
  username: string;
  email: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isGuest: boolean;
  signup: (username: string, email: string, password: string, confirmPassword: string) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'nav_current_user';
const STORAGE_KEY_TOKEN = 'nav_jwt_token';

function decodeBase64(input: string): string {
  if (typeof globalThis !== 'undefined' && typeof (globalThis as any).atob === 'function') {
    return (globalThis as any).atob(input);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const str = input.replace(/=+$/, '');
  let output = '';
  let bs = 0;
  let bc = 0;
  for (let idx = 0; idx < str.length; idx++) {
    const charIdx = chars.indexOf(str.charAt(idx));
    if (charIdx === -1) continue;
    bs = bc % 4 ? bs * 64 + charIdx : charIdx;
    if (bc++ % 4) {
      output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
    }
  }
  return output;
}

function extractUserIdFromToken(token: string): number | string | undefined {
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonStr = decodeBase64(base64);
      const payload = JSON.parse(jsonStr);
      return payload.user_id || payload.id;
    }
  } catch (_e) { }
  return undefined;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(true);

  // Load any previously persisted session on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedUser = window.localStorage.getItem(STORAGE_KEY_USER);
        const storedToken = window.localStorage.getItem(STORAGE_KEY_TOKEN);
        if (storedToken) {
          setToken(storedToken);
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          if (storedToken && !parsedUser.user_id) {
            parsedUser.user_id = extractUserIdFromToken(storedToken);
          }
          setUser(parsedUser);
          setIsGuest(false);
        }
      }
    } catch (_e) {
      // Storage access error or non-browser environment
    }
  }, []);

  const signup = async (
    username: string,
    email: string,
    password: string,
    confirmPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    const trimmedUser = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedUser) {
      return { success: false, error: 'Please enter a username.' };
    }
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password || password.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters long.' };
    }
    if (password !== confirmPassword) {
      return { success: false, error: 'Passwords do not match.' };
    }

    try {
      // Call backend signup endpoint: "users/signup"
      const response = await api.post('users/signup', {
        user_name: trimmedUser,
        email: trimmedEmail,
        password,
      });

      if (response.data && response.data.success) {
        const authToken = response.data.token || null;
        const resolvedUserId = response.data.data?.user_id || (authToken ? extractUserIdFromToken(authToken) : undefined);
        const newUser: User = {
          id: resolvedUserId,
          user_id: resolvedUserId,
          username: response.data.data?.user_name || trimmedUser,
          email: response.data.data?.email || trimmedEmail,
        };

        setUser(newUser);
        setToken(authToken);
        setIsGuest(false);

        if (authToken) {
          api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
        }

        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
            if (authToken) {
              window.localStorage.setItem(STORAGE_KEY_TOKEN, authToken);
            }
          }
        } catch (_e) { }

        return { success: true };
      } else {
        return { success: false, error: response.data?.message || 'Failed to sign up.' };
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Unable to connect to server.';
      return { success: false, error: errorMsg };
    }
  };

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      return { success: false, error: 'Please enter your email.' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password.' };
    }

    try {
      // Call backend login endpoint: "users/login"
      const response = await api.post('users/login', {
        email: trimmedEmail,
        password,
      });

      if (response.data && response.data.success) {
        const authToken = response.data.token || null;
        const resolvedUserId = response.data.data?.user_id || (authToken ? extractUserIdFromToken(authToken) : undefined);
        const loggedInUser: User = {
          id: resolvedUserId,
          user_id: resolvedUserId,
          username: response.data.data?.user_name || trimmedEmail.split('@')[0],
          email: response.data.data?.email || trimmedEmail,
        };

        setUser(loggedInUser);
        setToken(authToken);
        setIsGuest(false);

        if (authToken) {
          api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
        }

        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(loggedInUser));
            if (authToken) {
              window.localStorage.setItem(STORAGE_KEY_TOKEN, authToken);
            }
          }
        } catch (_e) { }

        return { success: true };
      } else {
        return { success: false, error: response.data?.message || 'Invalid credentials.' };
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Unable to connect to server.';
      return { success: false, error: errorMsg };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsGuest(true);
    delete api.defaults.headers.common['Authorization'];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY_USER);
        window.localStorage.removeItem(STORAGE_KEY_TOKEN);
      }
    } catch (_e) { }
  };

  const continueAsGuest = () => {
    setUser(null);
    setIsGuest(true);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isGuest,
        signup,
        login,
        logout,
        continueAsGuest,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
