'use client';

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

/* -------------------- OPTIONS -------------------- */

const TREATMENTS = [
  'Pastrimi i fytyrës',
  'Carbon Peeling',
  'Depilim me Laser',
  'Largim i Tatuazhit',
  'Plasma Pen',
  'Manikyr',
];

const LOCATIONS = ['Prishtinë', 'Fushë Kosovë'];

/* Generate time slots from 09:00 to 21:00 every 30 min */
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

/* -------------------- SCREEN -------------------- */

export default function CreateAppointment() {
  const { user } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [treatment, setTreatment] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState<string | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const handleCreate = async () => {
    if (!fullName || !phone || !treatment || !location || !time || !user) {
      Alert.alert('Gabim', 'Ju lutem plotësoni të gjitha fushat');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('appointments').insert({
        client_name: fullName,
        service: treatment,
        appointment_date: formatDate(date),
        appointment_time: time,
        location,
        phone,
        comment: comment.trim() || null,
        created_by: user.id,
      });

      if (error) {
        Alert.alert('Gabim', error.message);
        return;
      }

      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'CREATE_APPOINTMENT',
      });

      Alert.alert('Sukses', 'Termini u krijua me sukses');
      router.replace('/(tabs)/upcoming');
    } catch {
      Alert.alert('Gabim', 'Diçka shkoi keq');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Termin i Ri</Text>

      {/* Full name */}
      <View style={styles.card}>
        <Text style={styles.label}>Emri dhe Mbiemri</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Emri i klientit"
          placeholderTextColor="#B5B5B5"
          style={styles.input}
        />
      </View>

      {/* Phone */}
      <View style={styles.card}>
        <Text style={styles.label}>Numri kontaktues</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="04x - xxx - xxx"
          placeholderTextColor="#B5B5B5"
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
            style={[styles.option, treatment === item && styles.optionActive]}
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

      {/* DATE */}
      <View style={styles.card}>
        <Text style={styles.label}>Data</Text>

        {Platform.OS === 'web' ? (
          <View style={styles.webDateWrapper}>
            <input
              type="date"
              value={formatDate(date)}
              onChange={(e) => setDate(new Date(e.target.value))}
              style={{
                width: '100%',
                padding: 14,
                fontSize: 15,
                borderRadius: 12,
                border: '1px solid #E6D3A3',
                backgroundColor: '#FAF8F4',
              }}
            />
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={styles.input}
            >
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
          </>
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
            style={[styles.option, location === loc && styles.optionActive]}
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

      {/* Comment */}
      <View style={styles.card}>
        <Text style={styles.label}>Koment për klientin (opsionale)</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Shënime shtesë, kërkesa speciale, etj."
          placeholderTextColor="#B5B5B5"
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          multiline
        />
      </View>

      {/* Submit */}
      <Pressable
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Duke ruajtur…' : 'Krijo Termin'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

/* -------------------- STYLES -------------------- */

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

  webDateWrapper: {
    width: '100%',
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
});
