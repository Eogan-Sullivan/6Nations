import { supabase } from '../lib/supabase/client';

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
export const isApiConfigured = !demoMode && Boolean(apiUrl);

function requestId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function gameRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiUrl) throw new Error('The game API is not configured for this build.');
  if (!supabase) throw new Error('Supabase authentication is not configured for this build.');
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !data.session) throw new Error('Sign in again to save your account data.');
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok || body?.error) throw new Error(body?.error?.message ?? 'The game API could not complete that request.');
  return body?.data as T;
}

export function readGame<T>(operation: string, query: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return gameRequest<T>(`/v1/${operation.replaceAll('_', '-')}${suffix}`);
}

export function commandGame<T>(operation: string, input: Record<string, unknown>) {
  return gameRequest<T>(`/v1/${operation.replaceAll('_', '-')}`, {
    method: 'POST',
    body: JSON.stringify({ requestId: requestId(), ...input }),
  });
}

export type Profile = { id: string; displayName: string; reminders?: boolean };

export function getProfile() {
  return gameRequest<Profile | null>('/v1/profile');
}

export function updateProfile(displayName: string, reminders: boolean) {
  return gameRequest<{ updated: boolean }>('/v1/update-profile', {
    method: 'POST',
    body: JSON.stringify({ requestId: requestId(), displayName, reminders }),
  });
}
