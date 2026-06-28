import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
};

function localDateValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function HomeScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const Colors = useClientColors();
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHome = useCallback(async () => {
    if (!user?.id) return;

    const today = localDateValue(new Date());
    const { data } = await supabase
      .from('appointments')
      .select('id, service, appointment_date, appointment_time, location, status')
      .eq('user_id', user.id)
      .eq('archived', false)
      .eq('status', 'upcoming')
      .gte('appointment_date', today)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    setNextAppointment(data ?? null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadHome();
  }, [loadHome]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadHome(), refreshProfile()]);
    setRefreshing(false);
  };

  const firstName = profile?.full_name?.split(' ')[0];

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
        eyebrow="Anëtarësia FreshLook"
        title={`Mirë se vini${firstName ? `, ${firstName}` : ''}`}
        subtitle="Çdo gjë për vizitën tuaj të ardhshme në sallon, e organizuar në një vend."
      />

      <Pressable
        style={[styles.bookButton, { backgroundColor: Colors.primary }]}
        onPress={() => router.push('/client/book' as any)}
      >
        <Ionicons name="calendar-outline" size={20} color={Colors.onPrimary} />
        <Text style={[styles.bookButtonText, { color: Colors.onPrimary }]}>Rezervo termin të ri</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/client/rewards' as any)}>
        <View style={[styles.pointsCard, { backgroundColor: Colors.primary }]}>
          <View style={styles.pointsGlow} />
          <View style={styles.pointsTopRow}>
            <View>
              <Text style={[styles.pointsKicker, { color: Colors.onPrimary }]}>Fresh Points</Text>
              <Text style={[styles.pointsValue, { color: Colors.onPrimary }]}>
                {profile?.points ?? 0}
              </Text>
            </View>
            <View style={[styles.pointsIcon, { borderColor: Colors.onPrimary }]}>
              <Ionicons name="sparkles-outline" size={22} color={Colors.onPrimary} />
            </View>
          </View>
          <View style={[styles.pointsDivider, { backgroundColor: Colors.onPrimary }]} />
          <View style={styles.pointsFooter}>
            <Text style={[styles.pointsFooterText, { color: Colors.onPrimary }]}>Bilanci i anëtarësisë</Text>
            <View style={styles.pointsLink}>
              <Text style={[styles.pointsFooterText, { color: Colors.onPrimary }]}>Shiko shpërblimet</Text>
              <Ionicons name="arrow-forward" size={15} color={Colors.onPrimary} />
            </View>
          </View>
        </View>
      </Pressable>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionEyebrow, { color: Colors.primary }]}>Orari juaj</Text>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>Vizita e radhës</Text>
        </View>
        <Pressable
          style={[styles.viewAll, { backgroundColor: Colors.primarySoft }]}
          onPress={() => router.push('/client/appointments' as any)}
        >
          <Text style={[styles.viewAllText, { color: Colors.primary }]}>Shiko të gjitha</Text>
          <Ionicons name="chevron-forward" size={15} color={Colors.primary} />
        </Pressable>
      </View>

      <PremiumCard elevated style={styles.visitCard}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={styles.loader} />
        ) : nextAppointment ? (
          <>
            <View style={styles.visitTopRow}>
              <View style={[styles.calendarTile, { backgroundColor: Colors.primarySoft }]}>
                <Ionicons name="calendar-clear-outline" size={23} color={Colors.primary} />
              </View>
              <View style={styles.visitHeading}>
                <Text style={[styles.appointmentTitle, { color: Colors.text }]}>
                  {nextAppointment.service || 'Termin'}
                </Text>
                <StatusBadge label={nextAppointment.status || 'scheduled'} />
              </View>
            </View>
            <View style={[styles.detailDivider, { backgroundColor: Colors.border }]} />
            <DetailRow
              icon="calendar-outline"
              text={formatDate(nextAppointment.appointment_date)}
            />
            <DetailRow
              icon="time-outline"
              text={formatTime(nextAppointment.appointment_time)}
            />
            {!!nextAppointment.location && (
              <DetailRow icon="location-outline" text={nextAppointment.location} />
            )}
          </>
        ) : (
          <EmptyState
            icon="calendar-outline"
            title="Kalendari juaj është i lirë"
            message="Termini juaj i ardhshëm te Fresh Look do të shfaqet këtu sapo të rezervohet."
          />
        )}
      </PremiumCard>
    </ScrollView>
  );
}

function DetailRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const Colors = useClientColors();
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={17} color={Colors.primary} />
      <Text style={[styles.detailText, { color: Colors.muted }]}>{text}</Text>
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
    minHeight: 56, borderRadius: 17, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 9, marginBottom: 22,
  },
  bookButtonText: { fontSize: 15, fontWeight: '800' },
  pointsCard: {
    minHeight: 194,
    borderRadius: 24,
    padding: 22,
    overflow: 'hidden',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 5,
  },
  pointsGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -72,
    top: -84,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  pointsTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  pointsKicker: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.7,
    opacity: 0.82,
  },
  pointsValue: {
    fontSize: 50,
    lineHeight: 57,
    fontWeight: '800',
    letterSpacing: -1.5,
    marginTop: 2,
  },
  pointsIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.85,
  },
  pointsDivider: {
    height: 1,
    opacity: 0.22,
    marginTop: 19,
  },
  pointsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  pointsFooterText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    opacity: 0.84,
  },
  pointsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 3,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '800',
  },
  visitCard: {
    minHeight: 196,
  },
  loader: {
    marginVertical: 55,
  },
  visitTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  calendarTile: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitHeading: {
    flex: 1,
    gap: 9,
  },
  appointmentTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
  },
  detailDivider: {
    height: 1,
    marginVertical: 17,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  detailText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
