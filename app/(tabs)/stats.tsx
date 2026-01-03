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
  month: string; // YYYY-MM
  total: number;
};

const MONTHS_SQ: Record<string, string> = {
  '01': 'Janar',
  '02': 'Shkurt',
  '03': 'Mars',
  '04': 'Prill',
  '05': 'Maj',
  '06': 'Qershor',
  '07': 'Korrik',
  '08': 'Gusht',
  '09': 'Shtator',
  '10': 'Tetor',
  '11': 'Nëntor',
  '12': 'Dhjetor',
};

const formatMonth = (value: string) => {
  const [year, month] = value.split('-');
  return `${MONTHS_SQ[month]} ${year}`;
};

export default function StatsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const [stats, setStats] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<StatRow[]>([]);
  const [showModal, setShowModal] = useState(false);

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

  const users = Array.from(new Set(stats.map((s) => s.full_name)));
  const maxValue = Math.max(...userStats.map((s) => s.total), 1);
  const totalAppointments = userStats.reduce((sum, s) => sum + s.total, 0);

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
          <View style={styles.userRow}>
            <Text style={[styles.userName, { color: Colors.text }]}>
              {name}
            </Text>

            <Pressable
              onPress={() => openStats(name)}
              style={styles.viewBtn}
            >
              <Text style={styles.viewBtnText}>Shiko statistikat</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {/* ================= MODAL ================= */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
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

            <View style={styles.verticalChart}>
              {userStats.map((s) => {
                const heightRatio = s.total / maxValue;

                return (
                  <View key={s.month} style={styles.columnWrapper}>
                    <View style={styles.columnBg}>
                      <View
                        style={[
                          styles.columnFill,
                          {
                            flex: heightRatio,
                            backgroundColor: '#2ECC71',
                          },
                        ]}
                      />
                    </View>

                    <Text
                      style={[
                        styles.columnValue,
                        { color: Colors.text },
                      ]}
                    >
                      {s.total}
                    </Text>

                    <Text
                      style={[
                        styles.monthLabel,
                        { color: Colors.muted },
                      ]}
                    >
                      {formatMonth(s.month)}
                    </Text>
                  </View>
                );
              })}
            </View>

            <Text style={[styles.totalText, { color: Colors.text }]}>
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

  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    marginRight: 12,
  },

  viewBtn: {
    backgroundColor: '#C9A24D',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  viewBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    borderRadius: 24,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },

  verticalChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginBottom: 20,
  },

  columnWrapper: {
    alignItems: 'center',
    width: 60,
  },
  columnBg: {
    height: 140,
    width: 16,
    backgroundColor: '#E6E6E6',
    borderRadius: 10,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 6,
  },
  columnFill: {
    width: '100%',
    borderRadius: 10,
  },
  columnValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  monthLabel: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },

  totalText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 16,
  },

  closeBtn: {
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
