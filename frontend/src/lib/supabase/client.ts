import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

export const isSupabaseConfigured = !demoMode && Boolean(url && publishableKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, publishableKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;

export function authRedirectUrl(path: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return new URL(path, window.location.origin).toString();
  }
  return Linking.createURL(path.replace(/^\//, ''));
}
