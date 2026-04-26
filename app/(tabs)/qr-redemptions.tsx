'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

type Role = 'owner' | 'manager' | 'staff';
type StatusFilter = 'all' | 'pending' | 'used' | 'expired';

type Redemption = {
  id: string;
  user_id: string;
  points: number;
  status: string;
  expires_at: string | null;
  created_at: string;
};

type AuditLog = {
  id: string;
  target_id: string | null;
  actor_id: string | null;
  created_at: string;
  metadata: any;
};

type ProfileMap = Record<
  string,
  {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  }
>;

type RedemptionRow = Redemption & {
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  scanned_by: string | null;
  scanned_at: string | null;
};

const formatDateTime = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

export default function QrRedemptionsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (!user?.id) return;
    loadData();
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;

    setLoading(true);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const nextRole = (profile?.role as Role | undefined) ?? null;
    setRole(nextRole);

    if (nextRole !== 'owner' && nextRole !== 'manager') {
      router.replace('/(tabs)/profile');
      return;
    }

    const { data: redemptionRows, error } = await supabase
      .from('point_redemptions')
      .select('id, user_id, points, status, expires_at, created_at')
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }

    const rows = (redemptionRows ?? []) as Redemption[];
    const redemptionIds = rows.map((item) => item.id);

    const { data: scanLogs } =
      redemptionIds.length > 0
        ? await supabase
            .from('audit_logs')
            .select('id, target_id, actor_id, created_at, metadata')
            .eq('action', 'REDEEM_POINTS_QR')
            .in('target_id', redemptionIds)
            .order('created_at', { ascending: false })
        : { data: [] };

    const logs = (scanLogs ?? []) as AuditLog[];
    const actorIds = logs
      .map((log) => log.actor_id)
      .filter((id): id is string => !!id);
    const clientIds = rows
      .map((item) => item.user_id)
      .filter((id): id is string => !!id);
    const profileIds = Array.from(new Set([...actorIds, ...clientIds]));

    let profiles: ProfileMap = {};

    if (profileIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .in('id', profileIds);

      profiles =
        profileRows?.reduce((acc: ProfileMap, item: any) => {
          acc[item.id] = {
            full_name: item.full_name ?? null,
            email: item.email ?? null,
            phone: item.phone ?? null,
          };
          return acc;
        }, {}) ?? {};
    }

    setRedemptions(
      rows.map((item) => {
        const scanLog = logs.find((log) => log.target_id === item.id) ?? null;
        const client = profiles[item.user_id];
        const actor = scanLog?.actor_id ? profiles[scanLog.actor_id] : null;

        return {
          ...item,
          client_name: client?.full_name ?? client?.email ?? 'Klient',
          client_email: client?.email ?? null,
          client_phone: client?.phone ?? null,
          scanned_by: actor?.full_name ?? actor?.email ?? null,
          scanned_at: scanLog?.created_at ?? null,
        };
      })
    );

    setLoading(false);
  };

  useAutoRefresh(loadData, {
    enabled: !!user?.id && (role === 'owner' || role === 'manager'),
    tables: ['point_redemptions', 'audit_logs', 'profiles'],
    channelName: 'qr-redemptions',
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return redemptions.filter((item) => {
      if (filter !== 'all' && item.status !== filter) return false;
      if (!q) return true;

      return [
        item.id,
        item.client_name,
        item.client_email ?? '',
        item.client_phone ?? '',
        item.scanned_by ?? '',
        item.status,
        String(item.points),
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [filter, redemptions, search]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (role !== 'owner' && role !== 'manager') return null;

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Text style={[styles.title, { color: Colors.text }]}>QR Discounts</Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Kerko klient, staff, status..."
        placeholderTextColor={Colors.muted}
        style={[
          styles.searchInput,
          {
            backgroundColor: Colors.card,
            borderColor: Colors.primary,
            color: Colors.text,
          },
        ]}
      />

      <View style={styles.filters}>
        {(['all', 'pending', 'used', 'expired'] as StatusFilter[]).map((item) => {
          const active = filter === item;

          return (
            <Pressable
              key={item}
              onPress={() => setFilter(item)}
              style={[
                styles.filterBtn,
                { backgroundColor: active ? Colors.primary : Colors.card },
              ]}
            >
              <Text style={{ color: active ? '#fff' : Colors.text }}>
                {item === 'all' ? 'Te gjitha' : item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: Colors.card }]}>
            <View style={styles.cardHeader}>
              <View style={styles.headerText}>
                <Text style={[styles.client, { color: Colors.text }]}>
                  {item.client_name}
                </Text>
                <Text style={[styles.meta, { color: Colors.muted }]}>
                  {item.client_phone ?? item.client_email ?? item.user_id}
                </Text>
              </View>

              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor:
                      item.status === 'used'
                        ? '#2ECC71'
                        : item.status === 'expired'
                        ? '#D64545'
                        : Colors.primary,
                  },
                ]}
              >
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: Colors.muted }]}>
                Points
              </Text>
              <Text style={[styles.detailValue, { color: Colors.text }]}>
                {item.points}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: Colors.muted }]}>
                Created
              </Text>
              <Text style={[styles.detailValue, { color: Colors.text }]}>
                {formatDateTime(item.created_at)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: Colors.muted }]}>
                Expires
              </Text>
              <Text style={[styles.detailValue, { color: Colors.text }]}>
                {formatDateTime(item.expires_at)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: Colors.muted }]}>
                Scanned by
              </Text>
              <Text style={[styles.detailValue, { color: Colors.text }]}>
                {item.scanned_by ?? '-'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: Colors.muted }]}>
                Scanned at
              </Text>
              <Text style={[styles.detailValue, { color: Colors.text }]}>
                {formatDateTime(item.scanned_at)}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterBtn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  client: {
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
  },
});
