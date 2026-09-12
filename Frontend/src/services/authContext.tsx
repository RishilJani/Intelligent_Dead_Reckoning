import React, { createContext, useContext, useEffect, useState } from 'react';
import api from './api';

export interface User {
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
        if (storedUser) {
          setUser(JSON.parse(storedUser));
          setIsGuest(false);
        }
        if (storedToken) {
          setToken(storedToken);
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
        const newUser: User = {
          username: response.data.data?.user_name || trimmedUser,
          email: response.data.data?.email || trimmedEmail,
        };
        const authToken = response.data.token || null;

        setUser(newUser);
        setToken(authToken);
        setIsGuest(false);

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
    console.log("Frontend login 1....");

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
      console.log("Frontend login 2....");
      if (response.data && response.data.success) {
        const loggedInUser: User = {
          username: response.data.data?.user_name || trimmedEmail.split('@')[0],
          email: response.data.data?.email || trimmedEmail,
        };
        const authToken = response.data.token || null;
        console.log("Frontend login 3....");

        setUser(loggedInUser);
        setToken(authToken);
        setIsGuest(false);

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
