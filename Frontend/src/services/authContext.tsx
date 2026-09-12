import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  API_BASE_URL,
  signupUserApi,
  loginUserApi,
  setAuthToken,
  getAuthToken,
  UserData,
} from './api';

export interface User {
  username: string;
  email: string;
  id?: string | number;
  phone?: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isGuest: boolean;
  apiUrl: string;
  signup: (
    username: string,
    email: string,
    password: string,
    confirmPassword: string
  ) => Promise<{ success: boolean; error?: string }>;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'nav_current_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // By default, new users start in Guest Mode
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(true);

  // Load previously saved session on startup
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedToken = getAuthToken();
        const storedUser = window.localStorage.getItem(STORAGE_KEY_USER);

        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
          setToken(storedToken);
          setIsGuest(false);
        }
      }
    } catch (_e) {
      // Graceful fallback for non-storage environments
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
      // Call Central API with Axios (POST /users/signup)
      const res = await signupUserApi({
        user_name: trimmedUser,
        email: trimmedEmail,
        password,
      });

      const returnedUser: User = {
        username: res.data?.user_name || trimmedUser,
        email: res.data?.email || trimmedEmail,
        id: res.data?.user_id,
        phone: res.data?.phone,
      };

      setUser(returnedUser);
      setToken(res.token || null);
      setIsGuest(false);

      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(returnedUser));
        }
      } catch (_e) {}

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to sign up on server.',
      };
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
      // Call Central API with Axios (POST /users/login)
      const res = await loginUserApi({
        email: trimmedEmail,
        password,
      });

      const returnedUser: User = {
        username: res.data?.user_name || trimmedEmail.split('@')[0],
        email: res.data?.email || trimmedEmail,
        id: res.data?.user_id,
        phone: res.data?.phone,
      };

      setUser(returnedUser);
      setToken(res.token || null);
      setIsGuest(false);

      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(returnedUser));
        }
      } catch (_e) {}

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Login failed. Please check credentials or verify backend is running.',
      };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsGuest(true);
    setAuthToken(null);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY_USER);
      }
    } catch (_e) {}
  };

  const continueAsGuest = () => {
    setUser(null);
    setToken(null);
    setIsGuest(true);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isGuest,
        apiUrl: API_BASE_URL,
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
