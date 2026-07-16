import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
};

function AnimatedPoints({ value, trigger, color }: { value: number; trigger: number; color: string }) {
  const count = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    count.stopAnimation();
    count.setValue(0);
    scale.setValue(1);
    setDisplayValue(0);
    const listener = count.addListener(({ value: current }) => setDisplayValue(Math.round(current)));

    Animated.parallel([
      Animated.timing(count, { toValue: value, duration: 750, useNativeDriver: false }),
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.12, duration: 220, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      ]),
    ]).start();

    return () => count.removeListener(listener);
  }, [count, scale, value, trigger]);

  return (
    <Animated.Text style={[styles.points, { color, transform: [{ scale }] }]}>
      {displayValue}
    </Animated.Text>
  );
}

export default function HomeScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pointsAnimationKey, setPointsAnimationKey] = useState(0);

  const loadHome = useCallback(async () => {
    if (!user?.id) return;

    const today = formatKosovoDateOnly();
    const { data } = await supabase
      .from('appointments')
      .select('id, service, appointment_date, appointment_time, location, status')
      .eq('user_id', user.id)
      .eq('archived', false)
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
    setPointsAnimationKey((current) => current + 1);
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.content}
      alwaysBounceVertical
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
        />
      }
    >
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: Colors.primary }]}>FreshLook</Text>
        <Text style={[styles.title, { color: Colors.text }]}>
          Hi{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </Text>
        <Text style={[styles.subtitle, { color: Colors.muted }]}>
          Your appointments and Fresh Points are ready whenever you are.
        </Text>
      </View>

      <View style={[styles.pointsCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <View>
          <Text style={[styles.cardLabel, { color: Colors.muted }]}>Fresh Points</Text>
          <AnimatedPoints
            value={profile?.points ?? 0}
            trigger={pointsAnimationKey}
            color={Colors.text}
          />
          <Text style={[styles.pointsEuroValue, { color: Colors.muted }]}>
            {((profile?.points ?? 0) / 10).toFixed(2)} €
          </Text>
        </View>
        <Pressable
          style={[styles.iconButton, { backgroundColor: Colors.primary }]}
          onPress={() => router.push('/(tabs)/rewards')}
        >
          <Ionicons name="gift-outline" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: Colors.text }]}>Next Visit</Text>
        <Pressable onPress={() => router.push('/(tabs)/appointments')}>
          <Text style={[styles.sectionAction, { color: Colors.primary }]}>View all</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : nextAppointment ? (
          <>
            <Text style={[styles.appointmentTitle, { color: Colors.text }]}>
              {nextAppointment.service || 'Appointment'}
            </Text>
            <Text style={[styles.appointmentMeta, { color: Colors.muted }]}>
              {formatDate(nextAppointment.appointment_date)} · {formatTime(nextAppointment.appointment_time)}
            </Text>
            {!!nextAppointment.location && (
              <Text style={[styles.appointmentMeta, { color: Colors.muted }]}>
                {nextAppointment.location}
              </Text>
            )}
            <View style={[styles.statusPill, { borderColor: Colors.border }]}>
              <Text style={[styles.statusText, { color: Colors.primary }]}>
                {nextAppointment.status || 'scheduled'}
              </Text>
            </View>
          </>
        ) : (
          <Text style={[styles.empty, { color: Colors.muted }]}>
            No upcoming visits yet.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 110,
  },
  header: {
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  pointsCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  points: {
    fontSize: 42,
    fontWeight: '900',
  },
  pointsEuroValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '800',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '800',
  },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 18,
    minHeight: 126,
    justifyContent: 'center',
  },
  appointmentTitle: {
    fontSize: 19,
    fontWeight: '900',
  },
  appointmentMeta: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 5,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  empty: {
    fontSize: 15,
    lineHeight: 22,
  },
});
