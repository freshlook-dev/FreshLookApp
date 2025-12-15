'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

type AuditLog = {
  id: string;
  action: string;
  created_at: string;
  actorEmail: string;
  targetEmail?: string;
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} • ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

export default function AuditLogScreen() {
  const { user } = useAuth();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;

    const init = async () => {
      setLoading(true);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'owner') {
        setIsOwner(false);
        return;
      }

      setIsOwner(true);

      const { data: rows } = await supabase
        .from('audit_logs')
        .select('id, action, created_at, actor_id, target_id')
        .order('created_at', { ascending: false });

      if (!rows) {
        setLogs([]);
        return;
      }

      const ids = Array.from(
        new Set(
          rows.flatMap(r => [r.actor_id, r.target_id]).filter(Boolean)
        )
      ) as string[];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', ids);

      const map: Record<string, string> = {};
      profiles?.forEach(p => (map[p.id] = p.email));

      setLogs(
        rows.map(r => ({
          id: r.id,
          action: r.action,
          created_at: r.created_at,
          actorEmail: r.actor_id ? map[r.actor_id] ?? 'Unknown' : 'System',
          targetEmail: r.target_id ? map[r.target_id] : undefined,
        }))
      );

      setLoading(false);
    };

    init();
  }, [user]);

  // 🔁 Redirect AFTER render (safe)
  useEffect(() => {
    if (isOwner === false) {
      router.replace('/(tabs)');
    }
  }, [isOwner]);

  if (!user || loading || isOwner === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#C9A24D" />
        <Text style={styles.loadingText}>Loading audit logs…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Audit Log</Text>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.action}>{item.action}</Text>
            <Text style={styles.meta}>👤 {item.actorEmail}</Text>
            {item.targetEmail && (
              <Text style={styles.meta}>🎯 {item.targetEmail}</Text>
            )}
            <Text style={styles.time}>
              {formatDateTime(item.created_at)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F4',
    padding: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#7A7A7A',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  action: {
    fontSize: 15,
    fontWeight: '800',
  },
  meta: {
    fontSize: 13,
    marginTop: 4,
    color: '#555',
  },
  time: {
    fontSize: 12,
    marginTop: 6,
    color: '#7A7A7A',
  },
});
