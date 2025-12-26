'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../context/supabase';

import { Card } from '../../components/Card';
import { Spacing } from '../../constants/theme';

import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

/* ---------- TYPES ---------- */

type StaffStat = {
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
  count: number;
};

/* ---------- SCREEN ---------- */

export default function HomeTab() {
  const { user } = useAuth();

  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const [fullName, setFullName] = useState<string>('User');
  const [totalCount, setTotalCount] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [prishtinaToday, setPrishtinaToday] = useState(0);
  const [fusheToday, setFusheToday] = useState(0);
  const [staffStats, setStaffStats] = useState<StaffStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadStats();
  }, [user]);

  const loadStats = async () => {
    setLoading(true);

    const today = new Date().toISOString().split('T')[0];

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user!.id)
      .single();

    setFullName(profile?.full_name ?? 'User');

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

    const { data: monthlyAppointments } = await supabase
      .from('appointments')
      .select(
        `
        created_by,
        profiles:created_by (
          full_name,
          avatar_url
        )
      `
      )
      .gte('created_at', firstDayOfMonth);

    if (monthlyAppointments) {
      const map: Record<string, StaffStat> = {};

      monthlyAppointments.forEach((a: any) => {
        const id = a.created_by;
        const name = a.profiles?.full_name ?? 'Unknown';
        const avatar = a.profiles?.avatar_url ?? null;

        if (!map[id]) {
          map[id] = {
            user_id: id,
            full_name: name,
            avatar_url: avatar,
            count: 0,
          };
        }

        map[id].count += 1;
      });

      setStaffStats(
        Object.values(map).sort((a, b) => b.count - a.count)
      );
    }

    setLoading(false);
  };

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

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: Colors.background },
      ]}
    >
      <Text style={[styles.welcome, { color: Colors.muted }]}>
        Mirë se vini!
      </Text>
      <Text style={[styles.name, { color: Colors.text }]}>
        {fullName}
      </Text>

      <View style={styles.statsRow}>
        <Card>
          <View style={styles.smallStat}>
            <Text style={[styles.smallNumber, { color: Colors.primary }]}>
              {upcomingCount}
            </Text>
            <Text style={[styles.smallLabel, { color: Colors.muted }]}>
              Sot
            </Text>
          </View>
        </Card>

        <Card>
          <View style={styles.smallStat}>
            <Text style={[styles.smallNumber, { color: Colors.primary }]}>
              {totalCount}
            </Text>
            <Text style={[styles.smallLabel, { color: Colors.muted }]}>
              Krijuar
            </Text>
          </View>
        </Card>

        <Card>
          <View style={styles.smallStat}>
            <Text style={[styles.smallNumber, { color: Colors.primary }]}>
              {prishtinaToday}
            </Text>
            <Text style={[styles.smallLabel, { color: Colors.muted }]}>
              Prishtinë
            </Text>
          </View>
        </Card>

        <Card>
          <View style={styles.smallStat}>
            <Text style={[styles.smallNumber, { color: Colors.primary }]}>
              {fusheToday}
            </Text>
            <Text style={[styles.smallLabel, { color: Colors.muted }]}>
              F. Kosovë
            </Text>
          </View>
        </Card>
      </View>

      <Text
        style={[
          styles.sectionTitle,
          { color: Colors.text },
        ]}
      >
        📊 Statistika mujore (stafi)
      </Text>

      <FlatList
        data={staffStats}
        keyExtractor={(item) => item.user_id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <Card>
            <View style={styles.staffRow}>
              <View style={styles.staffLeft}>
                <Image
                  source={
                    item.avatar_url
                      ? { uri: item.avatar_url }
                      : require('../../assets/images/avatar-placeholder.png')
                  }
                  style={styles.avatar}
                />
                <Text
                  style={[
                    styles.staffName,
                    { color: Colors.text },
                  ]}
                >
                  {renderBadge(index)} {item.full_name}
                </Text>
              </View>
              <Text
                style={[
                  styles.staffCount,
                  { color: Colors.primary },
                ]}
              >
                {item.count}
              </Text>
            </View>
          </Card>
        )}
      />
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
  welcome: {
    fontSize: 14,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  smallStat: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    width: 58,
  },
  smallNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
  smallLabel: {
    marginTop: 2,
    fontSize: 11,
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
    backgroundColor: '#EAEAEA',
  },
  staffName: {
    fontSize: 15,
    fontWeight: '600',
  },
  staffCount: {
    fontSize: 18,
    fontWeight: '800',
  },
});
