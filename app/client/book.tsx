import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';
import { PremiumCard, ScreenHeader, useClientColors } from '../../components/ClientUI';

type Service = {
  id: string;
  name: string;
  price: number;
  duration: number;
  is_on_sale?: boolean | null;
  sale_price?: number | null;
};

const LOCATIONS = ['Prishtine', 'Fushe Kosove'];
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
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile?.full_name, profile?.phone]);

  useEffect(() => {
    const loadServices = async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, price, duration, is_on_sale, sale_price')
        .eq('is_active', true);

      if (error) Alert.alert('Services unavailable', error.message);
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

    const { data } = await supabase
      .from('appointments')
      .select('appointment_time')
      .eq('appointment_date', selectedDate)
      .eq('location', location)
      .eq('status', 'upcoming');

    setBookedTimes(
      ((data ?? []) as { appointment_time: string }[]).map((item) =>
        String(item.appointment_time).substring(0, 5)
      )
    );
  }, [location, selectedDate]);

  useEffect(() => {
    setTime('');
    void loadBookedTimes();
  }, [loadBookedTimes]);

  const submit = async () => {
    if (!service || !location || !time || !name.trim() || !phone.trim()) {
      Alert.alert('Missing information', 'Select a service, location, date and time, then check your contact details.');
      return;
    }

    if (date.getDay() === 0) {
      Alert.alert('Closed on Sunday', 'Please choose another date.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Your session has expired. Please sign in again.');

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
      if (!response.ok) throw new Error(result.error || 'The appointment could not be created.');

      Alert.alert('Appointment requested', 'Your appointment was created successfully.', [
        { text: 'View visits', onPress: () => router.replace('/client/appointments' as any) },
      ]);
    } catch (error) {
      Alert.alert('Booking failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={19} color={Colors.primary} />
        <Text style={[styles.backText, { color: Colors.primary }]}>Back</Text>
      </Pressable>

      <ScreenHeader
        eyebrow="Appointments"
        title="Book a Visit"
        subtitle="Choose from the same live services and available times shown on Fresh Look web."
      />

      <SectionTitle title="1. Choose a service" />
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

      <SectionTitle title="2. Choose a location" />
      <View style={styles.row}>
        {LOCATIONS.map((item) => (
          <ChoicePill key={item} label={item} selected={location === item} onPress={() => setLocation(item)} />
        ))}
      </View>

      <SectionTitle title="3. Choose date and time" />
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
              </Pressable>
            );
          })}
        </View>
      </PremiumCard>

      <SectionTitle title="4. Your information" />
      <PremiumCard style={styles.cardGap}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor={Colors.muted}
          style={[styles.input, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        />
        <TextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="Phone number"
          placeholderTextColor={Colors.muted}
          style={[styles.input, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        />
      </PremiumCard>

      <Pressable
        disabled={submitting}
        onPress={submit}
        style={[styles.submit, { backgroundColor: Colors.primary, opacity: submitting ? 0.65 : 1 }]}
      >
        {submitting ? <ActivityIndicator color={Colors.onPrimary} /> : <Text style={[styles.submitText, { color: Colors.onPrimary }]}>Confirm booking</Text>}
      </Pressable>
    </ScrollView>
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
  time: { width: '30%', minHeight: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 51, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, fontSize: 15 },
  submit: { minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  submitText: { fontSize: 15, fontWeight: '800' },
});
