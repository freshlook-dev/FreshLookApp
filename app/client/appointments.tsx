import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatTime } from '../../utils/format';
import {
  EmptyState,
  PremiumCard,
  ScreenHeader,
  StatusBadge,
  useClientColors,
} from '../../components/ClientUI';

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

type VisitTab = 'upcoming' | 'history';

export default function AppointmentsScreen() {
  const { user } = useAuth();
  const Colors = useClientColors();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<VisitTab>('upcoming');

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
    const today = new Date().toISOString().slice(0, 10);
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

  const visibleAppointments = grouped[activeTab];

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
    >
      <ScreenHeader
        eyebrow="Appointments"
        title="Your Visits"
        subtitle="Upcoming appointments and your FreshLook visit history."
      />

      <Pressable
        style={[styles.bookButton, { backgroundColor: Colors.primary }]}
        onPress={() => router.push('/client/book' as any)}
      >
        <Ionicons name="add-circle-outline" size={20} color={Colors.onPrimary} />
        <Text style={[styles.bookButtonText, { color: Colors.onPrimary }]}>Book a new appointment</Text>
      </Pressable>

      <View style={[styles.segment, { backgroundColor: Colors.surface }]}>
        {(['upcoming', 'history'] as VisitTab[]).map((tab) => {
          const active = activeTab === tab;
          const count = grouped[tab].length;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.segmentButton,
                active && {
                  backgroundColor: Colors.elevated,
                  borderColor: Colors.border,
                },
              ]}
            >
              <Text style={[styles.segmentText, { color: active ? Colors.text : Colors.muted }]}>
                {tab === 'upcoming' ? 'Upcoming' : 'History'}
              </Text>
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: active ? Colors.primarySoft : Colors.background },
                ]}
              >
                <Text style={[styles.countText, { color: active ? Colors.primary : Colors.muted }]}>
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : visibleAppointments.length ? (
        <View style={styles.list}>{visibleAppointments.map(renderAppointment)}</View>
      ) : (
        <PremiumCard>
          <EmptyState
            icon={activeTab === 'upcoming' ? 'calendar-outline' : 'time-outline'}
            title={activeTab === 'upcoming' ? 'No upcoming visits' : 'No visit history yet'}
            message={
              activeTab === 'upcoming'
                ? 'Your next appointment will appear here once it is booked.'
                : 'Completed appointments will be collected here for easy reference.'
            }
          />
        </PremiumCard>
      )}
    </ScrollView>
  );
}

function renderAppointment(item: Appointment) {
  return <AppointmentCard key={item.id} item={item} />;
}

function AppointmentCard({ item }: { item: Appointment }) {
  const Colors = useClientColors();
  const dateParts = formatDate(item.appointment_date).split(' ');

  return (
    <PremiumCard elevated>
      <View style={styles.cardTop}>
        <View style={[styles.dateTile, { backgroundColor: Colors.primarySoft }]}>
          <Text style={[styles.dateDay, { color: Colors.primary }]}>{dateParts[0] || '--'}</Text>
          <Text style={[styles.dateMonth, { color: Colors.primary }]}>
            {dateParts.slice(1).join(' ') || 'Visit'}
          </Text>
        </View>
        <View style={styles.cardHeading}>
          <Text style={[styles.cardTitle, { color: Colors.text }]}>
            {item.service || 'Appointment'}
          </Text>
          <StatusBadge label={item.status || 'scheduled'} />
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: Colors.border }]} />
      <MetaRow icon="time-outline" text={formatTime(item.appointment_time)} />
      {!!item.location && <MetaRow icon="location-outline" text={item.location} />}
      {!!item.visit_notes && (
        <View style={[styles.notes, { backgroundColor: Colors.surface }]}>
          <Ionicons name="document-text-outline" size={17} color={Colors.primary} />
          <Text style={[styles.notesText, { color: Colors.text }]}>{item.visit_notes}</Text>
        </View>
      )}
    </PremiumCard>
  );
}

function MetaRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const Colors = useClientColors();
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={17} color={Colors.primary} />
      <Text style={[styles.metaText, { color: Colors.muted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 118,
  },
  bookButton: {
    minHeight: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, marginBottom: 18,
  },
  bookButtonText: { fontSize: 14, fontWeight: '800' },
  segment: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    marginBottom: 22,
  },
  segmentButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
  },
  loader: {
    marginTop: 55,
  },
  list: {
    gap: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  dateTile: {
    width: 62,
    minHeight: 64,
    borderRadius: 16,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 18,
    fontWeight: '800',
  },
  dateMonth: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 2,
  },
  cardHeading: {
    flex: 1,
    gap: 9,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 17,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 9,
  },
  metaText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  notes: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 14,
    padding: 13,
    marginTop: 7,
  },
  notesText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
});
