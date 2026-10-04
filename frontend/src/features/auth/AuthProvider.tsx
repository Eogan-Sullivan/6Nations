import { AppState } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getProfile, isApiConfigured, updateProfile } from '../../api/client';
import { authRedirectUrl, isSupabaseConfigured, supabase } from '../../lib/supabase/client';
import { authenticatedRedirect } from './routing';

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  onboardingComplete: boolean | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ confirmationRequired: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  completeOnboarding: (displayName: string, reminders: boolean) => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
const configurationError = () => new Error('Supabase authentication is not configured for this build.');
function hasCompletedProfile(profile: { displayName?: string } | null, currentSession: Session | null) {
  const serverName = profile?.displayName?.trim();
  if (serverName && serverName !== 'Player') return true;
  const metadata = currentSession?.user.user_metadata as Record<string, unknown> | undefined;
  return metadata?.onboarding_complete === true || typeof metadata?.display_name === 'string' && metadata.display_name.trim().length > 0;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let mounted = true;
    void client.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      const nextSession = error ? null : data.session;
      setSession(nextSession);
      setOnboardingComplete(nextSession ? null : false);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        setOnboardingComplete(nextSession ? null : false);
      }
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, []);
  useEffect(() => {
    let mounted = true;
    if (!session) {
      setOnboardingComplete(false);
      return () => { mounted = false; };
    }
    if (!isApiConfigured) {
      setOnboardingComplete(false);
      return () => { mounted = false; };
    }
    // A previous signed-out state is not evidence that this account needs
    // onboarding. Keep the router waiting while the account profile loads.
    setOnboardingComplete(null);
    void getProfile().then((profile) => {
      if (mounted) setOnboardingComplete(hasCompletedProfile(profile, session));
    }).catch(() => {
      // Do not send an already-onboarded user back through onboarding when the
      // mobile API is temporarily unreachable. Server profile data remains the
      // source of truth whenever it is available.
      if (mounted) setOnboardingComplete(hasCompletedProfile(null, session) ? true : null);
    });
    return () => { mounted = false; };
  }, [session?.user.id]);
  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw configurationError();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);
  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw configurationError();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return { confirmationRequired: !data.session };
  }, []);
  const requestPasswordReset = useCallback(async (email: string) => {
    if (!supabase) throw configurationError();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl('/reset-password'),
    });
    if (error) throw error;
  }, []);
  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) throw configurationError();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);
  const completeOnboarding = useCallback(async (displayName: string, reminders: boolean) => {
    if (!session) return;
    await updateProfile(displayName, reminders);
    // Keep a small auth-side recovery marker so a temporary profile-read
    // failure cannot repeatedly ask the same user for their display name.
    // The game API profile remains authoritative for normal reads.
    if (supabase) {
      try {
        await supabase.auth.updateUser({
          data: { display_name: displayName, onboarding_complete: true },
        });
      } catch {
        // The API write above is authoritative; this metadata is only a
        // recovery marker for the next profile read.
      }
    }
    setOnboardingComplete(true);
  }, [session]);
  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);
  const value = useMemo(() => ({ configured: isSupabaseConfigured, loading, session, onboardingComplete, signIn, signUp, requestPasswordReset, updatePassword, completeOnboarding, signOut }), [loading, session, onboardingComplete, signIn, signUp, requestPasswordReset, updatePassword, completeOnboarding, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
