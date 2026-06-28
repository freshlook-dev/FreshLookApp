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
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

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

const actionLabel = (action: string, metadata: any) => {
  if (metadata?.changed?.status) {
    return 'Ndryshim statusi';
  }

  switch (action) {
    case 'UPDATE_APPOINTMENT':
      return 'Termini u ndryshua';
    case 'CREATE_APPOINTMENT':
      return 'Termin i krijuar';
    case 'USE_ACCESS_CODE':
      return 'Kod qasjeje i përdorur';
    default:
      return action.replaceAll('_', ' ');
  }
};

const prettyField = (field: string) => {
  switch (field) {
    case 'status':
      return 'Statusi';
    case 'archived':
      return 'Arkivuar';
    case 'date':
      return 'Data';
    case 'time':
      return 'Ora';
    default:
      return field;
  }
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
    data?.forEach((u: any) => {
      map[u.id] = u.full_name || 'I panjohur';
    });

    setUsers(map);
  };

  const loadLogs = async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('id, action, created_at, metadata, actor_id')
      .order('created_at', { ascending: false });

    setLogs(data ?? []);
  };

  useAutoRefresh(init, {
    enabled: !!user,
    tables: ['audit_logs', 'profiles'],
    channelName: 'audit-logs',
  });

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Text style={[styles.pageTitle, { color: Colors.text }]}>
        Log-et e auditimit
      </Text>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => {
          const actor =
            item.actor_id && users[item.actor_id]
              ? users[item.actor_id]
              : 'Sistemi';

          const clientName =
            item.metadata?.appointment?.client_name ?? null;

          const changes = item.metadata?.changed ?? null;

          return (
            <View style={[styles.card, { backgroundColor: Colors.card }]}>
              <View style={styles.headerRow}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: Colors.primary },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {actionLabel(item.action, item.metadata)}
                  </Text>
                </View>

                <Text style={[styles.time, { color: Colors.muted }]}>
                  {formatDateTime(item.created_at)}
                </Text>
              </View>

              {clientName && (
                <Text style={[styles.client, { color: Colors.text }]}>
                  👤 {clientName}
                </Text>
              )}

              <Text style={[styles.actor, { color: Colors.muted }]}>
                ✏️ {actor}
              </Text>

              {changes && Object.keys(changes).length > 0 ? (
                <View
                  style={[
                    styles.changesBox,
                    { backgroundColor: Colors.background },
                  ]}
                >
                  <Text
                    style={[
                      styles.changesTitle,
                      { color: Colors.text },
                    ]}
                  >
                    Ndryshimet
                  </Text>

                  {Object.entries(changes).map(([field, value]: any) => (
                    <View key={field} style={styles.changeRow}>
                      <Text
                        style={[
                          styles.changeField,
                          { color: Colors.muted },
                        ]}
                      >
                        {prettyField(field)}
                      </Text>

                      <View style={styles.changeValues}>
                        <Text style={styles.oldValue}>
                          {String(value.old ?? '—')}
                        </Text>
                        <Text
                          style={[
                            styles.arrow,
                            { color: Colors.muted },
                          ]}
                        >
                          →
                        </Text>
                        <Text style={styles.newValue}>
                          {String(value.new ?? '—')}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.noChanges, { color: Colors.muted }]}>
                  Nuk ka ndryshime të detajuara të regjistruara
                </Text>
              )}
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
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 20,
  },
  card: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.18)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  client: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '800',
  },
  actor: {
    marginTop: 4,
    fontSize: 13,
  },
  changesBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
  },
  changesTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  changeRow: {
    marginBottom: 8,
  },
  changeField: {
    fontSize: 12,
    fontWeight: '700',
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
  },
  newValue: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '700',
  },
  noChanges: {
    marginTop: 12,
    fontSize: 13,
    fontStyle: 'italic',
  },
  time: {
    fontSize: 12,
  },
});
