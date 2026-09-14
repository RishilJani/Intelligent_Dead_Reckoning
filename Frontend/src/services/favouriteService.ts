import api from './api';
import { getCachedUserId } from './userCache';

export interface FavouriteItem {
  fav_id: number;
  fav_name: string;
  latitude: string | number;
  longitude: string | number;
  user_id: number;
  created_at?: string;
}

export interface AddFavouritePayload {
  user_id?: number | string;
  fav_name: string;
  latitude: number | string;
  longitude: number | string;
}

/**
 * Fetch all favourite places for a specific user ID.
 * Route: GET /favourites/:user_id
 */
export async function getFavouritesByUserId(userId?: number | string): Promise<FavouriteItem[]> {
  const resolvedId = userId || getCachedUserId();
  if (!resolvedId) {
    return [];
  }

  try {
    const response = await api.get(`/favourites/${resolvedId}`);
    if (Array.isArray(response.data)) {
      return response.data;
    } else if (response.data && typeof response.data === 'object') {
      return [response.data as FavouriteItem];
    }
    return [];
  } catch (err: any) {
    if (err.response?.status === 404) {
      return [];
    }
    throw new Error(err.response?.data?.message || err.message || 'Failed to fetch favourites');
  }
}

/**
 * Add a favourite place.
 * Route: POST /favourites/
 * Parameters: user_id, fav_name, latitude, longitude
 */
export async function addFavourite(payload: AddFavouritePayload): Promise<FavouriteItem> {
  const resolvedUserId = payload.user_id || getCachedUserId();
  if (!resolvedUserId) {
    throw new Error('User is not logged in. User ID not found in cache.');
  }

  const body = {
    user_id: resolvedUserId,
    fav_name: payload.fav_name.trim(),
    latitude: String(payload.latitude),
    longitude: String(payload.longitude),
  };

  try {
    const response = await api.post('/favourites', body);
    const data = response.data;
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
    return data;
  } catch (err: any) {
    throw new Error(err.response?.data?.message || err.message || 'Failed to add favourite place');
  }
}

/**
 * Delete a favourite place.
 * Route: DELETE /favourites/:fav_id
 */
export async function deleteFavourite(favId: number | string): Promise<void> {
  try {
    await api.delete(`/favourites/${favId}`);
  } catch (err: any) {
    throw new Error(err.response?.data?.message || err.message || 'Failed to delete favourite place');
  }
}
