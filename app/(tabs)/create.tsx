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

import AppointmentCardModal, {
  AppointmentReceiptData,
} from '../../components/AppointmentCardModal';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

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
  const [receiptData, setReceiptData] = useState<AppointmentReceiptData | null>(
    null
  );

  const { user } = useAuth();

  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const handleCreate = async () => {
    const clientName = fullName.trim();
    const clientPhone = phone.trim();
    const selectedService = treatment;
    const selectedLocation = location;
    const selectedTime = time;

    if (
      !clientName ||
      !clientPhone ||
      !selectedService ||
      !selectedLocation ||
      !selectedTime ||
      !user
    ) {
      Alert.alert('Gabim', 'Ju lutem plotësoni të gjitha fushat');
      return;
    }

    setLoading(true);

    try {
      const { data: apptRows, error: apptErr } = await supabase
        .from('appointments')
        .insert({
          client_name: clientName,
          service: selectedService,
          appointment_date: formatDate(date),
          appointment_time: selectedTime,
          location: selectedLocation,
          phone: clientPhone,
          comment: comment.trim() || null,
          created_by: user.id,
        })
        .select('id')
        .limit(1);

      if (apptErr) {
        Alert.alert('Gabim', apptErr.message);
        return;
      }

      const apptId =
        Array.isArray(apptRows) && apptRows[0]?.id ? apptRows[0].id : null;

      setReceiptData({
        client_name: clientName,
        service: selectedService as string,
        appointment_date: formatDate(date),
        appointment_time: selectedTime,
        location: selectedLocation,
        phone: clientPhone,
      });

      setReceiptVisible(true);

      try {
        await supabase.from('audit_logs').insert({
          actor_id: user.id,
          action: 'CREATE_APPOINTMENT',
          target_id: apptId,
        });
      } catch {}
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

  const toggleTimeDropdown = () => {
    if (!location) {
      Alert.alert('Gabim', 'Zgjedh lokacionin së pari');
      return;
    }
    setTimeDropdownOpen((v) => !v);
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        styles.container,
        { backgroundColor: Colors.background },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.page}>

        <Text style={[styles.title, { color: Colors.text }]}>
          Krijo Termin
        </Text>

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

        <View style={[styles.card, { backgroundColor: Colors.card }]}>
          <Text style={[styles.sectionTitle, { color: Colors.primary }]}>
            Detajet e Terminit
          </Text>

          <Text style={[styles.label, { color: Colors.text }]}>
            Shërbimi
          </Text>

          <View style={styles.optionsWrap}>
            {TREATMENTS.map((t) => (
              <Pressable
                key={t}
                style={[
                  styles.optionPill,
                  {
                    borderColor: Colors.primary,
                    backgroundColor:
                      treatment === t
                        ? Colors.primary
                        : Colors.background,
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

          <Text style={[styles.label, { color: Colors.text }]}>
            Lokacioni
          </Text>

          <View style={styles.optionsWrap}>
            {LOCATIONS.map((l) => (
              <Pressable
                key={l}
                style={[
                  styles.optionPill,
                  {
                    borderColor: Colors.primary,
                    backgroundColor:
                      location === l
                        ? Colors.primary
                        : Colors.background,
                  },
                ]}
                onPress={() => {
                  setLocation(l);
                  setTimeDropdownOpen(false);
                }}
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

          <Text style={[styles.label, { color: Colors.text }]}>
            Data
          </Text>

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
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={[
                  styles.input,
                  {
                    backgroundColor: Colors.background,
                    borderColor: Colors.primary,
                    width: '100%',
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
                  display="default"
                  onChange={(_, d) => {
                    setShowDatePicker(false);
                    if (d) setDate(d);
                  }}
                />
              )}
            </>
          )}

          <Text style={[styles.label, { color: Colors.text }]}>
            Ora
          </Text>

          <View style={styles.optionsWrap}>
            {TIMES.map((t) => {
              const isSelected = time === t;
              return (
                <Pressable
                  key={t}
                  disabled={!location}
                  onPress={() => setTime(t)}
                  style={[
                    styles.timePill,
                    {
                      borderColor: Colors.primary,
                      backgroundColor:
                        isSelected
                          ? Colors.primary
                          : Colors.background,
                      opacity: !location ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: isSelected ? '#fff' : Colors.text },
                    ]}
                  >
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: Colors.text }]}>
            Koment (opsional)
          </Text>

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
      </View>

      <AppointmentCardModal
        visible={receiptVisible}
        onClose={handleCloseReceipt}
        data={receiptData}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({

  container: {
    padding: 20,
    paddingBottom: 40,
  },

  page: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },

  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 20,
  },

  card: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    width: '100%',
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 14,
  },

  label: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 12,
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
    width: '100%',
  },

  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
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
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
});