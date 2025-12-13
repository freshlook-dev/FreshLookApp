'use client';

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../context/supabase';

import { Card } from '../../components/Card';
import { Colors, Spacing } from '../../constants/theme';

type Stats = {
  totalAppointments: number;
  upcomingAppointments: number;
};

export default function HomeTab() {
  const { user } = useAuth();

  const [fullName, setFullName] = useState<string>('User');
  const [stats, setStats] = useState<Stats>({
    totalAppointments: 0,
    upcomingAppointments: 0,
  });

  useEffect(() => {
    if (user) {
      loadProfile();
      loadStats();
    }
  }, [user]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user!.id)
      .single();

    if (data?.full_name) {
      setFullName(data.full_name);
    }
  };

  const loadStats = async () => {
    const today = new Date().toISOString().split('T')[0];

    const { count: total } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true });

    const { count: upcoming } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .gte('appointment_date', today);

    setStats({
      totalAppointments: total ?? 0,
      upcomingAppointments: upcoming ?? 0,
    });
  };

  return (
    <View style={styles.container}>
      {/* Welcome */}
      <Text style={styles.welcome}>Welcome back</Text>
      <Text style={styles.name}>{fullName}</Text>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.upcomingAppointments}</Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalAppointments}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },

  welcome: {
    fontSize: 16,
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
    justifyContent: 'space-between',
  },

  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginRight: Spacing.sm,
  },

  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
  },

  statLabel: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
