/**
 * Pilotly API Client — Connects React Frontend to FastAPI Backend at http://localhost:8000/api/v1
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

// Token helper
export function getAuthToken() {
  return localStorage.getItem('pilotly_jwt_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('pilotly_jwt_token', token);
  } else {
    localStorage.removeItem('pilotly_jwt_token');
  }
}

// Universal fetch wrapper
async function apiFetch(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(errorData.detail || `API Error: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn(`[API Client Warning] ${endpoint}: ${err.message}`);
    throw err;
  }
}

// Auth APIs
export async function setupTestUser() {
  const data = await apiFetch('/auth/setup-test', { method: 'POST' });
  if (data.access_token) {
    setAuthToken(data.access_token);
  }
  return data;
}

export async function fetchCurrentUser() {
  return await apiFetch('/auth/me');
}

// Reels APIs
export async function fetchReels() {
  return await apiFetch('/reels/');
}

export async function fetchReelDetail(reelId) {
  return await apiFetch(`/reels/${reelId}`);
}

export async function triggerReelSync() {
  return await apiFetch('/reels/sync', { method: 'POST' });
}

export async function analyzeReel(reelId) {
  return await apiFetch(`/reels/${reelId}/analyze`, { method: 'POST' });
}

// Comments & Replies APIs
export async function fetchComments(statusFilter = null) {
  const query = statusFilter ? `?status_filter=${statusFilter}` : '';
  return await apiFetch(`/comments/${query}`);
}

export async function generateAiReply(commentId) {
  return await apiFetch(`/comments/${commentId}/reply`, { method: 'POST' });
}

export async function approveReply(commentId, replyText = null) {
  const options = { method: 'POST' };
  if (replyText !== null) {
    options.body = JSON.stringify({ reply_text: replyText });
  }
  return await apiFetch(`/comments/${commentId}/approve`, options);
}

export async function rejectReply(commentId) {
  return await apiFetch(`/comments/${commentId}/reject`, { method: 'POST' });
}

// User Settings APIs
export async function updateUserSettings(settings) {
  return await apiFetch('/users/me/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// Demo API (unauthenticated — for landing page "Try before connecting" widget)
export async function draftDemoReply(comment, productContext = '') {
  const res = await fetch(`${API_BASE}/demo/draft-reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment, product_context: productContext }),
  });
  if (!res.ok) {
    throw new Error('Failed to generate demo reply');
  }
  return await res.json();
}

export async function scanVoiceProfile() {
  return await apiFetch('/users/me/scan-voice-profile', { method: 'POST' });
}

