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

type Role = 'owner' | 'manager' | 'staff';

type AuditLogRow = {
  id: string;
  action: string;
  created_at: string;
  details: any;
  actor_id: string | null;
  target_id: string | null;
};

type ProfileMap = Record<string, string>;

type AuditLog = {
  id: string;
  action: string;
  created_at: string;
  details: any;
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

  useEffect(() => {
    if (!user) return;
    init();
  }, [user]);

  const init = async () => {
    setLoading(true);

    // 🔐 Check owner role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single();

    if (profile?.role !== 'owner') {
      router.replace('/(tabs)');
      return;
    }

    await loadLogs();
    setLoading(false);
  };

  const loadLogs = async () => {
    // 1️⃣ Load audit logs
    const { data: rows, error } = await supabase
      .from('audit_logs')
      .select('id, action, created_at, details, actor_id, target_id')
      .order('created_at', { ascending: false });

    if (error || !rows) {
      console.error(error);
      return;
    }

    // 2️⃣ Collect all profile IDs
    const profileIds = Array.from(
      new Set(
        rows
          .flatMap((r) => [r.actor_id, r.target_id])
          .filter(Boolean) as string[]
      )
    );

    // 3️⃣ Fetch profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', profileIds);

    const profileMap: ProfileMap = {};
    profiles?.forEach((p) => {
      profileMap[p.id] = p.email;
    });

    // 4️⃣ Merge data
    const formatted: AuditLog[] = rows.map((r) => ({
      id: r.id,
      action: r.action,
      created_at: r.created_at,
      details: r.details,
      actorEmail: r.actor_id
        ? profileMap[r.actor_id] ?? 'Unknown'
        : 'System',
      targetEmail: r.target_id
        ? profileMap[r.target_id] ?? undefined
        : undefined,
    }));

    setLogs(formatted);
  };

  if (loading) {
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
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

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F4',
    padding: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2B2B2B',
    marginBottom: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF8F4',
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
    color: '#2B2B2B',
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
