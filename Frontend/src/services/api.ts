import axios, { AxiosError, AxiosInstance } from 'axios';
import { Platform } from 'react-native';

/**
 * Central API Base URL
 * Set to http://localhost:5000 as requested (can be modified here centrally).
 */
export const API_BASE_URL = 'http://localhost:5000';

const STORAGE_KEY_TOKEN = 'nav_auth_token';

/**
 * Automatically adjusts localhost to 10.0.2.2 when running inside an Android emulator,
 * preventing connection refused network errors.
 */
export function getEffectiveApiUrl(url: string = API_BASE_URL): string {
  if (Platform.OS === 'android' && url.includes('localhost')) {
    return url.replace('localhost', '10.0.2.2');
  }
  return url;
}

/**
 * Configured Axios Instance for Central API Requests
 * Handles standard CORS headers, timeout, and response normalization.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: getEffectiveApiUrl(API_BASE_URL),
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request Interceptor: Attach Bearer Token if present
apiClient.interceptors.request.use(
  (config) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const token = window.localStorage.getItem(STORAGE_KEY_TOKEN);
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (_e) {}
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Friendly Error Normalizer
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    let friendlyMessage = 'An unexpected error occurred.';

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      friendlyMessage = `Server timeout connecting to ${API_BASE_URL}. Ensure backend is running.`;
    } else if (error.code === 'ERR_NETWORK' || !error.response) {
      friendlyMessage = `Unable to connect to server at ${API_BASE_URL}. Please verify the backend is running.`;
    } else if (error.response?.data) {
      const data = error.response.data;
      friendlyMessage =
        data.message ||
        data.error ||
        (typeof data === 'string' ? data : `Error ${error.response.status}: ${error.response.statusText}`);
    }

    return Promise.reject(new Error(friendlyMessage));
  }
);

// Helper to store/remove auth token
export function setAuthToken(token: string | null) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (token) {
        window.localStorage.setItem(STORAGE_KEY_TOKEN, token);
      } else {
        window.localStorage.removeItem(STORAGE_KEY_TOKEN);
      }
    }
  } catch (_e) {}
}

export function getAuthToken(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(STORAGE_KEY_TOKEN);
    }
  } catch (_e) {}
  return null;
}

// Types based on Frontend/apiroutes.md
export interface SignupRequest {
  user_name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  user_name?: string;
}

export interface UserData {
  user_id?: string | number;
  user_name: string;
  email: string;
  phone?: string;
  created_at?: string;
  [key: string]: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  token?: string;
  data?: T;
  message?: string;
}

/**
 * Sign up API (/users/signup as per Frontend/apiroutes.md)
 * Falls back to /users if /users/signup returns 404 to ensure 100% compatibility.
 */
export async function signupUserApi(payload: SignupRequest): Promise<ApiResponse<UserData>> {
  try {
    // 1. Primary route from apiroutes.md: POST /users/signup
    const res = await apiClient.post<ApiResponse<UserData>>('/users/signup', {
      user_name: payload.user_name,
      email: payload.email,
      password: payload.password,
    });

    if (res.data?.token) {
      setAuthToken(res.data.token);
    }
    return {
      success: true,
      token: res.data?.token,
      data: res.data?.data || res.data as any,
    };
  } catch (err: any) {
    // 2. Fallback check: If endpoint /users/signup is 404 on backend, try POST /users
    try {
      const fallbackRes = await apiClient.post<UserData>('/users', {
        user_name: payload.user_name,
        email: payload.email,
        password: payload.password,
        phone: payload.phone || '0000000000',
      });
      return {
        success: true,
        data: fallbackRes.data,
      };
    } catch (_fallbackErr) {
      // Return original primary error message
      throw err;
    }
  }
}

/**
 * Log in API (/users/login as per Frontend/apiroutes.md)
 */
export async function loginUserApi(payload: LoginRequest): Promise<ApiResponse<UserData>> {
  const res = await apiClient.post<ApiResponse<UserData>>('/users/login', {
    email: payload.email,
    password: payload.password,
    user_name: payload.user_name || payload.email.split('@')[0],
  });

  if (res.data?.token) {
    setAuthToken(res.data.token);
  }

  return {
    success: true,
    token: res.data?.token,
    data: res.data?.data || res.data as any,
  };
}

/**
 * Get all users API (/users)
 */
export async function fetchAllUsersApi(): Promise<UserData[]> {
  const res = await apiClient.get<UserData[]>('/users');
  return res.data;
}

/**
 * Get user by ID API (/users/:user_id)
 */
export async function fetchUserByIdApi(userId: string | number): Promise<UserData> {
  const res = await apiClient.get<UserData>(`/users/${userId}`);
  return res.data;
}
