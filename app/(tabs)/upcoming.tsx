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
  Platform,
} from 'react-native';

import { router } from 'expo-router';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

import { Spacing } from '../../constants/theme';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';

import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

type Status = 'upcoming' | 'arrived' | 'canceled';
type Role = 'owner' | 'manager' | 'staff';

type Appointment = {
  id: string;
  client_name: string;
  service: string;
  appointment_date: string;
  appointment_time: string;
  location: string | null;
  comment: string | null;
  phone: string | null;
  status: Status;
  creator_name?: string | null;
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

  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>('staff');

  const [locationFilter, setLocationFilter] = useState<
    'all' | 'Prishtinë' | 'Fushë Kosovë'
  >('all');

  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    loadRole();
    loadData();
  }, [user, locationFilter]);

  const loadRole = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single();

    if (data?.role) setRole(data.role);
  };

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
        phone,
        status,
        creator:profiles!appointments_created_by_fkey(full_name)
      `)
      .eq('status', 'upcoming')
      .eq('archived', false)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });

    if (locationFilter !== 'all') {
      query = query.eq('location', locationFilter);
    }

    const { data, error } = await query;

    if (!isMounted.current) return;

    if (error) {
      Alert.alert('Gabim', error.message);
      setLoading(false);
      return;
    }

    const mapped =
      data?.map((a: any) => ({
        ...a,
        creator_name: a.creator?.full_name ?? null,
      })) ?? [];

    setAppointments(mapped as Appointment[]);
    setLoading(false);
  };

  const askConfirm = (status: Status) => {
    const message =
      status === 'arrived'
        ? 'A jeni të sigurt që klienti ka ardhur?'
        : 'A jeni të sigurt që klienti e ka anuluar termin?';

    if (Platform.OS === 'web') {
      return Promise.resolve(confirm(message));
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert('Konfirmim', message, [
        { text: 'Jo', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Po', onPress: () => resolve(true) },
      ]);
    });
  };

  const markStatus = async (id: string, status: Status) => {
    if (processingId) return;

    const ok = await askConfirm(status);
    if (!ok) return;

    setProcessingId(id);

    const prev = appointments;
    setAppointments((p) => p.filter((a) => a.id !== id));

    const { data, error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
      .eq('status', 'upcoming')
      .eq('archived', false)
      .select('id');

    if (error || !data || data.length === 0) {
      setAppointments(prev);
      Alert.alert(
        'Gabim',
        'Nuk u përditësua termini. Kontrollo politikat ose nëse është ndryshuar më herët.'
      );
      setProcessingId(null);
      return;
    }

    setProcessingId(null);
  };

  const canEdit = role === 'owner' || role === 'manager';

  if (!user || loading) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <SectionTitle>Upcoming Appointments</SectionTitle>

      <View style={styles.filters}>
        {['all', 'Prishtinë', 'Fushë Kosovë'].map((loc) => (
          <TouchableOpacity
            key={loc}
            onPress={() => setLocationFilter(loc as any)}
            style={[
              styles.filterBtn,
              {
                borderColor: Colors.muted,
                backgroundColor:
                  locationFilter === loc ? Colors.primary : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                {
                  color:
                    locationFilter === loc
                      ? Colors.background
                      : Colors.muted,
                },
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
                <Text style={[styles.client, { color: Colors.text }]}>
                  {item.client_name}
                </Text>

                <Text style={[styles.service, { color: Colors.muted }]}>
                  {item.service}
                </Text>

                <Text style={[styles.datetime, { color: Colors.muted }]}>
                  {formatDate(item.appointment_date)} •{' '}
                  {formatTime(item.appointment_time)}
                </Text>

                {item.creator_name && (
                  <Text style={[styles.datetime, { color: Colors.muted }]}>
                    👤 {item.creator_name}
                  </Text>
                )}

                {item.location && (
                  <Text style={[styles.location, { color: Colors.muted }]}>
                    📍 {item.location}
                  </Text>
                )}

                {item.phone && (
                  <Text style={[styles.phone, { color: Colors.muted }]}>
                    📞 {item.phone}
                  </Text>
                )}

                {item.comment && (
                  <Text style={[styles.comment, { color: Colors.muted }]}>
                    📝 {item.comment}
                  </Text>
                )}
              </View>

              <View style={styles.sideActions}>
                {canEdit && (
                  <TouchableOpacity
                    style={[
                      styles.editBtn,
                      { backgroundColor: Colors.primary },
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: '../(tabs)/edit',
                        params: { id: item.id },
                      })
                    }
                  >
                    <Text style={[styles.editText, { color: Colors.background }]}>
                      Edit
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  disabled={processingId === item.id}
                  style={[
                    styles.statusBtn,
                    styles.arrived,
                    processingId === item.id && styles.disabledBtn,
                  ]}
                  onPress={() => markStatus(item.id, 'arrived')}
                >
                  <Text style={[styles.statusText, { color: Colors.background }]}>
                    {processingId === item.id ? '...' : 'Ka ardhur'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={processingId === item.id}
                  style={[
                    styles.statusBtn,
                    styles.canceled,
                    processingId === item.id && styles.disabledBtn,
                  ]}
                  onPress={() => markStatus(item.id, 'canceled')}
                >
                  <Text style={[styles.statusText, { color: Colors.background }]}>
                    {processingId === item.id ? '...' : 'Anulim'}
                  </Text>
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
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  client: {
    fontSize: 16,
    fontWeight: '700',
  },
  service: {
    fontSize: 14,
  },
  datetime: {
    marginTop: 4,
    fontSize: 13,
  },
  location: {
    marginTop: 4,
    fontSize: 13,
  },
  phone: {
    marginTop: 4,
    fontSize: 13,
  },
  comment: {
    marginTop: 6,
    fontSize: 13,
    fontStyle: 'italic',
  },
  sideActions: {
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  editBtn: {
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  editText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    minWidth: 84,
    alignItems: 'center',
  },
  arrived: {
    backgroundColor: '#2ecc71',
  },
  canceled: {
    backgroundColor: '#e74c3c',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
