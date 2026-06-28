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
import { notifyStaffAppointmentChange } from '../../utils/appointmentStaffNotifications';

import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

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

  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [treatment, setTreatment] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);
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
      Alert.alert('Qasja u refuzua', 'Nuk mund të ndryshoni termine.');
      router.replace('/(tabs)/upcoming');
      return;
    }

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (error || !data) {
      Alert.alert('Gabim', 'Termini nuk u gjet.');
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

  const buildChanges = () => {
    if (!originalData) return null;
    const changes: any = {};
    const compare = (label: string, oldVal: any, newVal: any) => {
      if (oldVal !== newVal) changes[label] = { old: oldVal, new: newVal };
    };

    compare('Emri', originalData.client_name, fullName);
    compare('Telefoni', originalData.phone, phone);
    compare('Trajtimi', originalData.service, treatment);
    compare('Data', originalData.appointment_date, formatDate(date));
    compare('Ora', originalData.appointment_time, time);
    compare('Lokacioni', originalData.location, location);
    compare('Komenti', originalData.comment, comment);

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
      Alert.alert('Gabim', 'Mungon ID e terminit.');
      return;
    }

    if (!fullName || !phone || !treatment || !location || !time) {
      Alert.alert('Gabim', 'Ju lutem plotësoni të gjitha fushat');
      return;
    }

    const ok = await confirmSave();
    if (!ok) return;

    setLoading(true);

    const { data: updatedRows, error } = await supabase
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
    } catch {}

    void notifyStaffAppointmentChange('updated', updatedRows?.[0] ?? {
      id: appointmentId,
      client_name: fullName,
      service: treatment,
      appointment_date: formatDate(date),
      appointment_time: time,
      location,
    });

    Alert.alert('Sukses', 'Termini u përditësua');
    router.replace('/(tabs)/upcoming');
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, { color: Colors.muted }]}>
          Duke u ngarkuar…
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: Colors.background },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: Colors.text }]}>
        Edito Termin
      </Text>

      {/* BASIC FIELDS */}
      {[
        { label: 'Emri dhe Mbiemri', value: fullName, set: setFullName },
        { label: 'Numri kontaktues', value: phone, set: setPhone },
      ].map((f, i) => (
        <View key={i} style={[styles.card, { backgroundColor: Colors.card }]}>
          <Text style={[styles.label, { color: Colors.muted }]}>
            {f.label}
          </Text>
          <TextInput
            value={f.value}
            onChangeText={f.set}
            keyboardType={i === 1 ? 'phone-pad' : 'default'}
            style={[
              styles.input,
              {
                borderColor: Colors.primary,
                color: Colors.text,
                backgroundColor: Colors.background,
              },
            ]}
          />
        </View>
      ))}

      {/* TREATMENT */}
      <View style={[styles.card, { backgroundColor: Colors.card }]}>
        <Text style={[styles.label, { color: Colors.muted }]}>
          Tretmani
        </Text>
        {TREATMENTS.map((item) => (
          <Pressable
            key={item}
            style={[
              styles.option,
              { borderColor: Colors.primary },
              treatment === item && { backgroundColor: Colors.primary },
            ]}
            onPress={() => setTreatment(item)}
          >
            <Text
              style={[
                styles.optionText,
                { color: treatment === item ? '#fff' : Colors.text },
              ]}
            >
              {item}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* COMMENT */}
      <View style={[styles.card, { backgroundColor: Colors.card }]}>
        <Text style={[styles.label, { color: Colors.muted }]}>
          Koment
        </Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          multiline
          style={[
            styles.input,
            {
              height: 90,
              borderColor: Colors.primary,
              color: Colors.text,
              backgroundColor: Colors.background,
            },
          ]}
        />
      </View>

      {/* DATE */}
      <View style={[styles.card, { backgroundColor: Colors.card }]}>
        <Text style={[styles.label, { color: Colors.muted }]}>
          Data
        </Text>

        {Platform.OS === 'web' ? (
          <input
            type="date"
            value={formatDate(date)}
            onChange={(e) => setDate(new Date(e.target.value))}
            style={{
              border: `1px solid ${Colors.primary}`,
              borderRadius: 12,
              padding: 14,
              fontSize: 15,
              backgroundColor: Colors.background,
              color: Colors.text,
            }}
          />
        ) : (
          <>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={[
                styles.input,
                {
                  borderColor: Colors.primary,
                  backgroundColor: Colors.background,
                },
              ]}
            >
              <Text style={{ color: Colors.text }}>
                {formatDate(date)}
              </Text>
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

      {/* TIME */}
      <View style={[styles.card, { backgroundColor: Colors.card }]}>
        <Text style={[styles.label, { color: Colors.muted }]}>
          Ora
        </Text>
        <View style={styles.timeGrid}>
          {TIME_SLOTS.map((slot) => (
            <Pressable
              key={slot}
              onPress={() => setTime(slot)}
              style={[
                styles.timeSlot,
                { borderColor: Colors.primary },
                time === slot && { backgroundColor: Colors.primary },
              ]}
            >
              <Text
                style={{
                  color: time === slot ? '#fff' : Colors.text,
                  fontWeight: '600',
                  textAlign: 'center',
                }}
              >
                {slot}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* LOCATION */}
      <View style={[styles.card, { backgroundColor: Colors.card }]}>
        <Text style={[styles.label, { color: Colors.muted }]}>
          Lokacioni
        </Text>
        {LOCATIONS.map((loc) => (
          <Pressable
            key={loc}
            style={[
              styles.option,
              { borderColor: Colors.primary },
              location === loc && { backgroundColor: Colors.primary },
            ]}
            onPress={() => setLocation(loc)}
          >
            <Text
              style={[
                styles.optionText,
                { color: location === loc ? '#fff' : Colors.text },
              ]}
            >
              {loc}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.button, { backgroundColor: Colors.primary }]}
        onPress={handleSave}
      >
        <Text style={styles.buttonText}>Ruaj Ndryshimet</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 50 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8, marginBottom: 22 },
  card: { padding: 18, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(128,128,128,0.18)' },
  label: { fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 14, padding: 14 },
  option: { padding: 13, borderRadius: 13, borderWidth: 1, marginBottom: 8 },
  optionText: { fontWeight: '600' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  timeSlot: { width: '30%', margin: '1.5%', padding: 11, borderWidth: 1, borderRadius: 13 },
  button: { padding: 18, borderRadius: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '800' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10 },
});
