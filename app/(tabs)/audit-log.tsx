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
  details: any;
  actor: { email: string | null }[] | null;
  target: { email: string | null }[] | null;
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
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!user) return;

    checkRoleAndLoad();
  }, [user]);

  const checkRoleAndLoad = async () => {
    setLoading(true);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single();

    if (profile?.role !== 'owner') {
      router.replace('/(tabs)');
      return;
    }

    setIsOwner(true);
    await loadLogs();
    setLoading(false);
  };

  const loadLogs = async () => {
    const { data, error } = await supabase
      .from('audit_logs')
      .select(`
        id,
        action,
        created_at,
        details,
        actor:profiles!audit_logs_actor_id_fkey ( email ),
        target:profiles!audit_logs_target_id_fkey ( email )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setLogs(data ?? []);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#C9A24D" />
        <Text style={styles.loadingText}>Loading audit logs…</Text>
      </View>
    );
  }

  if (!isOwner) return null;

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

            <Text style={styles.meta}>
              👤 {item.actor?.[0]?.email ?? 'System'}
            </Text>

            {item.target?.[0]?.email && (
              <Text style={styles.meta}>
                🎯 {item.target[0].email}
              </Text>
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
