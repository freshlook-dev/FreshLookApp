'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Platform,
  Modal,
} from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../context/supabase';

import { Card } from '../../components/Card';
import { Spacing } from '../../constants/theme';

import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

/* ---------- TYPES ---------- */

type StaffStat = {
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
  count: number;
};

const avatarPlaceholder = require('../../assets/images/avatar-placeholder.png');

/* ---------- SCREEN ---------- */

export default function HomeTab() {
  const { user } = useAuth();

  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const [fullName, setFullName] = useState<string>('User');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [prishtinaToday, setPrishtinaToday] = useState(0);
  const [fusheToday, setFusheToday] = useState(0);
  const [staffStats, setStaffStats] = useState<StaffStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarPreviewVisible, setAvatarPreviewVisible] = useState(false);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadStats();
  }, [user]);

  const loadStats = async () => {
    setLoading(true);

    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7);

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user!.id)
      .single();

    setFullName(profile?.full_name ?? 'User');
    setAvatarUrl(profile?.avatar_url ?? null);

    const firstDayOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    )
      .toISOString()
      .split('T')[0];

    const { count: total } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', user!.id)
      .eq('archived', false)
      .gte('created_at', firstDayOfMonth);

    setTotalCount(total ?? 0);

    const { count: todayCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('appointment_date', today)
      .eq('archived', false)
      .in('status', ['upcoming', 'arrived']);

    setUpcomingCount(todayCount ?? 0);

    const { count: prishtina } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('appointment_date', today)
      .eq('location', 'Prishtinë')
      .eq('archived', false)
      .in('status', ['upcoming', 'arrived']);

    setPrishtinaToday(prishtina ?? 0);

    const { count: fushe } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('appointment_date', today)
      .eq('location', 'Fushë Kosovë')
      .eq('archived', false)
      .in('status', ['upcoming', 'arrived']);

    setFusheToday(fushe ?? 0);

    const { data: staffMonthly } = await supabase.rpc(
      'appointment_stats_by_user_month'
    );

    if (staffMonthly) {
      setStaffStats(
        staffMonthly
          .filter((r: any) => r.month === currentMonth)
          .map((r: any) => ({
            user_id: r.user_id,
            full_name: r.full_name,
            avatar_url: r.avatar_url,
            count: r.total,
          }))
          .sort((a: any, b: any) => b.count - a.count)
      );
    }

    setLoading(false);
  };

  const openAvatarPreview = (url?: string | null) => {
    setPreviewAvatarUrl(url ?? null);
    setAvatarPreviewVisible(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  useAutoRefresh(loadStats, {
    enabled: !!user,
    tables: ['appointments', 'profiles'],
    channelName: 'home-stats',
  });

  const renderBadge = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}.`;
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const currentAvatarSource = avatarUrl ? { uri: avatarUrl } : avatarPlaceholder;
  const previewAvatarSource = previewAvatarUrl
    ? { uri: previewAvatarUrl }
    : avatarPlaceholder;

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={styles.homeHeader}>
        <View style={styles.homeHeaderText}>
          <Text style={[styles.welcome, { color: Colors.muted }]}>
            Mirë se vini!
          </Text>

          <Text style={[styles.name, { color: Colors.text }]}>{fullName}</Text>
        </View>

        <View style={styles.homeAvatarWrap}>
          <Pressable onPress={() => openAvatarPreview(avatarUrl)}>
            <Image
              key={avatarUrl}
              source={currentAvatarSource}
              style={[styles.homeAvatar, { backgroundColor: Colors.card }]}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: Colors.card }]}>
          <View style={styles.smallStat}>
            <Text style={[styles.smallNumber, { color: Colors.primary }]}>
              {upcomingCount}
            </Text>
            <Text style={[styles.smallLabel, { color: Colors.muted }]}>
              Sot
            </Text>
          </View>
        </View>

        <View style={[styles.statBox, { backgroundColor: Colors.card }]}>
          <View style={styles.smallStat}>
            <Text style={[styles.smallNumber, { color: Colors.primary }]}>
              {totalCount}
            </Text>
            <Text style={[styles.smallLabel, { color: Colors.muted }]}>
              Krijuar
            </Text>
          </View>
        </View>

        <View style={[styles.statBox, { backgroundColor: Colors.card }]}>
          <View style={styles.smallStat}>
            <Text style={[styles.smallNumber, { color: Colors.primary }]}>
              {prishtinaToday}
            </Text>
            <Text style={[styles.smallLabel, { color: Colors.muted }]}>
              Prishtinë
            </Text>
          </View>
        </View>

        <View style={[styles.statBox, styles.lastStatBox, { backgroundColor: Colors.card }]}>
          <View style={styles.smallStat}>
            <Text style={[styles.smallNumber, { color: Colors.primary }]}>
              {fusheToday}
            </Text>
            <Text style={[styles.smallLabel, { color: Colors.muted }]}>
              F. Kosovë
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: Colors.text }]}>
        📊 Statistika mujore (stafi)
      </Text>

      <FlatList
        data={staffStats}
        keyExtractor={(item) => item.user_id}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        renderItem={({ item, index }) => (
          <Card>
            <View style={styles.staffRow}>
              <View style={styles.staffLeft}>
                <Pressable onPress={() => openAvatarPreview(item.avatar_url)}>
                  <Image
                    source={
                      item.avatar_url
                        ? { uri: item.avatar_url }
                        : avatarPlaceholder
                    }
                    style={[
                      styles.avatar,
                      { backgroundColor: Colors.muted },
                    ]}
                  />
                </Pressable>

                <Text style={[styles.staffName, { color: Colors.text }]}>
                  {renderBadge(index)} {item.full_name}
                </Text>
              </View>

              <Text
                style={[styles.staffCount, { color: Colors.primary }]}
              >
                {item.count}
              </Text>
            </View>
          </Card>
        )}
      />

      {avatarPreviewVisible && Platform.OS === 'web' && (
        <View
          style={[
            styles.avatarOverlay,
            {
              position: 'fixed' as any,
              inset: 0,
              zIndex: 9999,
            },
          ]}
        >
          <View style={[styles.avatarPreviewCard, { backgroundColor: Colors.card }]}>
            <Image
              source={previewAvatarSource}
              style={styles.avatarPreview}
              resizeMode="cover"
            />

            <Pressable
              onPress={() => setAvatarPreviewVisible(false)}
              style={[styles.avatarCloseBtn, { backgroundColor: Colors.primary }]}
            >
              <Text style={styles.avatarCloseText}>Mbyll</Text>
            </Pressable>
          </View>
        </View>
      )}

      {Platform.OS !== 'web' && (
        <Modal visible={avatarPreviewVisible} transparent animationType="fade">
          <View style={styles.avatarOverlay}>
            <View style={[styles.avatarPreviewCard, { backgroundColor: Colors.card }]}>
              <Image
                source={previewAvatarSource}
                style={styles.avatarPreview}
                resizeMode="cover"
              />

              <Pressable
                onPress={() => setAvatarPreviewVisible(false)}
                style={[styles.avatarCloseBtn, { backgroundColor: Colors.primary }]}
              >
                <Text style={styles.avatarCloseText}>Mbyll</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: Spacing.lg,
  },
  homeHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  welcome: {
    fontSize: 14,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
  },
  homeAvatarWrap: {
    width: 62,
    height: 62,
    flexShrink: 0,
  },
  homeAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
    width: '100%',
  },
  statBox: {
    width: '23.5%',
    flexShrink: 0,
    borderRadius: 12,
    paddingHorizontal: 2,
    paddingVertical: 8,
    marginRight: 4,
  },
  lastStatBox: {
    marginRight: 0,
  },
  smallStat: {
    alignItems: 'center',
    minWidth: 0,
  },
  smallNumber: {
    fontSize: 16,
    fontWeight: '800',
  },
  smallLabel: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    fontSize: 16,
    fontWeight: '700',
  },
  staffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  staffLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  staffName: {
    fontSize: 15,
    fontWeight: '600',
  },
  staffCount: {
    fontSize: 18,
    fontWeight: '800',
  },
  avatarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  avatarPreviewCard: {
    width: '88%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
  },
  avatarPreview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
  },
  avatarCloseBtn: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  avatarCloseText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
