import { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  const mountedRef = useRef(true);
  const activeUserIdRef = useRef<string | null>(null);
  const authRequestRef = useRef(0);
  const profileRequestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      authRequestRef.current += 1;
      profileRequestRef.current += 1;
    };
  }, []);

  const applySession = async (session: Session | null) => {
    const requestId = ++authRequestRef.current;
    if (!mountedRef.current) return;

    const nextUser = session?.user ?? null;

    if (!nextUser) {
      activeUserIdRef.current = null;
      profileRequestRef.current += 1;
      setUser(null);
      setProfile(null);
      setAuthError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await loadClientProfile(nextUser.id);

    if (
      !mountedRef.current ||
      requestId !== authRequestRef.current
    ) {
      return;
    }

    if (error || !data) {
      activeUserIdRef.current = null;
      profileRequestRef.current += 1;
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {}
      if (!mountedRef.current || activeUserIdRef.current !== null) return;
      setUser(null);
      setProfile(null);
      setAuthError('We could not load your FreshLook profile.');
      setLoading(false);
      return;
    }

    if (data.is_active === false) {
      activeUserIdRef.current = null;
      profileRequestRef.current += 1;
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {}
      if (!mountedRef.current || activeUserIdRef.current !== null) return;
      setUser(null);
      setProfile(null);
      setAuthError('This account is currently inactive.');
      setLoading(false);
      return;
    }

    if (data.role !== 'client') {
      activeUserIdRef.current = null;
      profileRequestRef.current += 1;
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {}
      if (!mountedRef.current || activeUserIdRef.current !== null) return;
      setUser(null);
      setProfile(null);
      setAuthError('This app is only for FreshLook clients. Please use the staff app.');
      setLoading(false);
      return;
    }

    activeUserIdRef.current = nextUser.id;
    setUser(nextUser);
    setProfile(data);
    setAuthError(null);
    setLoading(false);
  };

  const refreshProfile = async () => {
    const userId = user?.id;
    if (!userId) return;

    const requestId = ++profileRequestRef.current;
    const { data, error } = await loadClientProfile(userId);

    if (
      !mountedRef.current ||
      requestId !== profileRequestRef.current ||
      activeUserIdRef.current !== userId
    ) {
      return;
    }

    // Preserve the last verified profile during a temporary network failure.
    if (error || !data) return;

    if (data?.role === 'client' && data.is_active !== false) {
      setProfile(data);
      return;
    }

    const nextError =
      data.is_active === false
        ? 'This account is currently inactive.'
        : 'This app is only for FreshLook clients. Please use the staff app.';

    activeUserIdRef.current = null;
    profileRequestRef.current += 1;
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {}
    if (!mountedRef.current || activeUserIdRef.current !== null) return;
    setUser(null);
    setProfile(null);
    setAuthError(nextError);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {}
        if (mounted) await applySession(null);
        return;
      }

      if (mounted) await applySession(data.session);
    };

    void init().catch(() => {
      if (mounted) void applySession(null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      void applySession(session);
    });

    return () => {
      mounted = false;
      authRequestRef.current += 1;
      profileRequestRef.current += 1;
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
    authRequestRef.current += 1;
    profileRequestRef.current += 1;
    activeUserIdRef.current = null;
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {}
    if (!mountedRef.current) return;
    setUser(null);
    setProfile(null);
    setAuthError(null);
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
