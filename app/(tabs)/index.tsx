'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../context/supabase';

import { Card } from '../../components/Card';
import { Colors, Spacing } from '../../constants/theme';

/* ---------- TYPES ---------- */

type StaffStat = {
  user_id: string;
  full_name: string;
  count: number;
};

/* ---------- SCREEN ---------- */

export default function HomeTab() {
  const { user } = useAuth();

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

    /* 👤 USER FULL NAME */
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user!.id)
      .single();

    setFullName(profile?.full_name ?? 'User');

    /* 📊 TOTAL CREATED BY USER (MONTH) */
    const { count: total } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', user!.id);

    setTotalCount(total ?? 0);

    /* ⏰ TODAY APPOINTMENTS */
    const { count: upcoming } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('appointment_date', today);

    setUpcomingCount(upcoming ?? 0);

    /* 📍 LOCATION COUNTS (TODAY ONLY) */
    const { count: prishtina } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('appointment_date', today)
      .eq('location', 'Prishtinë');

    const { count: fushe } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('appointment_date', today)
      .eq('location', 'Fushë Kosovë');

    setPrishtinaToday(prishtina ?? 0);
    setFusheToday(fushe ?? 0);

    /* 📅 MONTHLY STAFF STATS */
    const firstDayOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    )
      .toISOString()
      .split('T')[0];

    const { data: monthlyAppointments } = await supabase
      .from('appointments')
      .select(
        `
        created_by,
        profiles:created_by (
          full_name
        )
      `
      )
      .gte('created_at', firstDayOfMonth);

    if (monthlyAppointments) {
      const map: Record<string, StaffStat> = {};

      monthlyAppointments.forEach((a: any) => {
        const id = a.created_by;
        const name = a.profiles?.full_name ?? 'Unknown';

        if (!map[id]) {
          map[id] = { user_id: id, full_name: name, count: 0 };
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
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <Text style={styles.welcome}>Mirë se vini!</Text>
      <Text style={styles.name}>{fullName}</Text>

      {/* MAIN STATS */}
      <View style={styles.statsRow}>
        <Card>
          <View style={styles.statContent}>
            <Text style={styles.statNumber}>{upcomingCount}</Text>
            <Text style={styles.statLabel}>Terminet Sot</Text>
          </View>
        </Card>

        <Card>
          <View style={styles.statContent}>
            <Text style={styles.statNumber}>{totalCount}</Text>
            <Text style={styles.statLabel}>
              Terminet e krijuara nga ju këtë muaj
            </Text>
          </View>
        </Card>
      </View>

      {/* LOCATION TODAY (SMALL CARDS) */}
      <View style={styles.statsRow}>
        <Card>
          <View style={styles.smallStat}>
            <Text style={styles.smallNumber}>{prishtinaToday}</Text>
            <Text style={styles.smallLabel}>Prishtinë Sot</Text>
          </View>
        </Card>

        <Card>
          <View style={styles.smallStat}>
            <Text style={styles.smallNumber}>{fusheToday}</Text>
            <Text style={styles.smallLabel}>Fushë Kosovë Sot</Text>
          </View>
        </Card>
      </View>

      {/* MONTHLY STAFF STATS */}
      <Text style={styles.sectionTitle}>📊 Statistika mujore (stafi)</Text>

      <FlatList
        data={staffStats}
        keyExtractor={(item) => item.user_id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <Card>
            <View style={styles.staffRow}>
              <Text style={styles.staffName}>
                {renderBadge(index)} {item.full_name}
              </Text>
              <Text style={styles.staffCount}>{item.count}</Text>
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
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcome: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    width: 140,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.primary,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  /* SMALL CARDS */
  smallStat: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    width: 120,
  },
  smallNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
  },
  smallLabel: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  staffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  staffName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  staffCount: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
});
