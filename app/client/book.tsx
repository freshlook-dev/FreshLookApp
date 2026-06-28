import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRef } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';
import { PremiumCard, ScreenHeader, useClientColors } from '../../components/ClientUI';
import { notifyStaffAppointmentChange } from '../../utils/appointmentStaffNotifications';
import { syncClientAppointmentReminders } from '../../utils/appointmentReminders';

type Service = {
  id: string;
  name: string;
  price: number;
  duration: number;
  is_on_sale?: boolean | null;
  sale_price?: number | null;
};

const LOCATIONS = ['Prishtinë', 'Fushë Kosovë'];
const TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const BOOKING_URL = 'https://www.freshlook-ks.com/api/appointments';

function dateValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function BookAppointmentScreen() {
  const { user, profile } = useAuth();
  const Colors = useClientColors();
  const [services, setServices] = useState<Service[]>([]);
  const [service, setService] = useState<Service | null>(null);
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [time, setTime] = useState('');
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const successOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.86)).current;
  const redirectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile?.full_name, profile?.phone]);

  useEffect(() => {
    return () => {
      if (redirectTimeout.current) clearTimeout(redirectTimeout.current);
    };
  }, []);

  useEffect(() => {
    const loadServices = async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, price, duration, is_on_sale, sale_price')
        .eq('is_active', true);

      if (error) Alert.alert('Shërbimet nuk u ngarkuan', error.message);
      setServices((data as Service[] | null) ?? []);
      setLoadingServices(false);
    };

    void loadServices();
  }, []);

  const selectedDate = useMemo(() => dateValue(date), [date]);

  const loadBookedTimes = useCallback(async () => {
    if (!location) {
      setBookedTimes([]);
      return;
    }

    setLoadingTimes(true);
    const { data } = await supabase
      .from('appointments')
      .select('appointment_time')
      .eq('appointment_date', selectedDate)
      .eq('location', location)
      .eq('status', 'upcoming')
      .eq('archived', false);

    setBookedTimes(
      ((data ?? []) as { appointment_time: string }[]).map((item) =>
        String(item.appointment_time).substring(0, 5)
      )
    );
    setLoadingTimes(false);
  }, [location, selectedDate]);

  useEffect(() => {
    setTime('');
    void loadBookedTimes();
  }, [loadBookedTimes]);

  useEffect(() => {
    if (!location) return;
    const channel = supabase
      .channel(`client-booking-${location}-${selectedDate}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        void loadBookedTimes();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadBookedTimes, location, selectedDate]);

  const submit = async () => {
    if (!service || !location || !time || !name.trim() || !phone.trim()) {
      Alert.alert('Mungojnë të dhëna', 'Zgjidhni shërbimin, lokacionin, datën dhe orën, pastaj kontrolloni të dhënat e kontaktit.');
      return;
    }

    if (date.getDay() === 0) {
      Alert.alert('Mbyllur të dielën', 'Ju lutemi zgjidhni një datë tjetër.');
      return;
    }

    setSubmitting(true);
    try {
      await loadBookedTimes();
      const { data: occupiedRows } = await supabase
        .from('appointments')
        .select('id')
        .eq('appointment_date', selectedDate)
        .eq('appointment_time', time)
        .eq('location', location)
        .eq('status', 'upcoming')
        .eq('archived', false)
        .limit(1);

      if (occupiedRows?.length) {
        setTime('');
        throw new Error('Kjo orë sapo u rezervua nga dikush tjetër. Ju lutemi zgjidhni një orë tjetër.');
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Seanca juaj ka skaduar. Ju lutemi hyni përsëri.');

      const response = await fetch(BOOKING_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          service: service.name,
          location,
          appointment_date: selectedDate,
          appointment_time: time,
          client_name: name.trim(),
          phone: phone.trim(),
          confirmation_email: user?.email ?? null,
          source: 'app',
        }),
      });

      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Termini nuk mund të krijohej.');

      void notifyStaffAppointmentChange('created', {
        service: service.name,
        client_name: name.trim(),
        appointment_date: selectedDate,
        appointment_time: time,
        location,
        status: 'upcoming',
      });
      if (user?.id) void syncClientAppointmentReminders(user.id);

      setBookingComplete(true);
      Animated.parallel([
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(successScale, {
          toValue: 1,
          damping: 12,
          stiffness: 170,
          mass: 0.7,
          useNativeDriver: true,
        }),
      ]).start();

      redirectTimeout.current = setTimeout(() => {
        router.replace('/client' as any);
      }, 1150);
    } catch (error) {
      Alert.alert('Rezervimi dështoi', error instanceof Error ? error.message : 'Ju lutemi provoni përsëri.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ScrollView
        style={{ backgroundColor: Colors.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={19} color={Colors.primary} />
          <Text style={[styles.backText, { color: Colors.primary }]}>Kthehu</Text>
        </Pressable>

        <ScreenHeader
          eyebrow="Terminet"
          title="Rezervo vizitën"
          subtitle="Zgjidhni shërbimin, lokacionin dhe orën e lirë për vizitën tuaj në Fresh Look."
        />

      <SectionTitle title="1. Zgjidhni shërbimin" />
      {loadingServices ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : (
        <View style={styles.grid}>
          {services.map((item) => {
            const selected = service?.id === item.id;
            const price = item.is_on_sale && item.sale_price ? item.sale_price : item.price;
            return (
              <Pressable
                key={item.id}
                onPress={() => setService(item)}
                style={[
                  styles.choice,
                  {
                    backgroundColor: selected ? Colors.primarySoft : Colors.card,
                    borderColor: selected ? Colors.primary : Colors.border,
                  },
                ]}
              >
                <Text style={[styles.choiceTitle, { color: Colors.text }]}>{item.name}</Text>
                <Text style={[styles.choiceMeta, { color: Colors.muted }]}>{item.duration} min · {price} EUR</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <SectionTitle title="2. Zgjidhni lokacionin" />
      <View style={styles.row}>
        {LOCATIONS.map((item) => (
          <ChoicePill key={item} label={item} selected={location === item} onPress={() => setLocation(item)} />
        ))}
      </View>

      <SectionTitle title="3. Zgjidhni datën dhe orën" />
      <PremiumCard style={styles.cardGap}>
        <Pressable
          style={[styles.dateButton, { borderColor: Colors.border }]}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={19} color={Colors.primary} />
          <Text style={[styles.dateText, { color: Colors.text }]}>{selectedDate}</Text>
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            minimumDate={new Date()}
            onChange={(_, value) => {
              if (Platform.OS !== 'ios') setShowDatePicker(false);
              if (value) setDate(value);
            }}
          />
        )}
        <View style={styles.timeGrid}>
          {loadingTimes && <ActivityIndicator color={Colors.primary} style={styles.timeLoader} />}
          {TIME_SLOTS.map((slot) => {
            const booked = bookedTimes.includes(slot);
            return (
              <Pressable
                key={slot}
                disabled={booked || !location}
                onPress={() => setTime(slot)}
                style={[
                  styles.time,
                  {
                    backgroundColor: time === slot ? Colors.primary : Colors.surface,
                    borderColor: time === slot ? Colors.primary : Colors.border,
                    opacity: booked || !location ? 0.4 : 1,
                  },
                ]}
              >
                <Text style={{ color: time === slot ? Colors.onPrimary : Colors.text, fontWeight: '700' }}>{slot}</Text>
                {booked && <Text style={[styles.takenText, { color: Colors.muted }]}>E zënë</Text>}
              </Pressable>
            );
          })}
        </View>
      </PremiumCard>

      <SectionTitle title="4. Të dhënat tuaja" />
      <PremiumCard style={styles.cardGap}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Emri dhe mbiemri"
          placeholderTextColor={Colors.muted}
          style={[styles.input, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        />
        <TextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="Numri i telefonit"
          placeholderTextColor={Colors.muted}
          style={[styles.input, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        />
      </PremiumCard>

      <Pressable
        disabled={submitting || bookingComplete}
        onPress={submit}
        style={[styles.submit, { backgroundColor: Colors.primary, opacity: submitting || bookingComplete ? 0.65 : 1 }]}
      >
        {submitting ? <ActivityIndicator color={Colors.onPrimary} /> : <Text style={[styles.submitText, { color: Colors.onPrimary }]}>Konfirmo rezervimin</Text>}
      </Pressable>

      </ScrollView>

      <Modal visible={bookingComplete} transparent animationType="none">
        <Animated.View
          style={[
            styles.successOverlay,
            { backgroundColor: Colors.background, opacity: successOpacity },
          ]}
        >
          <Animated.View
            style={[
              styles.successCard,
              {
                backgroundColor: Colors.elevated,
                borderColor: Colors.border,
                transform: [{ scale: successScale }],
              },
            ]}
          >
            <View style={[styles.successIcon, { backgroundColor: Colors.primary }]}>
              <Ionicons name="checkmark" size={38} color={Colors.onPrimary} />
            </View>
            <Text style={[styles.successTitle, { color: Colors.text }]}>Termini u rezervua</Text>
            <Text style={[styles.successText, { color: Colors.muted }]}>Po ju kthejmë në kryefaqe.</Text>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

function SectionTitle({ title }: { title: string }) {
  const Colors = useClientColors();
  return <Text style={[styles.sectionTitle, { color: Colors.text }]}>{title}</Text>;
}

function ChoicePill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const Colors = useClientColors();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, { backgroundColor: selected ? Colors.primary : Colors.card, borderColor: selected ? Colors.primary : Colors.border }]}
    >
      <Text style={{ color: selected ? Colors.onPrimary : Colors.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 130 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 },
  backText: { fontSize: 14, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginTop: 12, marginBottom: 12 },
  loader: { marginVertical: 24 },
  grid: { gap: 10 },
  choice: { borderWidth: 1, borderRadius: 16, padding: 16 },
  choiceTitle: { fontSize: 15, fontWeight: '800' },
  choiceMeta: { fontSize: 12, marginTop: 5 },
  row: { flexDirection: 'row', gap: 10 },
  pill: { flex: 1, borderWidth: 1, minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  cardGap: { gap: 12 },
  dateButton: { minHeight: 50, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  dateText: { fontSize: 15, fontWeight: '700' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeLoader: { width: '100%', marginVertical: 5 },
  time: { width: '30%', minHeight: 52, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  takenText: { fontSize: 9, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  input: { minHeight: 51, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, fontSize: 15 },
  submit: { minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  submitText: { fontSize: 15, fontWeight: '800' },
  successOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  successCard: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 6,
  },
  successIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6,
  },
});
