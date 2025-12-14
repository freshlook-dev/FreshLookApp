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
];

const LOCATIONS = ['Prishtinë', 'Fushë Kosovë'];

const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let h = 9; h <= 21; h++) {
    for (let m of [0, 30]) {
      if (h === 21 && m === 30) continue;
      slots.push(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      );
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

type Role = 'owner' | 'manager' | 'staff';

export default function EditAppointment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [treatment, setTreatment] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState<string | null>(null);
  const [comment, setComment] = useState(''); // ✅ NEW

  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (user && id) loadData();
  }, [user, id]);

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
      .eq('id', id)
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
    setComment(data.comment ?? ''); // ✅ LOAD COMMENT

    setLoading(false);
  };

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const handleSave = async () => {
    if (!fullName || !phone || !treatment || !location || !time) {
      Alert.alert('Gabim', 'Ju lutem plotësoni të gjitha fushat');
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
        comment: comment || null, // ✅ SAVE COMMENT
      })
      .eq('id', id);

    if (error) {
      Alert.alert('Gabim', error.message);
      setLoading(false);
      return;
    }

    await supabase.from('audit_logs').insert({
      actor_id: user!.id,
      action: 'UPDATE_APPOINTMENT',
      target_id: id,
    });

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
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Edito Termin</Text>

      {/* Name */}
      <View style={styles.card}>
        <Text style={styles.label}>Emri dhe Mbiemri</Text>
        <TextInput value={fullName} onChangeText={setFullName} style={styles.input} />
      </View>

      {/* Phone */}
      <View style={styles.card}>
        <Text style={styles.label}>Numri kontaktues</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          style={styles.input}
        />
      </View>

      {/* Treatment */}
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

      {/* Comment */}
      <View style={styles.card}>
        <Text style={styles.label}>Koment</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Shënime shtesë…"
          multiline
          style={[styles.input, { height: 90 }]}
        />
      </View>

      {/* Date */}
      <View style={styles.card}>
        <Text style={styles.label}>Data</Text>
        <Pressable onPress={() => setShowDatePicker(true)} style={styles.input}>
          <Text style={styles.valueText}>{formatDate(date)}</Text>
        </Pressable>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(e, d) => {
              setShowDatePicker(false);
              if (d) setDate(d);
            }}
          />
        )}
      </View>

      {/* Time */}
      <View style={styles.card}>
        <Text style={styles.label}>Ora</Text>
        <View style={styles.timeGrid}>
          {TIME_SLOTS.map((slot) => (
            <Pressable
              key={slot}
              onPress={() => setTime(slot)}
              style={[
                styles.timeSlot,
                time === slot && styles.timeSlotActive,
              ]}
            >
              <Text
                style={[
                  styles.timeText,
                  time === slot && styles.timeTextActive,
                ]}
              >
                {slot}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Location */}
      <View style={styles.card}>
        <Text style={styles.label}>Lokacioni</Text>
        {LOCATIONS.map((loc) => (
          <Pressable
            key={loc}
            style={[
              styles.option,
              location === loc && styles.optionActive,
            ]}
            onPress={() => setLocation(loc)}
          >
            <Text
              style={[
                styles.optionText,
                location === loc && styles.optionTextActive,
              ]}
            >
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
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
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
  valueText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2B2B2B',
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
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  timeSlot: {
    width: '30%',
    paddingVertical: 10,
    margin: '1.5%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6D3A3',
    alignItems: 'center',
  },
  timeSlotActive: {
    backgroundColor: '#C9A24D',
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2B2B2B',
  },
  timeTextActive: {
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
    backgroundColor: '#FAF8F4',
  },
  loadingText: {
    marginTop: 10,
    color: '#7A7A7A',
  },
});
