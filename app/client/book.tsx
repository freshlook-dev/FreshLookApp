import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRef } from 'react';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { PremiumCard, ScreenHeader, useClientColors } from '../../components/ClientUI';
import { notifyStaffAppointmentChange } from '../../utils/appointmentStaffNotifications';
import { syncClientAppointmentReminders } from '../../utils/appointmentReminders';
import { getOrderedCatalogIds } from '../../utils/catalog';
import {
  formatKosovoDateOnly,
  formatLocalDateOnly,
  isKosovoSlotAtLeastMinutesAway,
  kosovoDateForPicker,
} from '../../utils/dateTime';

type Service = {
  id: string;
  name: string;
  price: number;
  duration: number;
  is_on_sale?: boolean | null;
  sale_price?: number | null;
};

const getEffectiveServicePrice = (service: Service) =>
  service.is_on_sale && service.sale_price != null ? service.sale_price : service.price;

const LOCATIONS = ['Prishtinë', 'Fushë Kosovë'];
const TIME_SLOTS = [
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00',
];
const BOOKING_URL = 'https://www.freshlook-ks.com/api/appointments';

function orderByIdList<T extends { id: string }>(items: T[], orderedIds: string[]) {
  if (!orderedIds.length) return items;
  const positionMap = new Map(orderedIds.map((id, index) => [id, index]));

  return [...items].sort((a, b) => {
    const aPosition = positionMap.get(a.id);
    const bPosition = positionMap.get(b.id);

    if (aPosition == null && bPosition == null) return 0;
    if (aPosition == null) return 1;
    if (bPosition == null) return -1;
    return aPosition - bPosition;
  });
}

function capitalizedMonthAndYear(value: Date) {
  const formatted = new Intl.DateTimeFormat('sq-AL', { month: 'long', year: 'numeric' }).format(value);
  return formatted.charAt(0).toLocaleUpperCase('sq-AL') + formatted.slice(1);
}

function isTooSoonToBook(selectedDate: string, slot: string, now: Date) {
  return !isKosovoSlotAtLeastMinutesAway(selectedDate, slot, 30, now);
}

