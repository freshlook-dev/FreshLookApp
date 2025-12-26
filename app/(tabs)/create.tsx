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

import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

/* -------------------- OPTIONS -------------------- */

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

  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

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
      contentContainerStyle={[
        styles.container,
        { backgroundColor: Colors.background },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: Colors.text }]}>
        Termin i Ri
      </Text>

      {/* Full name */}
      <View style={[styles.card, { backgroundColor: Colors.card }]}>
        <Text style={[styles.label, { color: Colors.muted }]}>
          Emri dhe Mbiemri
        </Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Emri i klientit"
          placeholderTextColor={Colors.muted}
          style={[
            styles.input,
            {
              backgroundColor: Colors.background,
              borderColor: Colors.primary,
              color: Colors.text,
            },
          ]}
        />
      </View>

      {/* Phone */}
      <View style={[styles.card, { backgroundColor: Colors.card }]}>
        <Text style={[styles.label, { color: Colors.muted }]}>
          Numri kontaktues
        </Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="04x - xxx - xxx"
          placeholderTextColor={Colors.muted}
          keyboardType="phone-pad"
          style={[
            styles.input,
            {
              backgroundColor: Colors.background,
              borderColor: Colors.primary,
              color: Colors.text,
            },
          ]}
        />
      </View>

      {/* Treatment */}
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
              treatment === item && styles.optionActive,
            ]}
            onPress={() => setTreatment(item)}
          >
            <Text
              style={[
                styles.optionText,
                { color: Colors.text },
                treatment === item && styles.optionTextActive,
              ]}
            >
              {item}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* DATE */}
      <View style={[styles.card, { backgroundColor: Colors.card }]}>
        <Text style={[styles.label, { color: Colors.muted }]}>
          Data
        </Text>

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
                border: `1px solid ${Colors.primary}`,
                backgroundColor: Colors.background,
                color: Colors.text,
              }}
            />
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={[
                styles.input,
                {
                  backgroundColor: Colors.background,
                  borderColor: Colors.primary,
                },
              ]}
            >
              <Text
                style={[styles.valueText, { color: Colors.text }]}
              >
                {formatDate(date)}
              </Text>
            </Pressable>

            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={
                  Platform.OS === 'ios' ? 'spinner' : 'default'
                }
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
                time === slot && styles.timeSlotActive,
              ]}
            >
              <Text
                style={[
                  styles.timeText,
                  { color: Colors.text },
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
              location === loc && styles.optionActive,
            ]}
            onPress={() => setLocation(loc)}
          >
            <Text
              style={[
                styles.optionText,
                { color: Colors.text },
                location === loc && styles.optionTextActive,
              ]}
            >
              {loc}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Comment */}
      <View style={[styles.card, { backgroundColor: Colors.card }]}>
        <Text style={[styles.label, { color: Colors.muted }]}>
          Koment për klientin (opsionale)
        </Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Shënime shtesë, kërkesa speciale, etj."
          placeholderTextColor={Colors.muted}
          style={[
            styles.input,
            {
              height: 100,
              textAlignVertical: 'top',
              backgroundColor: Colors.background,
              borderColor: Colors.primary,
              color: Colors.text,
            },
          ]}
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
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 20,
  },
  card: {
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
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  valueText: {
    fontSize: 15,
    fontWeight: '600',
  },
  option: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  optionActive: {
    backgroundColor: '#C9A24D',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
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
    alignItems: 'center',
  },
  timeSlotActive: {
    backgroundColor: '#C9A24D',
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
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
