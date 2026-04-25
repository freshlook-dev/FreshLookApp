import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { supabase } from '../context/supabase';

type RefreshTable =
  | string
  | {
      table: string;
      event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    };

type AutoRefreshOptions = {
  enabled?: boolean;
  tables?: RefreshTable[];
  channelName?: string;
  debounceMs?: number;
};

const normalizeTable = (table: RefreshTable) =>
  typeof table === 'string' ? { table, event: '*' as const } : table;

export function useAutoRefresh(
  refresh: () => void | Promise<void>,
  {
    enabled = true,
    tables = [],
    channelName = 'auto-refresh',
    debounceMs = 350,
  }: AutoRefreshOptions = {}
) {
  const refreshRef = useRef(refresh);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const tablesKey = useMemo(
    () =>
      tables
        .map((item) => {
          const table = normalizeTable(item);
          return `${table.table}:${table.event ?? '*'}`;
        })
        .join('|'),
    [tables]
  );

  const scheduleRefresh = useCallback(() => {
    if (!enabled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      refreshRef.current();
    }, debounceMs);
  }, [debounceMs, enabled]);

  useFocusEffect(
    useCallback(() => {
      scheduleRefresh();

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, [scheduleRefresh])
  );

  useEffect(() => {
    if (!enabled) return;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onVisible = () => {
        if (document.visibilityState === 'visible') scheduleRefresh();
      };

      window.addEventListener('focus', scheduleRefresh);
      window.addEventListener('freshlook-refresh', scheduleRefresh);
      document.addEventListener('visibilitychange', onVisible);

      return () => {
        window.removeEventListener('focus', scheduleRefresh);
        window.removeEventListener('freshlook-refresh', scheduleRefresh);
        document.removeEventListener('visibilitychange', onVisible);
      };
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleRefresh();
    });

    return () => subscription.remove();
  }, [enabled, scheduleRefresh]);

  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    const channel = supabase.channel(`${channelName}-${tablesKey || 'all'}`);

    tables.map(normalizeTable).forEach(({ table, event = '*' }) => {
      channel.on(
        'postgres_changes',
        { event, schema: 'public', table },
        scheduleRefresh
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, enabled, scheduleRefresh, tablesKey]);
}
