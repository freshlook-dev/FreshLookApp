'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { registerPushToken, unregisterPushToken } from '../utils/pushNotifications';
import {
  clearClientAppointmentReminders,
  syncClientAppointmentReminders,
} from '../utils/appointmentReminders';

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
const APP_ROLES = new Set(['client', 'staff', 'manager', 'owner']);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const activeUserIdRef = useRef<string | null>(null);
  const activeClientUserIdRef = useRef<string | null>(null);
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

  const clearReminders = (userId: string | null | undefined) => {
    if (!userId) return;
    clearClientAppointmentReminders(userId).catch((error: unknown) => {
      console.warn('Appointment reminder cleanup failed', error);
    });
  };

  const refreshProfile = async () => {
    const userId = user?.id;
    if (!userId) return;

    const requestId = ++profileRequestRef.current;

    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', userId)
      .single();

    if (
      !mountedRef.current ||
      requestId !== profileRequestRef.current ||
      activeUserIdRef.current !== userId
    ) {
      return;
    }

    // Keep the last verified profile during a temporary network failure.
    if (error || !data) return;

    if (data.is_active === false || !APP_ROLES.has(data.role ?? '')) {
      activeClientUserIdRef.current = null;
      clearReminders(userId);
      activeUserIdRef.current = null;
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {}
      if (!mountedRef.current || activeUserIdRef.current !== null) return;
      setUser(null);
      setProfile(null);
      return;
    }

    activeClientUserIdRef.current =
      data.role === 'client' ? userId : null;
    if (profile?.role === 'client' && data.role !== 'client') {
      clearReminders(userId);
    }
    setProfile(data);
  };

  useEffect(() => {
    let mounted = true;

    const applySession = async (session: Session | null) => {
      const requestId = ++authRequestRef.current;
      if (!mounted || !mountedRef.current) return;

      const previousUserId = activeUserIdRef.current;
      const nextUser = session?.user ?? null;

      if (!nextUser) {
        clearReminders(previousUserId);
        activeUserIdRef.current = null;
        activeClientUserIdRef.current = null;
        profileRequestRef.current += 1;
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT)
        .eq('id', nextUser.id)
        .single();

      if (
        !mounted ||
        !mountedRef.current ||
        requestId !== authRequestRef.current
      ) {
        return;
      }

      if (
        error ||
        !data ||
        data.is_active === false ||
        !APP_ROLES.has(data.role ?? '')
      ) {
        activeClientUserIdRef.current = null;
        clearReminders(nextUser.id);
        if (previousUserId !== nextUser.id) clearReminders(previousUserId);
        activeUserIdRef.current = null;
        profileRequestRef.current += 1;
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {}
        if (
          !mounted ||
          !mountedRef.current ||
          (requestId !== authRequestRef.current &&
            activeUserIdRef.current !== null)
        ) {
          return;
        }
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (previousUserId !== nextUser.id) clearReminders(previousUserId);
      activeUserIdRef.current = nextUser.id;
      activeClientUserIdRef.current =
        data.role === 'client' ? nextUser.id : null;
      setUser(nextUser);
      setProfile(data);
      setLoading(false);
    };

    const initAuth = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        // A stale refresh token can remain in device storage after the server-side
        // session expires. Clear only the local session and continue as a guest.
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {}
        await applySession(null);
        return;
      }

      await applySession(data.session);
    };

    initAuth().catch(() => {
      void applySession(null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT') {
          clearReminders(activeUserIdRef.current);
          authRequestRef.current += 1;
          profileRequestRef.current += 1;
          activeUserIdRef.current = null;
          activeClientUserIdRef.current = null;
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        void applySession(session);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let effectActive = true;
    const userId = user.id;

    void registerPushToken(userId)
      .catch((error: unknown) => {
        console.warn('Push notification registration failed', error);
      })
      .finally(() => {
        if (
          !effectActive ||
          activeClientUserIdRef.current !== userId
        ) {
          return;
        }
        syncClientAppointmentReminders(userId).catch((error: unknown) => {
          console.warn('Appointment reminder sync failed', error);
        });
      });

    const channel = supabase
      .channel(`profile-access-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        () => {
          refreshProfile();
        }
      )
      .subscribe();

    const appointmentChannel =
      profile?.role === 'client'
        ? supabase
            .channel(`client-reminders-${userId}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'appointments',
                filter: `user_id=eq.${userId}`,
              },
              () => {
                if (activeClientUserIdRef.current !== userId) return;
                syncClientAppointmentReminders(userId).catch((error: unknown) => {
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
        effectActive = false;
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
      effectActive = false;
      subscription.remove();
      supabase.removeChannel(channel);
      if (appointmentChannel) supabase.removeChannel(appointmentChannel);
    };
  }, [user?.id, profile?.role]);

  const logout = async () => {
    const userId = activeUserIdRef.current ?? user?.id;
    authRequestRef.current += 1;
    profileRequestRef.current += 1;
    activeUserIdRef.current = null;
    activeClientUserIdRef.current = null;
    if (userId) {
      try {
        await clearClientAppointmentReminders(userId);
      } catch (error) {
        console.warn('Appointment reminder cleanup failed', error);
      }
    }
    try {
      await unregisterPushToken();
    } catch (error) {
      console.warn('Push notification cleanup failed', error);
    }
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {}
    if (!mountedRef.current) return;
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
