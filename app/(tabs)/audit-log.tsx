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
import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

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
      return 'Appointment Created';
    case 'UPDATE_APPOINTMENT':
      return 'Appointment Updated';
    default:
      return action.replaceAll('_', ' ');
  }
};

/* ✅ FILTER EMPTY LOGS */
const hasValidChanges = (log: AuditLogRow) => {
  const changes = log?.metadata?.changed;
  return (
    changes &&
    typeof changes === 'object' &&
    Object.keys(changes).length > 0
  );
};

/* ================= METADATA RENDER ================= */

const renderMetadata = (metadata: any, Colors: any) => {
  if (!metadata || typeof metadata !== 'object') return null;

  const changes = metadata.changed;
  if (!changes || typeof changes !== 'object') return null;

  const entries = Object.entries(changes);
  if (entries.length === 0) return null;

  return (
    <View
      style={[
        styles.changesBox,
        { backgroundColor: Colors.background },
      ]}
    >
      <Text style={[styles.changesTitle, { color: Colors.text }]}>
        Changes
      </Text>

      {entries.map(([field, value]: any) => {
        if (!value || typeof value !== 'object') return null;

        return (
          <View key={field} style={styles.changeRow}>
            <Text
              style={[
                styles.changeField,
                { color: Colors.muted },
              ]}
            >
              {field}
            </Text>

            <View style={styles.changeValues}>
              <Text style={styles.oldValue}>
                {String(value.old ?? '—')}
              </Text>

              <Text style={[styles.arrow, { color: Colors.muted }]}>
                →
              </Text>

              <Text style={styles.newValue}>
                {String(value.new ?? '—')}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

/* ================= SCREEN ================= */

export default function AuditLogsScreen() {
  const { user } = useAuth();

  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    init();
  }, [user]);

  const init = async () => {
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

    await Promise.all([loadUsers(), loadLogs()]);
    setLoading(false);
  };

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name');

    const map: Record<string, string> = {};
    data?.forEach((u: any) => (map[u.id] = u.full_name || 'Unknown'));
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
      <View
        style={[
          styles.center,
          { backgroundColor: Colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, { color: Colors.muted }]}>
          Loading audit logs…
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: Colors.background },
      ]}
    >
      <Text style={[styles.pageTitle, { color: Colors.text }]}>
        Audit Logs
      </Text>

      <FlatList
        data={logs.filter(hasValidChanges)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => {
          const actorName =
            item.actor_id && users[item.actor_id]
              ? users[item.actor_id]
              : 'System';

          return (
            <View
              style={[
                styles.card,
                { backgroundColor: Colors.card },
              ]}
            >
              <View
                style={[
                  styles.actionBadge,
                  { backgroundColor: Colors.primary },
                ]}
              >
                <Text style={styles.actionText}>
                  {prettyAction(item.action)}
                </Text>
              </View>

              <Text style={[styles.meta, { color: Colors.muted }]}>
                👤 {actorName}
              </Text>

              {renderMetadata(item.metadata, Colors)}

              <Text style={[styles.time, { color: Colors.muted }]}>
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
  },

  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },

  actionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },

  meta: {
    fontSize: 13,
    marginBottom: 6,
  },

  changesBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
  },
  changesTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  changeRow: {
    marginBottom: 6,
  },
  changeField: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  changeValues: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  oldValue: {
    fontSize: 13,
    color: '#B00020',
    textDecorationLine: 'line-through',
  },
  arrow: {
    marginHorizontal: 6,
    fontSize: 13,
  },
  newValue: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '700',
  },

  time: {
    fontSize: 12,
    marginTop: 10,
  },
});
