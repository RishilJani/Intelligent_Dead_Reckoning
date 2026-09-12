import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';

export interface User {
  username: string;
  email: string;
}

interface StoredAccount extends User {
  password: string;
}

export interface AuthContextType {
  user: User | null;
  isGuest: boolean;
  signup: (username: string, email: string, password: string, confirmPassword: string) => { success: boolean; error?: string };
  login: (email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'nav_current_user';
const STORAGE_KEY_ACCOUNTS = 'nav_registered_accounts';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // New user starts in Guest Mode by default
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(true);
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);

  // Load any previously persisted session on mount (Web)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedAccounts = window.localStorage.getItem(STORAGE_KEY_ACCOUNTS);
        if (storedAccounts) {
          setAccounts(JSON.parse(storedAccounts));
        }
        const storedUser = window.localStorage.getItem(STORAGE_KEY_USER);
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
          setIsGuest(false);
        }
      }
    } catch (_e) {
      // Storage access error or non-browser environment
    }
  }, []);

  const signup = (
    username: string,
    email: string,
    password: string,
    confirmPassword: string
  ): { success: boolean; error?: string } => {
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

    // Check if email already registered
    const existing = accounts.find((a) => a.email === trimmedEmail);
    if (existing) {
      return { success: false, error: 'An account with this email already exists.' };
    }

    const newAccount: StoredAccount = {
      username: trimmedUser,
      email: trimmedEmail,
      password,
    };

    const updatedAccounts = [...accounts, newAccount];
    setAccounts(updatedAccounts);

    const newUser: User = { username: trimmedUser, email: trimmedEmail };
    setUser(newUser);
    setIsGuest(false);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(updatedAccounts));
        window.localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
      }
    } catch (_e) {}

    return { success: true };
  };

  const login = (
    email: string,
    password: string
  ): { success: boolean; error?: string } => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      return { success: false, error: 'Please enter your email.' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password.' };
    }

    const account = accounts.find((a) => a.email === trimmedEmail);
    if (!account) {
      // If no account found, also allow quick-login for demo if accounts list is empty or matching
      if (accounts.length === 0) {
        // Automatically create account for convenience if demo
        const demoUser: User = {
          username: trimmedEmail.split('@')[0],
          email: trimmedEmail,
        };
        setUser(demoUser);
        setIsGuest(false);
        return { success: true };
      }
      return { success: false, error: 'No account found with this email. Please sign up first.' };
    }

    if (account.password !== password) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    const loggedInUser: User = { username: account.username, email: account.email };
    setUser(loggedInUser);
    setIsGuest(false);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(loggedInUser));
      }
    } catch (_e) {}

    return { success: true };
  };

  const logout = () => {
    setUser(null);
    setIsGuest(true);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY_USER);
      }
    } catch (_e) {}
  };

  const continueAsGuest = () => {
    setUser(null);
    setIsGuest(true);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
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
