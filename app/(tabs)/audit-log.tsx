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

/* ================= TYPES ================= */

type AuditLogRow = {
  id: string;
  action: string;
  created_at: string;
  metadata: any;
  actor_id: string | null;
};

/* ================= HELPERS ================= */

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} • ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

const prettyAction = (action: string) => {
  switch (action) {
    case 'CREATE_APPOINTMENT':
      return 'Appointment created';
    case 'UPDATE_APPOINTMENT':
      return 'Appointment updated';
    default:
      return action.replaceAll('_', ' ');
  }
};

// ✅ ONLY THIS PART WAS IMPROVED
const renderMetadata = (metadata: any) => {
  if (!metadata || typeof metadata !== 'object') return null;

  const changes = metadata.changed;

  if (!changes || typeof changes !== 'object') return null;

  const entries = Object.entries(changes);
  if (entries.length === 0) return null;

  return (
    <View style={styles.changesBox}>
      <Text style={[styles.changeItem, { fontWeight: '700', marginBottom: 4 }]}>
        Changed:
      </Text>

      {entries.map(([field, value]: any) => {
        if (!value || typeof value !== 'object') return null;

        return (
          <Text key={field} style={styles.changeItem}>
            • {field}: {String(value.old)} → {String(value.new)}
          </Text>
        );
      })}
    </View>
  );
};

/* ================= SCREEN ================= */

export default function AuditLogsScreen() {
  const { user } = useAuth();

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    init();
  }, [user]);

  const init = async () => {
    setLoading(true);

    // 🔐 OWNER CHECK
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single();

    if (profile?.role !== 'owner') {
      router.replace('/(tabs)');
      return;
    }

    await Promise.all([loadUsers(), loadLogs()]);
    setLoading(false);
  };

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email');

    const map: Record<string, string> = {};
    data?.forEach((u) => (map[u.id] = u.email));
    setUsers(map);
  };

  const loadLogs = async () => {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, action, created_at, metadata, actor_id')
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

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Audit Logs</Text>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 30 }}
        renderItem={({ item }) => {
          const actorEmail =
            item.actor_id && users[item.actor_id]
              ? users[item.actor_id]
              : 'System';

          return (
            <View style={styles.card}>
              <Text style={styles.action}>
                {prettyAction(item.action)}
              </Text>

              <Text style={styles.meta}>👤 {actorEmail}</Text>

              {renderMetadata(item.metadata)}

              <Text style={styles.time}>
                {formatDateTime(item.created_at)}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

/* ================= STYLES ================= */

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
  changesBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F4F1EC',
    borderRadius: 10,
  },
  changeItem: {
    fontSize: 13,
    color: '#333',
  },
  time: {
    fontSize: 12,
    marginTop: 8,
    color: '#7A7A7A',
  },
});
