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

import AppointmentCardModal, { AppointmentReceiptData } from '../../components/AppointmentCardModal';

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
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
  }
  return slots;
};

const TIMES = generateTimeSlots();

export default function CreateAppointmentScreen() {
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [treatment, setTreatment] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [time, setTime] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const [loading, setLoading] = useState(false);

  const [receiptVisible, setReceiptVisible] = useState(false);
  const [receiptData, setReceiptData] = useState<AppointmentReceiptData | null>(null);

  const { user } = useAuth();

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

      setReceiptData({
        client_name: fullName.trim(),
        service: treatment as string,
        appointment_date: formatDate(date),
        appointment_time: time as string,
        location: location as string,
        phone: phone.trim(),
      });
      setReceiptVisible(true);
    } catch {
      Alert.alert('Gabim', 'Diçka shkoi keq');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseReceipt = () => {
    setReceiptVisible(false);
    setReceiptData(null);
    router.replace('/(tabs)/upcoming');
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
      <Text style={[styles.title, { color: Colors.text }]}>Krijo Termin</Text>

      {/* CLIENT INFO */}
      <View style={[styles.card, { backgroundColor: Colors.card }]}>
        <Text style={[styles.sectionTitle, { color: Colors.primary }]}>
          Informacioni i Klientit
        </Text>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: Colors.background,
              borderColor: Colors.primary,
              color: Colors.text,
            },
          ]}
          placeholder="Emri dhe Mbiemri"
          placeholderTextColor={Colors.muted}
          value={fullName}
          onChangeText={setFullName}
        />

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: Colors.background,
              borderColor: Colors.primary,
              color: Colors.text,
            },
          ]}
          placeholder="Numri i Telefonit"
          placeholderTextColor={Colors.muted}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      </View>

      {/* APPOINTMENT DETAILS */}
      <View style={[styles.card, { backgroundColor: Colors.card }]}>
        <Text style={[styles.sectionTitle, { color: Colors.primary }]}>
          Detajet e Terminit
        </Text>

        <Text style={[styles.label, { color: Colors.text }]}>Shërbimi</Text>
        <View style={styles.optionsWrap}>
          {TREATMENTS.map((t) => (
            <Pressable
              key={t}
              style={[
                styles.optionPill,
                {
                  borderColor: Colors.primary,
                  backgroundColor: treatment === t ? Colors.primary : Colors.background,
                },
              ]}
              onPress={() => setTreatment(t)}
            >
              <Text
                style={[
                  styles.optionText,
                  { color: treatment === t ? '#fff' : Colors.text },
                ]}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: Colors.text }]}>Lokacioni</Text>
        <View style={styles.optionsWrap}>
          {LOCATIONS.map((l) => (
            <Pressable
              key={l}
              style={[
                styles.optionPill,
                {
                  borderColor: Colors.primary,
                  backgroundColor: location === l ? Colors.primary : Colors.background,
                },
              ]}
              onPress={() => setLocation(l)}
            >
              <Text
                style={[
                  styles.optionText,
                  { color: location === l ? '#fff' : Colors.text },
                ]}
              >
                {l}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: Colors.text }]}>Data</Text>

        {Platform.OS === 'web' ? (
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
        ) : (
          <>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={[
                styles.input,
                styles.dateInput,
                {
                  backgroundColor: Colors.background,
                  borderColor: Colors.primary,
                },
              ]}
            >
              <Text style={{ color: Colors.text, fontWeight: '700' }}>
                {formatDate(date)}
              </Text>
            </Pressable>

            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  setShowDatePicker(false);
                  if (d) setDate(d);
                }}
              />
            )}
          </>
        )}

        <Text style={[styles.label, { color: Colors.text }]}>Ora</Text>
        <View style={styles.optionsWrap}>
          {TIMES.map((t) => (
            <Pressable
              key={t}
              style={[
                styles.timePill,
                {
                  borderColor: Colors.primary,
                  backgroundColor: time === t ? Colors.primary : Colors.background,
                },
              ]}
              onPress={() => setTime(t)}
            >
              <Text
                style={[
                  styles.optionText,
                  { color: time === t ? '#fff' : Colors.text },
                ]}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: Colors.text }]}>Koment (opsional)</Text>
        <TextInput
          style={[
            styles.input,
            styles.textArea,
            {
              backgroundColor: Colors.background,
              borderColor: Colors.primary,
              color: Colors.text,
            },
          ]}
          placeholder="Shkruaj ndonjë koment…"
          placeholderTextColor={Colors.muted}
          value={comment}
          onChangeText={setComment}
          multiline
        />
      </View>

      <Pressable
        style={[
          styles.button,
          { backgroundColor: Colors.primary },
          loading && { opacity: 0.7 },
        ]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Duke ruajtur…' : 'Krijo Termin'}
        </Text>
      </Pressable>

      <AppointmentCardModal
        visible={receiptVisible}
        onClose={handleCloseReceipt}
        data={receiptData}
      />
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
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 15,
    fontWeight: '700',
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  dateInput: {
    justifyContent: 'center',
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  timePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
});