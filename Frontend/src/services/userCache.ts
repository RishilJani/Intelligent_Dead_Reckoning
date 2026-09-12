/**
 * User Cache Service
 * Persists and retrieves user_id, user_name, and user_email in client cache (localStorage).
 */

export interface CachedUser {
  user_id: number | string | null;
  user_name: string | null;
  username: string | null;
  email: string | null;
  user_email: string | null;
  token: string | null;
}

const KEY_USER_ID = 'user_id';
const KEY_USER_NAME = 'user_name';
const KEY_USERNAME = 'username';
const KEY_EMAIL = 'email';
const KEY_USER_EMAIL = 'user_email';
const KEY_TOKEN = 'nav_jwt_token';
const KEY_USER_OBJ = 'nav_current_user';

// In-memory fallback for environments without window.localStorage
const memoryCache: Record<string, string> = {};

function storageGet(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch (_e) {}
  return memoryCache[key] || null;
}

function storageSet(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch (_e) {}
  memoryCache[key] = value;
}

function storageRemove(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch (_e) {}
  delete memoryCache[key];
}

/**
 * Save user credentials and profile to cache upon login/sign up.
 */
export function saveUserToCache(
  user: {
    user_id?: number | string;
    id?: number | string;
    user_name?: string;
    username?: string;
    email?: string;
    user_email?: string;
  },
  token?: string | null
): void {
  const resolvedId = user.user_id != null ? String(user.user_id) : user.id != null ? String(user.id) : '';
  const resolvedName = user.user_name || user.username || '';
  const resolvedEmail = user.email || user.user_email || '';

  if (resolvedId) {
    storageSet(KEY_USER_ID, resolvedId);
  }
  if (resolvedName) {
    storageSet(KEY_USER_NAME, resolvedName);
    storageSet(KEY_USERNAME, resolvedName);
  }
  if (resolvedEmail) {
    storageSet(KEY_EMAIL, resolvedEmail);
    storageSet(KEY_USER_EMAIL, resolvedEmail);
  }
  if (token) {
    storageSet(KEY_TOKEN, token);
  }

  // Also preserve structured object
  storageSet(
    KEY_USER_OBJ,
    JSON.stringify({
      user_id: resolvedId ? Number(resolvedId) || resolvedId : undefined,
      id: resolvedId ? Number(resolvedId) || resolvedId : undefined,
      user_name: resolvedName,
      username: resolvedName,
      email: resolvedEmail,
      user_email: resolvedEmail,
    })
  );
}

/**
 * Retrieve cached user information.
 */
export function getUserFromCache(): CachedUser {
  let userId: string | null = storageGet(KEY_USER_ID);
  let userName: string | null = storageGet(KEY_USER_NAME) || storageGet(KEY_USERNAME);
  let email: string | null = storageGet(KEY_EMAIL) || storageGet(KEY_USER_EMAIL);
  const token: string | null = storageGet(KEY_TOKEN);

  // If discrete keys weren't found, try parsing nav_current_user
  if (!userId || !userName || !email) {
    const rawObj = storageGet(KEY_USER_OBJ);
    if (rawObj) {
      try {
        const parsed = JSON.parse(rawObj);
        if (!userId && (parsed.user_id || parsed.id)) {
          userId = String(parsed.user_id || parsed.id);
        }
        if (!userName && (parsed.user_name || parsed.username)) {
          userName = parsed.user_name || parsed.username;
        }
        if (!email && (parsed.email || parsed.user_email)) {
          email = parsed.email || parsed.user_email;
        }
      } catch (_e) {}
    }
  }

  return {
    user_id: userId ? (isNaN(Number(userId)) ? userId : Number(userId)) : null,
    user_name: userName,
    username: userName,
    email,
    user_email: email,
    token,
  };
}

/**
 * Get current cached user ID.
 */
export function getCachedUserId(): number | string | null {
  return getUserFromCache().user_id;
}

/**
 * Clear user cache upon logout.
 */
export function clearUserCache(): void {
  storageRemove(KEY_USER_ID);
  storageRemove(KEY_USER_NAME);
  storageRemove(KEY_USERNAME);
  storageRemove(KEY_EMAIL);
  storageRemove(KEY_USER_EMAIL);
  storageRemove(KEY_TOKEN);
  storageRemove(KEY_USER_OBJ);
}

// -------------------------------------------------------------
// GPS Location Cache
// -------------------------------------------------------------
export interface CachedLocation {
  lat: number;
  lon: number;
  accuracy?: number;
  heading?: number;
  speedKmh?: number;
  name?: string;
  timestamp: number;
}

const KEY_LAST_LOCATION = 'nav_last_known_location';

/**
 * Save user's verified GPS position to persistent storage.
 */
export function saveLastKnownLocation(location: {
  lat: number;
  lon: number;
  accuracy?: number;
  heading?: number;
  speedKmh?: number;
  name?: string;
}): void {
  // Guard against caching unconfirmed default placeholder
  if (
    Math.abs(location.lat - 28.6139) < 0.0001 &&
    Math.abs(location.lon - 77.2090) < 0.0001
  ) {
    return;
  }
  const payload: CachedLocation = {
    ...location,
    timestamp: Date.now(),
  };
  storageSet(KEY_LAST_LOCATION, JSON.stringify(payload));
}

/**
 * Retrieve user's last known verified GPS position.
 */
export function getLastKnownLocation(): CachedLocation | null {
  const raw = storageGet(KEY_LAST_LOCATION);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.lat === 'number' &&
      typeof parsed.lon === 'number' &&
      (Math.abs(parsed.lat - 28.6139) > 0.0001 || Math.abs(parsed.lon - 77.2090) > 0.0001)
    ) {
      return parsed;
    }
  } catch (_e) {}
  return null;
}

