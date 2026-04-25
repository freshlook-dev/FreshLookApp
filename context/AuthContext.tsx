'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from './supabase';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const applySession = async (session: Session | null) => {
      if (!mounted) return;

      const nextUser = session?.user ?? null;

      if (!nextUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', nextUser.id)
        .single();

      if (!mounted) return;

      if (data?.is_active === false) {
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {}
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(nextUser);
      setLoading(false);
    };

    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      await applySession(data.session);
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
        return;
      }

      applySession(session);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const checkCurrentUserAccess = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', user.id)
        .single();

      if (data?.is_active === false) {
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {}
        setUser(null);
      }
    };

    const channel = supabase
      .channel(`profile-access-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async (payload: any) => {
          if (payload.new?.is_active === false) {
            try {
              await supabase.auth.signOut({ scope: 'local' });
            } catch {}
            setUser(null);
          }
        }
      )
      .subscribe();

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onVisible = () => {
        if (document.visibilityState === 'visible') checkCurrentUserAccess();
      };

      window.addEventListener('focus', checkCurrentUserAccess);
      document.addEventListener('visibilitychange', onVisible);

      return () => {
        window.removeEventListener('focus', checkCurrentUserAccess);
        document.removeEventListener('visibilitychange', onVisible);
        supabase.removeChannel(channel);
      };
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkCurrentUserAccess();
    });

    return () => {
      subscription.remove();
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  /* 🔥 FORCE LOGOUT (CRITICAL) */
  const logout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {}
    setUser(null); // 🔥 FORCE UI UPDATE
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
