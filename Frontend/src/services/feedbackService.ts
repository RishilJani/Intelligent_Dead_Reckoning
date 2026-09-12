import api from './api';

export interface FeedbackUser {
  user_id: number;
  user_name: string;
  email: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FeedbackItem {
  feedback_id: number;
  feedback_text: string;
  is_bug: boolean;
  is_solved?: boolean;
  created_at: string;
  updated_at?: string;
  users?: FeedbackUser;
}

export interface CreateFeedbackPayload {
  user_id?: number | string;
  feedback_text: string;
  is_bug: boolean;
}

export interface UpdateFeedbackPayload {
  feedback_text?: string;
  is_bug?: boolean;
}

/**
 * Fetch all feedbacks for a specific user ID.
 * Route: GET /feedbacks/:user_id
 */
export async function getFeedbacksByUserId(userId: number | string): Promise<FeedbackItem[]> {
  try {
    const response = await api.get(`/feedbacks/${userId}`);
    if (Array.isArray(response.data)) {
      return response.data;
    } else if (response.data && typeof response.data === 'object') {
      // If backend returns a single record
      return [response.data as FeedbackItem];
    }
    return [];
  } catch (err: any) {
    if (err.response?.status === 404) {
      return [];
    }
    throw new Error(err.response?.data?.message || err.message || 'Failed to fetch user feedbacks');
  }
}

/**
 * Add a new feedback (bug report or suggestion).
 * Route: POST /feedbacks
 */
export async function addFeedback(payload: CreateFeedbackPayload): Promise<FeedbackItem> {
  try {
    const response = await api.post('/feedbacks', payload);
    const data = response.data;
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
    return data;
  } catch (err: any) {
    throw new Error(err.response?.data?.message || err.message || 'Failed to submit feedback');
  }
}

/**
 * Update an existing feedback entry.
 * Route: PUT /feedbacks/:feedback_id
 */
export async function updateFeedback(
  feedbackId: number | string,
  payload: UpdateFeedbackPayload
): Promise<FeedbackItem> {
  try {
    const response = await api.put(`/feedbacks/${feedbackId}`, payload);
    return response.data;
  } catch (err: any) {
    throw new Error(err.response?.data?.message || err.message || 'Failed to update feedback');
  }
}

/**
 * Delete a feedback entry.
 * Route: DELETE /feedbacks/:feedback_id
 */
export async function deleteFeedback(feedbackId: number | string): Promise<void> {
  try {
    await api.delete(`/feedbacks/${feedbackId}`);
  } catch (err: any) {
    throw new Error(err.response?.data?.message || err.message || 'Failed to delete feedback');
  }
}
