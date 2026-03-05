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
  Modal,
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
  const [receiptData, setReceiptData] = useState<AppointmentReceiptData | null>(
    null
  );

  const { user } = useAuth();

  const [blockedTimes, setBlockedTimes] = useState<Set<string>>(new Set());

  const [timeModalOpen, setTimeModalOpen] = useState(false);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const fetchBlockedTimes = async (
    selectedDate: Date,
    selectedLocation: string | null
  ) => {
    const day = formatDate(selectedDate);

    const q = supabase
      .from('appointments')
      .select('appointment_time')
      .eq('appointment_date', day)
      .eq('archived', false);

    if (selectedLocation) {
      q.eq('location', selectedLocation);
    }

    const { data, error } = await q;
    if (error) return;

    const set = new Set<string>();
    (data ?? []).forEach((row: any) => {
      const t = String(row.appointment_time ?? '').slice(0, 5);
      if (t) set.add(t);
    });

    setBlockedTimes(set);

    if (time && set.has(time)) {
      setTime(null);
    }
  };

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
      const insertPayload = {
        client_name: clientName,
        service: selectedService,
        appointment_date: formatDate(date),
        appointment_time: selectedTime,
        location: selectedLocation,
        phone: clientPhone,
        comment: comment.trim() || null,
        created_by: user.id,
      };

      const { data: apptRows, error: apptErr } = await supabase
        .from('appointments')
        .insert(insertPayload)
        .select('id')
        .limit(1);

      if (apptErr) {
        Alert.alert('Gabim', apptErr.message);
        return;
      }

      const apptId =
        Array.isArray(apptRows) && apptRows[0]?.id ? apptRows[0].id : null;

      if (!apptId) {
        Alert.alert('Gabim', 'Appointment created but ID was not returned.');
        return;
      }

      const { error: logErr } = await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'CREATE_APPOINTMENT',
        target_id: apptId,
        metadata: {
          appointment: {
            id: apptId,
            client_name: clientName,
            appointment_date: formatDate(date),
            appointment_time: selectedTime,
            location: selectedLocation,
            service: selectedService,
          },
        },
      });

      if (logErr) {
        Alert.alert('Gabim', logErr.message);
        return;
      }

      setReceiptData({
        client_name: clientName,
        service: selectedService,
        appointment_date: formatDate(date),
        appointment_time: selectedTime,
        location: selectedLocation,
        phone: clientPhone,
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
                  backgroundColor:
                    treatment === t ? Colors.primary : Colors.background,
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
                  backgroundColor:
                    location === l ? Colors.primary : Colors.background,
                },
              ]}
              onPress={async () => {
                setLocation(l);
                await fetchBlockedTimes(date, l);
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

        <Text style={[styles.label, { color: Colors.text }]}>Data</Text>

        {Platform.OS === 'web' ? (
          <input
            type="date"
            value={formatDate(date)}
            onChange={async (e) => {
              const d = new Date(e.target.value);
              setDate(d);
              await fetchBlockedTimes(d, location);
            }}
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
                onChange={async (_, d) => {
                  setShowDatePicker(false);
                  if (d) {
                    setDate(d);
                    await fetchBlockedTimes(d, location);
                  }
                }}
              />
            )}
          </>
        )}

        <Text style={[styles.label, { color: Colors.text }]}>Ora</Text>

        {/* ✅ WEB (PHONE + DESKTOP): REAL DROPDOWN */}
        {Platform.OS === 'web' ? (
          <select
            value={time ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setTime(v ? v : null);
            }}
            disabled={!location}
            style={{
              width: '100%',
              padding: 14,
              fontSize: 15,
              borderRadius: 12,
              border: `1px solid ${Colors.primary}`,
              backgroundColor: Colors.background,
              color: Colors.text,
              opacity: !location ? 0.7 : 1,
            }}
          >
            <option value="" disabled>
              Zgjedh Orën
            </option>

            {TIMES.map((t) => (
              <option key={t} value={t} disabled={blockedTimes.has(t)}>
                {blockedTimes.has(t) ? `${t} (Unavailable)` : t}
              </option>
            ))}
          </select>
        ) : (
          <>
            {/* ✅ NATIVE: MODAL DROPDOWN */}
            <Pressable
              style={[
                styles.input,
                {
                  backgroundColor: Colors.background,
                  borderColor: Colors.primary,
                  opacity: !location ? 0.7 : 1,
                },
              ]}
              onPress={() => {
                if (!location) {
                  Alert.alert('Gabim', 'Zgjedh lokacionin së pari');
                  return;
                }
                setTimeModalOpen(true);
              }}
            >
              <Text
                style={{
                  color: time ? Colors.text : Colors.muted,
                  fontWeight: '800',
                }}
              >
                {time ? time : 'Zgjedh Orën'}
              </Text>
            </Pressable>

            <Modal
              visible={timeModalOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setTimeModalOpen(false)}
            >
              <Pressable
                style={styles.modalOverlay}
                onPress={() => setTimeModalOpen(false)}
              >
                <View style={[styles.modalCard, { backgroundColor: Colors.card }]}>
                  <Text style={[styles.modalTitle, { color: Colors.text }]}>
                    Zgjedh Orën
                  </Text>

                  <ScrollView style={{ maxHeight: 320 }}>
                    {TIMES.map((t) => {
                      const isBlocked = blockedTimes.has(t);
                      const isSelected = time === t;

                      return (
                        <Pressable
                          key={t}
                          disabled={isBlocked}
                          onPress={() => {
                            setTime(t);
                            setTimeModalOpen(false);
                          }}
                          style={[
                            styles.timeRow,
                            {
                              backgroundColor: isSelected
                                ? Colors.primary
                                : Colors.background,
                              opacity: isBlocked ? 0.35 : 1,
                              borderColor: Colors.primary,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: isSelected ? '#fff' : Colors.text,
                              fontWeight: '900',
                            }}
                          >
                            {t}
                          </Text>
                          {isBlocked && (
                            <Text style={{ color: Colors.muted, fontSize: 12 }}>
                              Unavailable
                            </Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Pressable
                    onPress={() => setTimeModalOpen(false)}
                    style={{ paddingTop: 12 }}
                  >
                    <Text
                      style={{
                        color: Colors.muted,
                        fontWeight: '800',
                        textAlign: 'center',
                      }}
                    >
                      Close
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            </Modal>
          </>
        )}

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
  optionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  modalCard: {
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
  },
  timeRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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