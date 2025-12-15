'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, router } from 'expo-router';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

/* ---------------- OPTIONS ---------------- */

const TREATMENTS = [
  'Pastrimi i fytyrës',
  'Carbon Peeling',
  'Depilim me Laser',
  'Largim i Tatuazhit',
  'Plasma Pen',
  'EMS',
  'Manikyr',
  'Microblading',
];

const LOCATIONS = ['Prishtinë', 'Fushë Kosovë'];

const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let h = 9; h <= 21; h++) {
    for (let m of [0, 30]) {
      if (h === 21 && m === 30) continue;
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

type Role = 'owner' | 'manager' | 'staff';

export default function EditAppointment() {
  const params = useLocalSearchParams();
  const appointmentId =
    typeof params.id === 'string' ? params.id : params.id?.[0];

  const { user } = useAuth();

  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [treatment, setTreatment] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);

  // ✅ NEW: store original values for audit diff
  const [originalData, setOriginalData] = useState<any>(null);

  useEffect(() => {
    if (user && appointmentId) loadData();
  }, [user, appointmentId]);

  const loadData = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single();

    if (!profile || (profile.role as Role) === 'staff') {
      Alert.alert('Access denied', 'You cannot edit appointments');
      router.replace('/(tabs)/upcoming');
      return;
    }

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (error || !data) {
      Alert.alert('Error', 'Appointment not found');
      router.replace('/(tabs)/upcoming');
      return;
    }

    setFullName(data.client_name);
    setPhone(data.phone);
    setTreatment(data.service);
    setLocation(data.location);
    setDate(new Date(data.appointment_date));
    setTime(data.appointment_time);
    setComment(data.comment ?? '');

    // ✅ NEW: save original values for audit
    setOriginalData({
      client_name: data.client_name,
      phone: data.phone,
      service: data.service,
      appointment_date: data.appointment_date,
      appointment_time: data.appointment_time,
      location: data.location,
      comment: data.comment ?? '',
    });

    setLoading(false);
  };

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  // ✅ NEW: build old → new changes safely
  const buildChanges = () => {
    if (!originalData) return null;

    const changes: any = {};

    const compare = (label: string, oldVal: any, newVal: any) => {
      if (oldVal !== newVal) {
        changes[label] = { old: oldVal, new: newVal };
      }
    };

    compare('Name', originalData.client_name, fullName);
    compare('Phone', originalData.phone, phone);
    compare('Treatment', originalData.service, treatment);
    compare('Date', originalData.appointment_date, formatDate(date));
    compare('Time', originalData.appointment_time, time);
    compare('Location', originalData.location, location);
    compare('Comment', originalData.comment, comment);

    return Object.keys(changes).length > 0 ? changes : null;
  };

  const confirmSave = async () => {
    if (Platform.OS === 'web') {
      return window.confirm('A jeni të sigurt që doni të ruani ndryshimet?');
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert('Konfirmim', 'A jeni të sigurt?', [
        { text: 'Jo', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Po', onPress: () => resolve(true) },
      ]);
    });
  };

  const handleSave = async () => {
    if (!appointmentId) {
      Alert.alert('Error', 'Missing appointment ID');
      return;
    }

    if (!fullName || !phone || !treatment || !location || !time) {
      Alert.alert('Gabim', 'Ju lutem plotësoni të gjitha fushat');
      return;
    }

    const ok = await confirmSave();
    if (!ok) return;

    setLoading(true);

    const { error } = await supabase
      .from('appointments')
      .update({
        client_name: fullName,
        phone,
        service: treatment,
        appointment_date: formatDate(date),
        appointment_time: time,
        location,
        comment: comment || null,
      })
      .eq('id', appointmentId)
      .select();

    if (error) {
      Alert.alert('Gabim', error.message);
      setLoading(false);
      return;
    }

    // ✅ NEW: safe audit logging (cannot break edit)
    try {
      await supabase.from('audit_logs').insert({
        actor_id: user!.id,
        action: 'UPDATE_APPOINTMENT',
        target_id: appointmentId,
        metadata: {
          source: 'edit.tsx',
          changed: buildChanges(),
        },
      });
    } catch (e) {
      console.warn('Audit log failed', e);
    }

    Alert.alert('Sukses', 'Termini u përditësua');
    router.replace('/(tabs)/upcoming');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#C9A24D" />
        <Text style={styles.loadingText}>Duke u ngarkuar…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Edito Termin</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Emri dhe Mbiemri</Text>
        <TextInput value={fullName} onChangeText={setFullName} style={styles.input} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Numri kontaktues</Text>
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Tretmani</Text>
        {TREATMENTS.map((item) => (
          <Pressable
            key={item}
            style={[styles.option, treatment === item && styles.optionActive]}
            onPress={() => setTreatment(item)}
          >
            <Text style={[styles.optionText, treatment === item && styles.optionTextActive]}>
              {item}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Koment</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          multiline
          style={[styles.input, { height: 90 }]}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Data</Text>

        {Platform.OS === 'web' ? (
          <input
            type="date"
            value={formatDate(date)}
            onChange={(e) => setDate(new Date(e.target.value))}
            style={{
              borderWidth: 1,
              borderColor: '#E6D3A3',
              borderRadius: 12,
              padding: 14,
              fontSize: 15,
              backgroundColor: '#FAF8F4',
            }}
          />
        ) : (
          <>
            <Pressable onPress={() => setShowDatePicker(true)} style={styles.input}>
              <Text>{formatDate(date)}</Text>
            </Pressable>

            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                onChange={(_, d) => {
                  setShowDatePicker(false);
                  if (d) setDate(d);
                }}
              />
            )}
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Ora</Text>
        <View style={styles.timeGrid}>
          {TIME_SLOTS.map((slot) => (
            <Pressable
              key={slot}
              onPress={() => setTime(slot)}
              style={[styles.timeSlot, time === slot && styles.timeSlotActive]}
            >
              <Text style={[styles.timeText, time === slot && styles.timeTextActive]}>
                {slot}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Lokacioni</Text>
        {LOCATIONS.map((loc) => (
          <Pressable
            key={loc}
            style={[styles.option, location === loc && styles.optionActive]}
            onPress={() => setLocation(loc)}
          >
            <Text style={[styles.optionText, location === loc && styles.optionTextActive]}>
              {loc}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Ruaj Ndryshimet</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#FAF8F4' },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 20 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 16 },
  label: { fontSize: 13, marginBottom: 6, color: '#7A7A7A' },
  input: { borderWidth: 1, borderColor: '#E6D3A3', borderRadius: 12, padding: 14 },
  option: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E6D3A3', marginBottom: 8 },
  optionActive: { backgroundColor: '#C9A24D' },
  optionText: { fontWeight: '600' },
  optionTextActive: { color: '#fff' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  timeSlot: { width: '30%', margin: '1.5%', padding: 10, borderWidth: 1, borderRadius: 10 },
  timeSlotActive: { backgroundColor: '#C9A24D' },
  timeText: { fontWeight: '600', textAlign: 'center' },
  timeTextActive: { color: '#fff' },
  button: { backgroundColor: '#C9A24D', padding: 18, borderRadius: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '800' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10 },
});
