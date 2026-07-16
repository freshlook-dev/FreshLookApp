import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { DarkColors, LightColors } from '../../constants/colors';
import { formatDate, formatKosovoDateOnly, formatTime } from '../../utils/format';

type Appointment = {
  id: string;
  service: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  location: string | null;
  status: string | null;
  visit_notes: string | null;
  total_amount: number | null;
};

export default function AppointmentsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAppointments = useCallback(async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('appointments')
      .select('id, service, appointment_date, appointment_time, location, status, visit_notes, total_amount')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false });

    setAppointments(data ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const grouped = useMemo(() => {
    const today = formatKosovoDateOnly();
    return {
      upcoming: appointments.filter((item) => (item.appointment_date ?? '') >= today),
      history: appointments.filter((item) => (item.appointment_date ?? '') < today),
    };
  }, [appointments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  };

  const renderAppointment = (item: Appointment) => (
    <View
      key={item.id}
      style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}
    >
      <Text style={[styles.cardTitle, { color: Colors.text }]}>
        {item.service || 'Appointment'}
      </Text>
      <Text style={[styles.meta, { color: Colors.muted }]}>
        {formatDate(item.appointment_date)} · {formatTime(item.appointment_time)}
      </Text>
      {!!item.location && (
        <Text style={[styles.meta, { color: Colors.muted }]}>{item.location}</Text>
      )}
      {!!item.visit_notes && (
        <Text style={[styles.notes, { color: Colors.text }]}>{item.visit_notes}</Text>
      )}
      <Text style={[styles.status, { color: Colors.primary }]}>
        {(item.status || 'scheduled').toUpperCase()}
      </Text>
    </View>
  );

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={[styles.title, { color: Colors.text }]}>Your Visits</Text>
      <Text style={[styles.subtitle, { color: Colors.muted }]}>
        Upcoming appointments and recent FreshLook history.
      </Text>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : (
        <>
          <Text style={[styles.section, { color: Colors.text }]}>Upcoming</Text>
          {grouped.upcoming.length ? (
            grouped.upcoming.map(renderAppointment)
          ) : (
            <Text style={[styles.empty, { color: Colors.muted }]}>
              No upcoming visits.
            </Text>
          )}

          <Text style={[styles.section, { color: Colors.text }]}>History</Text>
          {grouped.history.length ? (
            grouped.history.map(renderAppointment)
          ) : (
            <Text style={[styles.empty, { color: Colors.muted }]}>
              No previous visits yet.
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 110,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
    marginBottom: 20,
  },
  loader: {
    marginTop: 40,
  },
  section: {
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 10,
    marginTop: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  meta: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },
  notes: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  status: {
    fontSize: 12,
    fontWeight: '900',
    marginTop: 12,
  },
  empty: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
});