export default function BookAppointmentScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const Colors = useClientColors();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [location, setLocation] = useState(LOCATIONS[0]);
  const [date, setDate] = useState(() => kosovoDateForPicker());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [time, setTime] = useState('');
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [openSelect, setOpenSelect] = useState<'services' | 'location' | null>(null);
  const [selectSearch, setSelectSearch] = useState('');
  const successOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.86)).current;
  const redirectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile?.full_name, profile?.phone]);

  useEffect(() => {
    return () => {
      if (redirectTimeout.current) clearTimeout(redirectTimeout.current);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadServices = async () => {
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
      setServices(orderByIdList((data as Service[] | null) ?? [], orderedIds));
      setLoadingServices(false);
    };

    void loadServices();
  }, []);

  const selectedDate = useMemo(() => formatLocalDateOnly(date), [date]);
  const minimumDate = useMemo(
    () => kosovoDateForPicker(currentTime),
    [currentTime]
  );

  const loadBookedTimes = useCallback(async () => {
    if (!location) {
      setBookedTimes([]);
      return;
    }

    setLoadingTimes(true);
    const { data, error } = await supabase.rpc('get_booked_appointment_times', {
      p_date: selectedDate,
      p_location: location,
    });

    if (error) {
      console.warn('Booked appointment times could not be loaded', error);
    }

    setBookedTimes(
      ((data ?? []) as { booked_time: string }[]).map((item) =>
        String(item.booked_time).substring(0, 5)
      )
    );
    setLoadingTimes(false);
  }, [location, selectedDate]);

  useEffect(() => {
    setTime('');
    void loadBookedTimes();
  }, [loadBookedTimes]);

  useEffect(() => {
    if (time && isTooSoonToBook(selectedDate, time, currentTime)) {
      setTime('');
    }
  }, [currentTime, selectedDate, time]);

  useEffect(() => {
    if (!location) return;
    const channel = supabase
      .channel(`client-booking-${location}-${selectedDate}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        void loadBookedTimes();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadBookedTimes, location, selectedDate]);

  const toggleService = (item: Service) => {
    setSelectedServices((current) => {
      const exists = current.some((service) => service.id === item.id);
      if (exists) return current.filter((service) => service.id !== item.id);
      return [...current, item];
    });
  };

  const selectedServiceName = selectedServices.map((item) => item.name).join(', ');
  const selectedTreatmentPayload = selectedServices.map((item) => {
    const price = getEffectiveServicePrice(item);
    return {
      id: item.id,
      name: item.name,
      price,
      qty: 1,
      total: price,
    };
  });
  const selectedTotal = selectedTreatmentPayload.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const selectedDuration = selectedServices.reduce((sum, item) => sum + Number(item.duration || 0), 0);
  const normalizedSearch = selectSearch.trim().toLocaleLowerCase('sq-AL');
  const filteredServices = services.filter((item) => item.name.toLocaleLowerCase('sq-AL').includes(normalizedSearch));
  const filteredLocations = LOCATIONS.filter((item) => item.toLocaleLowerCase('sq-AL').includes(normalizedSearch));
  const showSelect = (type: 'services' | 'location') => {
    setSelectSearch('');
    setOpenSelect(type);
  };

  const applySelectedDate = (value?: Date) => {
    if (!value) return;
    setDate(value < minimumDate ? minimumDate : value);
    setTime('');
  };

  const openDatePicker = () => {
    Keyboard.dismiss();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'date',
        minimumDate,
        onChange: (_, value) => applySelectedDate(value),
      });
      return;
    }
    setShowDatePicker(true);
  };

  const revealContactFields = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  };

  const submit = async () => {
    if (!selectedServices.length || !location || !time || !name.trim() || !phone.trim()) {
      Alert.alert('Mungojnë të dhëna', 'Zgjidhni shërbimin, lokacionin, datën dhe orën, pastaj kontrolloni të dhënat e kontaktit.');
      return;
    }

    if (date.getDay() === 0) {
      Alert.alert('Mbyllur të dielën', 'Ju lutemi zgjidhni një datë tjetër.');
      return;
    }

    if (selectedDate < formatKosovoDateOnly(currentTime)) {
      Alert.alert('Datë e pavlefshme', 'Ju lutemi zgjidhni një datë nga sot e tutje.');
      return;
    }

    if (isTooSoonToBook(selectedDate, time, currentTime)) {
      Alert.alert('Ora nuk është e disponueshme', 'Zgjidhni një orë të paktën 30 minuta pas kohës aktuale.');
      setTime('');
      return;
    }

    setSubmitting(true);
    try {
      await loadBookedTimes();
      const { data: occupiedRows, error: availabilityError } = await supabase.rpc(
        'get_booked_appointment_times',
        { p_date: selectedDate, p_location: location }
      );
      if (availabilityError) throw new Error(availabilityError.message);

      const occupied = ((occupiedRows ?? []) as { booked_time: string }[]).some(
        (item) => String(item.booked_time).substring(0, 5) === time.substring(0, 5)
      );
      if (occupied) {
        setTime('');
        throw new Error('Kjo orë sapo u rezervua nga dikush tjetër. Ju lutemi zgjidhni një orë tjetër.');
      }

      const selectedServiceIds = selectedServices.map((service) => service.id);
      const { data: liveServiceRows, error: liveServicesError } = await supabase
        .from('services')
        .select('id, name, price, duration, is_on_sale, sale_price')
        .in('id', selectedServiceIds)
        .eq('is_active', true);

      if (liveServicesError) throw new Error(liveServicesError.message);

      const liveServicesById = new Map(
        ((liveServiceRows as Service[] | null) ?? []).map((service) => [service.id, service])
      );
      const unavailableService = selectedServiceIds.some((id) => !liveServicesById.has(id));
      if (unavailableService) {
        throw new Error('Një nga shërbimet e zgjedhura nuk është më aktiv.');
      }

      const liveSelectedServices = selectedServiceIds.map((id) => liveServicesById.get(id)!);
      const liveSelectedServiceName = liveSelectedServices.map((service) => service.name).join(', ');
      const liveSelectedTreatmentPayload = liveSelectedServices.map((service) => {
        const price = getEffectiveServicePrice(service);
        return {
          id: service.id,
          name: service.name,
          price,
          qty: 1,
          duration: service.duration,
          total: price,
        };
      });

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Seanca juaj ka skaduar. Ju lutemi hyni përsëri.');

      const response = await fetch(BOOKING_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          service: liveSelectedServiceName,
          location,
          appointment_date: selectedDate,
          appointment_time: time,
          client_name: name.trim(),
          phone: phone.trim(),
          confirmation_email: user?.email ?? null,
          source: 'app',
        }),
      });

      const result = (await response.json()) as { appointmentId?: string | null; error?: string };
      if (!response.ok) throw new Error(result.error || 'Termini nuk mund të krijohej.');

      if (result.appointmentId) {
        const { error: treatmentSnapshotError } = await supabase
          .from('appointments')
          .update({ selected_treatments: liveSelectedTreatmentPayload })
          .eq('id', result.appointmentId)
          .eq('user_id', user?.id ?? '');

        if (treatmentSnapshotError) {
          // The appointment itself already exists. Keep the successful booking flow;
          // register-visit can reconstruct all selections from the service names.
          console.warn('Appointment treatment snapshot update failed', treatmentSnapshotError);
        }
      }

      void notifyStaffAppointmentChange('created', {
        id: result.appointmentId,
        service: liveSelectedServiceName,
        client_name: name.trim(),
        appointment_date: selectedDate,
        appointment_time: time,
        location,
        status: 'upcoming',
      });
      if (user?.id) void syncClientAppointmentReminders(user.id);

      setBookingComplete(true);
      Animated.parallel([
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(successScale, {
          toValue: 1,
          damping: 12,
          stiffness: 170,
          mass: 0.7,
          useNativeDriver: true,
        }),
      ]).start();

      redirectTimeout.current = setTimeout(() => {
        router.replace('/client' as any);
      }, 1150);
    } catch (error) {
      Alert.alert('Rezervimi dështoi', error instanceof Error ? error.message : 'Ju lutemi provoni përsëri.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={{ backgroundColor: Colors.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onTouchStart={Keyboard.dismiss}
      >
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={19} color={Colors.primary} />
          <Text style={[styles.backText, { color: Colors.primary }]}>Kthehu</Text>
        </Pressable>

        <ScreenHeader
          eyebrow="Terminet"
          title="Rezervo vizitën"
          subtitle="Zgjidhni shërbimin, lokacionin dhe orën e lirë për vizitën tuaj në Fresh Look."
        />

      <SectionTitle title="1. Zgjidhni shërbimet" />
      {loadingServices ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : (
        <Pressable
          onPress={() => showSelect('services')}
          style={[styles.selectField, { backgroundColor: Colors.card, borderColor: Colors.border }]}
        >
          <Text numberOfLines={1} style={[styles.selectText, { color: selectedServices.length ? Colors.text : Colors.muted }]}>
            {selectedServices.length ? `${selectedServices.length} shërbime të zgjedhura` : 'Zgjidhni shërbimet'}
          </Text>
          <Ionicons name="chevron-down" size={20} color={Colors.primary} />
        </Pressable>
      )}
      {!!selectedServices.length && (
        <PremiumCard style={styles.summaryCard}>
          <Text style={[styles.summaryLabel, { color: Colors.primary }]}>Të zgjedhura</Text>
          <Text style={[styles.summaryText, { color: Colors.text }]}>{selectedServiceName}</Text>
          <Text style={[styles.summaryMeta, { color: Colors.muted }]}>
            {selectedDuration} min gjithsej · {selectedTotal.toFixed(2)} EUR
          </Text>
        </PremiumCard>
      )}

      <SectionTitle title="2. Zgjidhni lokacionin" />
      <Pressable
        onPress={() => showSelect('location')}
        style={[styles.selectField, { backgroundColor: Colors.card, borderColor: Colors.border }]}
      >
        <Text style={[styles.selectText, { color: location ? Colors.text : Colors.muted }]}>
          {location || 'Zgjidhni lokacionin'}
        </Text>
        <Ionicons name="chevron-down" size={20} color={Colors.primary} />
      </Pressable>

      <SectionTitle title="3. Zgjidhni datën dhe orën" />
      <PremiumCard style={styles.cardGap}>
        <Pressable
          style={[styles.dateButton, { borderColor: Colors.border }]}
          onPress={openDatePicker}
        >
          <Ionicons name="calendar-outline" size={19} color={Colors.primary} />
          <Text style={[styles.dateText, { color: Colors.text }]}>{selectedDate}</Text>
        </Pressable>
        <View style={styles.timeGrid}>
          {loadingTimes && <ActivityIndicator color={Colors.primary} style={styles.timeLoader} />}
          {TIME_SLOTS.map((slot) => {
            const booked = bookedTimes.includes(slot);
            const tooSoon = isTooSoonToBook(selectedDate, slot, currentTime);
            const disabled = booked || tooSoon || !location;
            return (
              <Pressable
                key={slot}
                disabled={disabled}
                onPress={() => setTime(slot)}
                style={[
                  styles.time,
                  {
                    backgroundColor: time === slot ? Colors.primary : Colors.surface,
                    borderColor: time === slot ? Colors.primary : Colors.border,
                    opacity: disabled ? 0.4 : 1,
                  },
                ]}
              >
                <Text style={{ color: time === slot ? Colors.onPrimary : Colors.text, fontWeight: '700' }}>{slot}</Text>
                {booked && <Text style={[styles.takenText, { color: Colors.muted }]}>E zënë</Text>}
                {!booked && tooSoon && <Text style={[styles.takenText, { color: Colors.muted }]}>E kaluar</Text>}
              </Pressable>
            );
          })}
        </View>
      </PremiumCard>

      <SectionTitle title="4. Të dhënat tuaja" />
      <PremiumCard style={styles.cardGap}>
        <TextInput
          value={name}
          onChangeText={setName}
          onFocus={revealContactFields}
          placeholder="Emri dhe mbiemri"
          placeholderTextColor={Colors.muted}
          style={[styles.input, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        />
        <TextInput
          value={phone}
          onChangeText={setPhone}
          onFocus={revealContactFields}
          keyboardType="phone-pad"
          placeholder="Numri i telefonit"
          placeholderTextColor={Colors.muted}
          style={[styles.input, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        />
      </PremiumCard>

      <Pressable
        disabled={submitting || bookingComplete}
        onPress={submit}
        style={[styles.submit, { backgroundColor: Colors.primary, opacity: submitting || bookingComplete ? 0.65 : 1 }]}
      >
        {submitting ? <ActivityIndicator color={Colors.onPrimary} /> : <Text style={[styles.submitText, { color: Colors.onPrimary }]}>Konfirmo rezervimin</Text>}
      </Pressable>

      </ScrollView>

      <Modal
        visible={Platform.OS === 'ios' && showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDatePicker(false)}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.dateModal, { backgroundColor: Colors.card, borderColor: Colors.border }]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalEyebrow, { color: Colors.primary }]}>ZGJIDHNI</Text>
                <Text style={[styles.modalTitle, { color: Colors.text }]}>{capitalizedMonthAndYear(date)}</Text>
              </View>
              <Pressable onPress={() => setShowDatePicker(false)} style={[styles.modalClose, { backgroundColor: Colors.surface }]}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </Pressable>
            </View>
            <DateTimePicker
              locale="sq-AL"
              value={date}
              mode="date"
              display="inline"
              themeVariant={theme}
              accentColor={Colors.primary}
              minimumDate={minimumDate}
              onChange={(_, value) => applySelectedDate(value)}
              style={styles.iosDatePicker}
            />
            <Pressable onPress={() => setShowDatePicker(false)} style={[styles.modalDone, { backgroundColor: Colors.primary }]}>
              <Text style={[styles.modalDoneText, { color: Colors.onPrimary }]}>Mbyll</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={openSelect !== null} transparent animationType="fade" onRequestClose={() => setOpenSelect(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpenSelect(null)}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.selectModal, { backgroundColor: Colors.card, borderColor: Colors.border }]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalEyebrow, { color: Colors.primary }]}>ZGJIDHNI</Text>
                <Text style={[styles.modalTitle, { color: Colors.text }]}>
                  {openSelect === 'services' ? 'Shërbimet' : 'Lokacionin'}
                </Text>
              </View>
              <Pressable onPress={() => setOpenSelect(null)} style={[styles.modalClose, { backgroundColor: Colors.surface }]}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </Pressable>
            </View>
            <View style={[styles.searchWrap, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <Ionicons name="search-outline" size={19} color={Colors.muted} />
              <TextInput
                value={selectSearch}
                onChangeText={setSelectSearch}
                placeholder={openSelect === 'services' ? 'Kërko shërbimin' : 'Kërko lokacionin'}
                placeholderTextColor={Colors.muted}
                autoCorrect={false}
                style={[styles.searchInput, { color: Colors.text }]}
              />
            </View>
            <ScrollView style={styles.optionsScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {openSelect === 'services' && filteredServices.map((item) => {
                const selected = selectedServices.some((service) => service.id === item.id);
                const price = getEffectiveServicePrice(item);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleService(item)}
                    style={[styles.optionRow, { backgroundColor: selected ? Colors.primarySoft : Colors.surface, borderColor: selected ? Colors.primary : Colors.border }]}
                  >
                    <View style={styles.optionCopy}>
                      <Text style={[styles.optionText, { color: selected ? Colors.primary : Colors.text }]}>{item.name}</Text>
                      <Text style={[styles.optionMeta, { color: Colors.muted }]}>{item.duration} min · {price} EUR</Text>
                    </View>
                    <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? Colors.primary : Colors.muted} />
                  </Pressable>
                );
              })}
              {openSelect === 'location' && filteredLocations.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => { setLocation(item); setTime(''); setOpenSelect(null); }}
                  style={[styles.optionRow, { backgroundColor: location === item ? Colors.primarySoft : Colors.surface, borderColor: location === item ? Colors.primary : Colors.border }]}
                >
                  <Text style={[styles.optionText, { color: location === item ? Colors.primary : Colors.text }]}>{item}</Text>
                  {location === item && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
                </Pressable>
              ))}
              {((openSelect === 'services' && filteredServices.length === 0) || (openSelect === 'location' && filteredLocations.length === 0)) && (
                <Text style={[styles.noResults, { color: Colors.muted }]}>Nuk u gjet asnjë rezultat.</Text>
              )}
            </ScrollView>
            {openSelect === 'services' && (
              <Pressable onPress={() => setOpenSelect(null)} style={[styles.modalDone, { backgroundColor: Colors.primary }]}>
                <Text style={[styles.modalDoneText, { color: Colors.onPrimary }]}>Mbyll ({selectedServices.length})</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={bookingComplete} transparent animationType="none">
        <Animated.View
          style={[
            styles.successOverlay,
            { backgroundColor: Colors.background, opacity: successOpacity },
          ]}
        >
          <Animated.View
            style={[
              styles.successCard,
              {
                backgroundColor: Colors.elevated,
                borderColor: Colors.border,
                transform: [{ scale: successScale }],
              },
            ]}
          >
            <View style={[styles.successIcon, { backgroundColor: Colors.primary }]}>
              <Ionicons name="checkmark" size={38} color={Colors.onPrimary} />
            </View>
            <Text style={[styles.successTitle, { color: Colors.text }]}>Termini u rezervua</Text>
            <Text style={[styles.successText, { color: Colors.muted }]}>Po ju kthejmë në kryefaqe.</Text>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

function SectionTitle({ title }: { title: string }) {
  const Colors = useClientColors();
  return <Text style={[styles.sectionTitle, { color: Colors.text }]}>{title}</Text>;
}

function ChoicePill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const Colors = useClientColors();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, { backgroundColor: selected ? Colors.primary : Colors.card, borderColor: selected ? Colors.primary : Colors.border }]}
    >
      <Text style={{ color: selected ? Colors.onPrimary : Colors.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 130 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 },
  backText: { fontSize: 14, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginTop: 12, marginBottom: 12 },
  selectField: { minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectText: { flex: 1, fontSize: 15, fontWeight: '700' },
  loader: { marginVertical: 24 },
  grid: { gap: 10 },
  choice: { borderWidth: 1, borderRadius: 16, padding: 16 },
  choiceTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  choiceTitle: { fontSize: 15, fontWeight: '800' },
  choiceMeta: { fontSize: 12, marginTop: 5 },
  checkCircle: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { marginTop: 12, gap: 6 },
  summaryLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  summaryText: { fontSize: 15, lineHeight: 21, fontWeight: '800' },
  summaryMeta: { fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 10 },
  pill: { flex: 1, borderWidth: 1, minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  cardGap: { gap: 12 },
  dateButton: { minHeight: 50, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  dateText: { fontSize: 15, fontWeight: '700' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeLoader: { width: '100%', marginVertical: 5 },
  time: { width: '30%', minHeight: 52, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  takenText: { fontSize: 9, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  input: { minHeight: 51, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, fontSize: 15 },
  submit: { minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  submitText: { fontSize: 15, fontWeight: '800' },
  successOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  successCard: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 6,
  },
  successIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,10,0.6)', justifyContent: 'center', padding: 20 },
  selectModal: { width: '100%', maxWidth: 480, maxHeight: '76%', alignSelf: 'center', borderWidth: 1, borderRadius: 24, padding: 18 },
  dateModal: { width: '100%', maxWidth: 420, alignSelf: 'center', borderWidth: 1, borderRadius: 24, padding: 18 },
  iosDatePicker: { alignSelf: 'center', width: '100%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  modalEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  modalTitle: { marginTop: 3, fontSize: 23, fontWeight: '900' },
  modalClose: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 10 },
  optionsScroll: { flexGrow: 0 },
  optionRow: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  optionCopy: { flex: 1 },
  optionText: { fontSize: 14, fontWeight: '800' },
  optionMeta: { fontSize: 12, marginTop: 4 },
  noResults: { paddingVertical: 24, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  modalDone: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  modalDoneText: { fontSize: 15, fontWeight: '900' },
});
