import { createContext, useContext, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type ClientProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  points: number | null;
  is_active: boolean | null;
};

type AuthContextType = {
  user: User | null;
  profile: ClientProfile | null;
  loading: boolean;
  authError: string | null;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  authError: null,
  refreshProfile: async () => {},
  logout: async () => {},
});

async function loadClientProfile(userId: string) {
  return supabase
    .from('profiles')
    .select('id, email, full_name, phone, role, points, is_active')
    .eq('id', userId)
    .single();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const applySession = async (session: Session | null) => {
    const nextUser = session?.user ?? null;

    if (!nextUser) {
      setUser(null);
      setProfile(null);
      setAuthError(null);
      setLoading(false);
      return;
    }

    const { data, error } = await loadClientProfile(nextUser.id);

    if (error || !data) {
      await supabase.auth.signOut({ scope: 'local' });
      setUser(null);
      setProfile(null);
      setAuthError('We could not load your FreshLook profile.');
      setLoading(false);
      return;
    }

    if (data.is_active === false) {
      await supabase.auth.signOut({ scope: 'local' });
      setUser(null);
      setProfile(null);
      setAuthError('This account is currently inactive.');
      setLoading(false);
      return;
    }

    if (data.role !== 'client') {
      await supabase.auth.signOut({ scope: 'local' });
      setUser(null);
      setProfile(null);
      setAuthError('This app is only for FreshLook clients. Please use the staff app.');
      setLoading(false);
      return;
    }

    setUser(nextUser);
    setProfile(data);
    setAuthError(null);
    setLoading(false);
  };

  const refreshProfile = async () => {
    if (!user?.id) return;
    const { data } = await loadClientProfile(user.id);
    if (data?.role === 'client' && data.is_active !== false) {
      setProfile(data);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) await applySession(data.session);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      applySession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`client-profile-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        () => {
          refreshProfile();
        }
      )
      .subscribe();

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('focus', refreshProfile);
      return () => {
        window.removeEventListener('focus', refreshProfile);
        supabase.removeChannel(channel);
      };
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshProfile();
    });

    return () => {
      subscription.remove();
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const logout = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, authError, refreshProfile, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
