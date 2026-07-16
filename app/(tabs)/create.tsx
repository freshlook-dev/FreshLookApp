'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppointmentCardModal, {
  AppointmentReceiptData,
} from '../../components/AppointmentCardModal';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';
import { notifyStaffAppointmentChange } from '../../utils/appointmentStaffNotifications';
import {
  formatLocalDateOnly,
  kosovoDateForPicker,
  parseLocalDateOnly,
} from '../../utils/dateTime';

import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';
import { getOrderedCatalogIds } from '../../utils/catalog';

type Service = {
  id: string;
  name: string;
  price: number;
  duration: number;
  is_on_sale: boolean | null;
  sale_price: number | null;
};

function orderServices(items: Service[], orderedIds: string[]) {
  if (!orderedIds.length) return items;
  const positions = new Map(orderedIds.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const aPosition = positions.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bPosition = positions.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aPosition - bPosition;
  });
}

const LOCATIONS = ['Prishtinë', 'Fushë Kosovë'];

const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let h = 10; h <= 20; h++) {
    for (let m of [0, 30]) {
      if (h === 20 && m === 30) continue;
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
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [treatment, setTreatment] = useState<Service | null>(null);
  const [treatmentModal, setTreatmentModal] = useState(false);
  const [treatmentSearch, setTreatmentSearch] = useState('');
  const [location, setLocation] = useState<string | null>(LOCATIONS[0]);

  const [date, setDate] = useState(() => kosovoDateForPicker());
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

  useEffect(() => {
    const load = async () => {
      const [{ data, error }, { data: orderData }] = await Promise.all([
        supabase
          .from('services')
          .select('id, name, price, duration, is_on_sale, sale_price')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }),
        supabase.from('content').select('value').eq('key', 'service_order').maybeSingle(),
      ]);
      if (error) Alert.alert('Shërbimet nuk u ngarkuan', error.message);
      const orderedIds = getOrderedCatalogIds(orderData?.value);
      setServices(orderServices((data as Service[] | null) ?? [], orderedIds));
      setServicesLoading(false);
    };
    void load();
  }, []);

  const filteredServices = useMemo(() => {
    const query = treatmentSearch.trim().toLocaleLowerCase('sq-AL');
    return services.filter((item) => item.name.toLocaleLowerCase('sq-AL').includes(query));
  }, [services, treatmentSearch]);

  const handleCreate = async () => {
    if (loading) return;

    const clientName = fullName.trim();
    const clientPhone = phone.trim();
    const selectedServiceName = treatment?.name ?? null;
    const selectedLocation = location;
    const selectedTime = time;

    if (
      !clientName ||
      !clientPhone ||
      !selectedServiceName ||
      !treatment ||
      !selectedLocation ||
      !selectedTime ||
      !user
    ) {
      Alert.alert('Gabim', 'Ju lutem plotësoni të gjitha fushat');
      return;
    }

    setLoading(true);

    try {
      const { data: liveServiceRow, error: serviceError } = await supabase
        .from('services')
        .select('id, name, price, duration, is_on_sale, sale_price')
        .eq('id', treatment.id)
        .eq('is_active', true)
        .maybeSingle();
      const liveService = liveServiceRow as Service | null;

      if (serviceError || !liveService) {
        Alert.alert(
          'Gabim',
          serviceError?.message ?? 'Shërbimi i zgjedhur nuk është më aktiv.'
        );
        return;
      }

      const selectedService = liveService.name;
      const treatmentPrice = Number(
        liveService.is_on_sale && liveService.sale_price != null
          ? liveService.sale_price
          : liveService.price
      );
      const treatmentDuration = Number(liveService.duration);
      if (
        !Number.isFinite(treatmentPrice) ||
        treatmentPrice < 0 ||
        !Number.isInteger(treatmentDuration) ||
        treatmentDuration <= 0
      ) {
        Alert.alert('Gabim', 'Të dhënat e shërbimit nuk janë valide.');
        return;
      }
      const { data: createdAppointment, error: apptErr } = await supabase
        .from('appointments')
        .insert({
          client_name: clientName,
          service: selectedService,
          appointment_date: formatLocalDateOnly(date),
          appointment_time: selectedTime,
          location: selectedLocation,
          phone: clientPhone,
          comment: comment.trim() || null,
          created_by: user.id,
          selected_treatments: [{
            id: liveService.id,
            name: liveService.name,
            price: treatmentPrice,
            qty: 1,
            duration: treatmentDuration,
            total: treatmentPrice,
          }],
        })
        .select('id, client_name, service, appointment_date, appointment_time, location, status')
        .single();

      if (apptErr) {
        Alert.alert('Gabim', apptErr.message);
        return;
      }

      void notifyStaffAppointmentChange('created', createdAppointment ?? {
        client_name: clientName,
        service: selectedService,
        appointment_date: formatLocalDateOnly(date),
        appointment_time: selectedTime,
        location: selectedLocation,
        status: 'upcoming',
      });

      setReceiptData({
        client_name: clientName,
        service: selectedService as string,
        appointment_date: formatLocalDateOnly(date),
        appointment_time: selectedTime,
        location: selectedLocation,
        phone: clientPhone,
      });

      setReceiptVisible(true);

      void supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'CREATE_APPOINTMENT',
        target_id: createdAppointment?.id ?? null,
        metadata: {
          appointment: {
            id: createdAppointment?.id ?? null,
            client_name: clientName,
            phone: clientPhone,
            service: selectedService,
            appointment_date: formatLocalDateOnly(date),
            appointment_time: selectedTime,
            location: selectedLocation,
            comment: comment.trim() || null,
          },
          changed: {
            client_name: { old: null, new: clientName },
            service: { old: null, new: selectedService },
            date: { old: null, new: formatLocalDateOnly(date) },
            time: { old: null, new: selectedTime },
            location: { old: null, new: selectedLocation },
            phone: { old: null, new: clientPhone },
          },
        },
      }).then(() => undefined).catch(() => undefined);
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

          {servicesLoading ? <ActivityIndicator color={Colors.primary} /> : (
            <Pressable
              onPress={() => { setTreatmentSearch(''); setTreatmentModal(true); }}
              style={[styles.selectField, { backgroundColor: Colors.background, borderColor: Colors.primary }]}
            >
              <View style={styles.selectCopy}>
                <Text style={[styles.selectValue, { color: treatment ? Colors.text : Colors.muted }]}>{treatment?.name ?? 'Zgjidhni shërbimin'}</Text>
                {treatment && <Text style={[styles.selectMeta, { color: Colors.muted }]}>{treatment.duration} min · {Number(treatment.is_on_sale && treatment.sale_price != null ? treatment.sale_price : treatment.price).toFixed(2)} EUR</Text>}
              </View>
              <Ionicons name="chevron-down" size={20} color={Colors.primary} />
            </Pressable>
          )}

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
              value={formatLocalDateOnly(date)}
              onChange={(e) => {
                const nextDate = parseLocalDateOnly(e.target.value);
                if (nextDate) setDate(nextDate);
              }}
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
                  {formatLocalDateOnly(date)}
                </Text>
              </Pressable>

              {showDatePicker && (
                <DateTimePicker
                  locale="sq-AL"
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

      <Modal visible={treatmentModal} transparent animationType="fade" onRequestClose={() => setTreatmentModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setTreatmentModal(false)}>
          <Pressable onPress={(event) => event.stopPropagation()} style={[styles.serviceModal, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
            <View style={styles.modalHeader}>
              <View><Text style={[styles.modalEyebrow, { color: Colors.primary }]}>ZGJIDHNI</Text><Text style={[styles.modalTitle, { color: Colors.text }]}>Shërbimin</Text></View>
              <Pressable onPress={() => setTreatmentModal(false)} style={[styles.modalClose, { backgroundColor: Colors.background }]}><Ionicons name="close" size={22} color={Colors.text} /></Pressable>
            </View>
            <View style={[styles.searchBox, { backgroundColor: Colors.background, borderColor: Colors.border }]}>
              <Ionicons name="search-outline" size={19} color={Colors.muted} />
              <TextInput value={treatmentSearch} onChangeText={setTreatmentSearch} placeholder="Kërko shërbimin" placeholderTextColor={Colors.muted} style={[styles.searchInput, { color: Colors.text }]} />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {filteredServices.map((item) => {
                const selected = treatment?.id === item.id;
                const price = item.is_on_sale && item.sale_price != null ? item.sale_price : item.price;
                return <Pressable key={item.id} onPress={() => { setTreatment(item); setTreatmentModal(false); }} style={[styles.serviceOption, { backgroundColor: selected ? Colors.primarySoft : Colors.background, borderColor: selected ? Colors.primary : Colors.border }]}>
                  <View style={styles.serviceCopy}><Text style={[styles.serviceName, { color: selected ? Colors.primary : Colors.text }]}>{item.name}</Text><Text style={[styles.serviceMeta, { color: Colors.muted }]}>{item.duration} min · {Number(price).toFixed(2)} EUR</Text></View>
                  {selected && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
                </Pressable>;
              })}
              {!filteredServices.length && <Text style={[styles.noResults, { color: Colors.muted }]}>Nuk u gjet asnjë shërbim.</Text>}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

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
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 50,
  },

  page: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 22,
  },

  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.18)',
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 15,
    fontWeight: '600',
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

  selectField: { minHeight: 56, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectCopy: { flex: 1, paddingVertical: 8 },
  selectValue: { fontSize: 15, fontWeight: '800' },
  selectMeta: { fontSize: 12, marginTop: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  serviceModal: { width: '100%', maxWidth: 520, maxHeight: '78%', alignSelf: 'center', borderWidth: 1, borderRadius: 24, padding: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  modalTitle: { fontSize: 23, fontWeight: '900', marginTop: 3 },
  modalClose: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  searchBox: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 9 },
  serviceOption: { minHeight: 58, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  serviceCopy: { flex: 1 }, serviceName: { fontSize: 14, fontWeight: '900' }, serviceMeta: { fontSize: 12, marginTop: 4 },
  noResults: { textAlign: 'center', paddingVertical: 25, fontSize: 14, fontWeight: '700' },

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
