'use client';

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

import { Colors, Spacing } from '../../constants/theme';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';

type Status = 'upcoming' | 'arrived' | 'canceled';

type Appointment = {
  id: string;
  client_name: string;
  service: string;
  appointment_date: string;
  appointment_time: string;
  location: string | null;
  comment: string | null;
  status: Status;
};

const formatDate = (date: string) => {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}.${String(
    d.getMonth() + 1
  ).padStart(2, '0')}.${d.getFullYear()}`;
};

const formatTime = (time: string) => time.slice(0, 5);

export default function UpcomingAppointments() {
  const { user } = useAuth();
  const isMounted = useRef(true);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState<
    'all' | 'Prishtinë' | 'Fushë Kosovë'
  >('all');

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user, locationFilter]);

  const loadData = async () => {
    setLoading(true);

    let query = supabase
      .from('appointments')
      .select(`
        id,
        client_name,
        service,
        appointment_date,
        appointment_time,
        location,
        comment,
        status
      `)
      .eq('status', 'upcoming')
      .eq('archived', false)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });

    if (locationFilter !== 'all') {
      query = query.eq('location', locationFilter);
    }

    const { data } = await query;

    if (!isMounted.current) return;

    setAppointments(data ?? []);
    setLoading(false);
  };

  const confirmStatus = (id: string, status: Status) => {
    const message =
      status === 'arrived'
        ? 'A jeni të sigurt që klienti ka ardhur?'
        : 'A jeni të sigurt që klienti e ka anuluar termin?';

    Alert.alert('Konfirmim', message, [
      { text: 'Jo', style: 'cancel' },
      {
        text: 'Po',
        onPress: async () => {
          const { error } = await supabase
            .from('appointments')
            .update({ status })
            .eq('id', id);

          if (error) {
            Alert.alert('Gabim', error.message);
            return;
          }

          setAppointments((prev) => prev.filter((a) => a.id !== id));
        },
      },
    ]);
  };

  if (!user || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionTitle>Upcoming Appointments</SectionTitle>

      {/* FILTERS */}
      <View style={styles.filters}>
        {['all', 'Prishtinë', 'Fushë Kosovë'].map((loc) => (
          <TouchableOpacity
            key={loc}
            onPress={() => setLocationFilter(loc as any)}
            style={[
              styles.filterBtn,
              locationFilter === loc && styles.filterActive,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                locationFilter === loc && styles.filterTextActive,
              ]}
            >
              {loc === 'all' ? 'Të gjitha' : loc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.client}>{item.client_name}</Text>
                <Text style={styles.service}>{item.service}</Text>

                <Text style={styles.datetime}>
                  {formatDate(item.appointment_date)} •{' '}
                  {formatTime(item.appointment_time)}
                </Text>

                {item.location && (
                  <Text style={styles.location}>📍 {item.location}</Text>
                )}

                {item.comment && (
                  <Text style={styles.comment}>📝 {item.comment}</Text>
                )}
              </View>

              <View style={styles.sideActions}>
                <TouchableOpacity
                  style={[styles.statusBtn, styles.arrived]}
                  onPress={() => confirmStatus(item.id, 'arrived')}
                >
                  <Text style={styles.statusText}>Ka ardhur</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.statusBtn, styles.canceled]}
                  onPress={() => confirmStatus(item.id, 'canceled')}
                >
                  <Text style={styles.statusText}>Anulim</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filters: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.textSecondary,
  },
  filterActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  client: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  service: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  datetime: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  location: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  comment: {
    marginTop: 6,
    fontSize: 13,
    fontStyle: 'italic',
    color: Colors.textSecondary,
  },
  sideActions: {
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  statusBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  arrived: {
    backgroundColor: '#2ecc71',
  },
  canceled: {
    backgroundColor: '#e74c3c',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
