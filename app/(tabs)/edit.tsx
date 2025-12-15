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

/* ---------------- WEB / NATIVE ALERT HELPER ---------------- */

const showMessage = (message: string) => {
  if (Platform.OS === 'web') {
    window.confirm(message); // confirm works on web
  } else {
    Alert.alert(message);
  }
};

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
      showMessage('You cannot edit appointments');
      router.replace('/(tabs)/upcoming');
      return;
    }

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (error || !data) {
      showMessage('Appointment not found');
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

    setLoading(false);
  };

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const handleSave = async () => {
    if (!fullName || !phone || !treatment || !location || !time) {
      showMessage('Ju lutem plotësoni të gjitha fushat');
      return;
    }

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
      .select('id');

    if (error) {
      showMessage(error.message);
      setLoading(false);
      return;
    }

    await supabase.from('audit_logs').insert({
      actor_id: user!.id,
      action: 'UPDATE_APPOINTMENT',
      target_id: appointmentId,
    });

    showMessage('Termini u përditësua');
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
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Edito Termin</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Emri dhe Mbiemri</Text>
        <TextInput value={fullName} onChangeText={setFullName} style={styles.input} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Numri kontaktues</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          style={styles.input}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Tretmani</Text>
        {TREATMENTS.map((item) => (
          <Pressable
            key={item}
            style={[
              styles.option,
              treatment === item && styles.optionActive,
            ]}
            onPress={() => setTreatment(item)}
          >
            <Text
              style={[
                styles.optionText,
                treatment === item && styles.optionTextActive,
              ]}
            >
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

      <Pressable style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Ruaj Ndryshimet</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ---------------- STYLES (UNCHANGED) ---------------- */

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#FAF8F4',
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2B2B2B',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#7A7A7A',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E6D3A3',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    backgroundColor: '#FAF8F4',
  },
  option: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6D3A3',
    marginBottom: 8,
  },
  optionActive: {
    backgroundColor: '#C9A24D',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B2B2B',
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  button: {
    backgroundColor: '#C9A24D',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#7A7A7A',
  },
});
