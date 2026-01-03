'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

type StatRow = {
  user_id: string;
  full_name: string;
  month: string;
  total: number;
};

export default function StatsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const [stats, setStats] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    init();
  }, [user]);

  const init = async () => {
    setLoading(true);

    // 🔒 Role check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single();

    if (!profile || !['owner', 'manager'].includes(profile.role)) {
      router.replace('/(tabs)');
      return;
    }

    const { data, error } = await supabase.rpc(
      'appointment_stats_by_user_month'
    );

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setStats(data ?? []);
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Group by user
  const grouped = stats.reduce<Record<string, StatRow[]>>((acc, row) => {
    acc[row.full_name] = acc[row.full_name] || [];
    acc[row.full_name].push(row);
    return acc;
  }, {});

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors.background }]}
    >
      <Text style={[styles.title, { color: Colors.text }]}>
        Staff Appointment Stats
      </Text>

      {Object.entries(grouped).map(([name, rows]) => (
        <View
          key={name}
          style={[styles.card, { backgroundColor: Colors.card }]}
        >
          <Text style={[styles.userName, { color: Colors.text }]}>
            {name || 'Unnamed User'}
          </Text>

          {rows.map((r) => (
            <Text
              key={r.month}
              style={[styles.row, { color: Colors.muted }]}
            >
              {r.month} → {r.total} appointments
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
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
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  row: {
    fontSize: 13,
    marginBottom: 4,
  },
});
