'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Modal,
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

  // modal state
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<StatRow[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    init();
  }, [user]);

  const init = async () => {
    setLoading(true);

    // 🔒 role check
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

  const openStats = (name: string) => {
    const filtered = stats.filter((s) => s.full_name === name);
    setUserStats(filtered);
    setSelectedUser(name);
    setShowModal(true);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // unique users
  const users = Array.from(new Set(stats.map((s) => s.full_name)));

  // max for bar scaling
  const maxValue = Math.max(...userStats.map((s) => s.total), 1);
  const totalAppointments = userStats.reduce(
    (sum, s) => sum + s.total,
    0
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors.background }]}
    >
      <Text style={[styles.title, { color: Colors.text }]}>
        📊 Staff Statistics
      </Text>

      {users.map((name) => (
        <View
          key={name}
          style={[styles.card, { backgroundColor: Colors.card }]}
        >
          <Text style={[styles.userName, { color: Colors.text }]}>
            {name || 'Unnamed User'}
          </Text>

          <Pressable
            onPress={() => openStats(name)}
            style={styles.viewBtn}
          >
            <Text style={styles.viewBtnText}>Shiko statistikat</Text>
          </Pressable>
        </View>
      ))}

      {/* ================= MODAL ================= */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: Colors.card },
            ]}
          >
            <Text style={[styles.modalTitle, { color: Colors.text }]}>
              {selectedUser}
            </Text>

            {userStats.map((s) => {
              const ratio = s.total / maxValue;

              return (
                <View key={s.month} style={styles.barRow}>
                  <Text
                    style={[styles.monthLabel, { color: Colors.muted }]}
                  >
                    {s.month}
                  </Text>

                  <View style={styles.barBg}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          flex: ratio,
                          backgroundColor: Colors.primary,
                        },
                      ]}
                    />
                    <View style={{ flex: 1 - ratio }} />
                  </View>

                  <Text
                    style={[styles.barValue, { color: Colors.text }]}
                  >
                    {s.total}
                  </Text>
                </View>
              );
            })}

            <Text
              style={[
                styles.totalText,
                { color: Colors.text },
              ]}
            >
              Totali: {totalAppointments} termine
            </Text>

            <Pressable
              onPress={() => setShowModal(false)}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>Mbyll</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/* ================= STYLES ================= */

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
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },

  viewBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#C9A24D',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  viewBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },

  barRow: {
    marginBottom: 14,
  },
  monthLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  barBg: {
    height: 10,
    borderRadius: 10,
    backgroundColor: '#E6E6E6',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barFill: {
    height: 10,
    borderRadius: 10,
  },
  barValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
  },

  totalText: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '800',
  },

  closeBtn: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#D64545',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
});
