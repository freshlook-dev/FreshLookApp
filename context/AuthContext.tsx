'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { registerPushToken } from '../utils/pushNotifications';
import { syncClientAppointmentReminders } from '../utils/appointmentReminders';

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
  points: number | null;
  is_active: boolean | null;
};

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  logout: async () => {},
});

const PROFILE_SELECT =
  'id, email, full_name, phone, avatar_url, role, points, is_active';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', user.id)
      .single();

    if (data?.is_active === false) {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {}
      setUser(null);
      setProfile(null);
      return;
    }

    setProfile(data ?? null);
  };

  useEffect(() => {
    let mounted = true;

    const applySession = async (session: Session | null) => {
      if (!mounted) return;

      const nextUser = session?.user ?? null;

      if (!nextUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT)
        .eq('id', nextUser.id)
        .single();

      if (!mounted) return;

      if (data?.is_active === false) {
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {}
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(nextUser);
      setProfile(data ?? null);
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
          setProfile(null);
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

    registerPushToken(user.id).catch((error: unknown) => {
      console.warn('Push notification registration failed', error);
    });

    if (profile?.role === 'client') {
      syncClientAppointmentReminders(user.id).catch((error: unknown) => {
        console.warn('Appointment reminder sync failed', error);
      });
    }

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
        () => {
          refreshProfile();
        }
      )
      .subscribe();

    const appointmentChannel =
      profile?.role === 'client'
        ? supabase
            .channel(`client-reminders-${user.id}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'appointments',
                filter: `user_id=eq.${user.id}`,
              },
              () => {
                syncClientAppointmentReminders(user.id).catch((error: unknown) => {
                  console.warn('Appointment reminder sync failed', error);
                });
              }
            )
            .subscribe()
        : null;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onVisible = () => {
        if (document.visibilityState === 'visible') refreshProfile();
      };

      window.addEventListener('focus', refreshProfile);
      document.addEventListener('visibilitychange', onVisible);

      return () => {
        window.removeEventListener('focus', refreshProfile);
        document.removeEventListener('visibilitychange', onVisible);
        supabase.removeChannel(channel);
        if (appointmentChannel) supabase.removeChannel(appointmentChannel);
      };
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshProfile();
    });

    return () => {
      subscription.remove();
      supabase.removeChannel(channel);
      if (appointmentChannel) supabase.removeChannel(appointmentChannel);
    };
  }, [user?.id, profile?.role]);

  const logout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {}
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, refreshProfile, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
