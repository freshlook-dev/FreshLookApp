import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatTime } from '../../utils/format';
import { notifyStaffAppointmentChange } from '../../utils/appointmentStaffNotifications';
import { syncClientAppointmentReminders } from '../../utils/appointmentReminders';
import {
  EmptyState,
  PremiumCard,
  ScreenHeader,
  StatusBadge,
  useClientColors,
} from '../../components/ClientUI';

type Appointment = {
  id: string;
  service: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  location: string | null;
  status: string | null;
  comment: string | null;
  visit_notes: string | null;
  total_amount: number | null;
};

type VisitTab = 'upcoming' | 'history';

const ACTIVE_VISIT_STATUSES = new Set(['upcoming', 'scheduled', 'pending']);
const LOCATIONS = ['Prishtinë', 'Fushë Kosovë'];
const TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const DANGER = '#DC2626';

function localDateValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromValue(value: string | null) {
  if (!value) return new Date();
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function isUpcomingVisit(item: Appointment, today: string) {
  const status = (item.status ?? '').toLowerCase();
  const isActive = !status || ACTIVE_VISIT_STATUSES.has(status);
  return isActive && (item.appointment_date ?? '') >= today;
}

export default function AppointmentsScreen() {
  const { user } = useAuth();
  const Colors = useClientColors();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<VisitTab>('upcoming');
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editDate, setEditDate] = useState(new Date());
  const [editLocation, setEditLocation] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editComment, setEditComment] = useState('');
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [cancelingAppointment, setCancelingAppointment] = useState(false);

  const loadAppointments = useCallback(async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('appointments')
      .select('id, service, appointment_date, appointment_time, location, status, comment, visit_notes, total_amount')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false });

    setAppointments(data ?? []);
    setLoading(false);
  }, [user?.id]);

  const editDateValue = useMemo(() => localDateValue(editDate), [editDate]);

  const loadBookedTimes = useCallback(async () => {
    if (!editLocation || !editingAppointment) {
      setBookedTimes([]);
      return;
    }

    setLoadingTimes(true);
    const { data } = await supabase
      .from('appointments')
      .select('appointment_time')
      .eq('appointment_date', editDateValue)
      .eq('location', editLocation)
      .eq('status', 'upcoming')
      .eq('archived', false)
      .neq('id', editingAppointment.id);

    setBookedTimes(
      ((data ?? []) as { appointment_time: string }[]).map((item) =>
        String(item.appointment_time).substring(0, 5)
      )
    );
    setLoadingTimes(false);
  }, [editDateValue, editLocation, editingAppointment]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    void loadBookedTimes();
  }, [loadBookedTimes]);

  const grouped = useMemo(() => {
    const today = localDateValue(new Date());
    const upcoming = appointments
      .filter((item) => isUpcomingVisit(item, today))
      .sort((a, b) =>
        `${a.appointment_date ?? ''} ${a.appointment_time ?? ''}`.localeCompare(
          `${b.appointment_date ?? ''} ${b.appointment_time ?? ''}`
        )
      );
    const history = appointments
      .filter((item) => !isUpcomingVisit(item, today))
      .sort((a, b) =>
        `${b.appointment_date ?? ''} ${b.appointment_time ?? ''}`.localeCompare(
          `${a.appointment_date ?? ''} ${a.appointment_time ?? ''}`
        )
      );

    return { upcoming, history };
  }, [appointments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  };

  const openEditModal = (item: Appointment) => {
    setEditingAppointment(item);
    setEditDate(dateFromValue(item.appointment_date));
    setEditLocation(item.location ?? LOCATIONS[0]);
    setEditTime(item.appointment_time ? String(item.appointment_time).substring(0, 5) : '');
    setEditComment(item.comment ?? '');
    setShowEditDatePicker(false);
  };

  const closeEditModal = () => {
    if (savingEdit || cancelingAppointment) return;
    setEditingAppointment(null);
    setBookedTimes([]);
    setShowEditDatePicker(false);
  };

  const saveAppointmentChanges = async () => {
    if (!editingAppointment || !user?.id) return;
    if (!editLocation || !editTime) {
      Alert.alert('Mungojnë të dhëna', 'Zgjidhni lokacionin dhe orën e terminit.');
      return;
    }

    const today = localDateValue(new Date());
    if (editDateValue < today) {
      Alert.alert('Datë e pavlefshme', 'Zgjidhni një datë nga sot e tutje.');
      return;
    }

    if (editDate.getDay() === 0) {
      Alert.alert('Mbyllur të dielën', 'Ju lutemi zgjidhni një datë tjetër.');
      return;
    }

    setSavingEdit(true);
    try {
      const { data: occupiedRows } = await supabase
        .from('appointments')
        .select('id')
        .eq('appointment_date', editDateValue)
        .eq('appointment_time', editTime)
        .eq('location', editLocation)
        .eq('status', 'upcoming')
        .eq('archived', false)
        .neq('id', editingAppointment.id)
        .limit(1);

      if (occupiedRows?.length) {
        setEditTime('');
        throw new Error('Kjo orë është e rezervuar. Ju lutemi zgjidhni një orë tjetër.');
      }

      const { error } = await supabase
        .from('appointments')
        .update({
          appointment_date: editDateValue,
          appointment_time: editTime,
          location: editLocation,
          comment: editComment.trim() || null,
        })
        .eq('id', editingAppointment.id)
        .eq('user_id', user.id);

      if (error) throw error;

      await loadAppointments();
      void notifyStaffAppointmentChange('updated', {
        id: editingAppointment.id,
        client_name: user.email ?? 'Klient',
        service: editingAppointment.service,
        appointment_date: editDateValue,
        appointment_time: editTime,
        location: editLocation,
        status: editingAppointment.status ?? 'upcoming',
      });
      void syncClientAppointmentReminders(user.id);
      setEditingAppointment(null);
      Alert.alert('Termini u përditësua', 'Ndryshimet u ruajtën me sukses.');
    } catch (error) {
      Alert.alert('Ndryshimi dështoi', error instanceof Error ? error.message : 'Ju lutemi provoni përsëri.');
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmCancelAppointment = () => {
    if (!editingAppointment) return;

    const cancel = async () => {
      if (!editingAppointment || !user?.id) return;
      setCancelingAppointment(true);
      try {
        const { error } = await supabase
          .from('appointments')
          .update({ status: 'canceled' })
          .eq('id', editingAppointment.id)
          .eq('user_id', user.id);

        if (error) throw error;

        await loadAppointments();
        void notifyStaffAppointmentChange('canceled', {
          id: editingAppointment.id,
          client_name: user.email ?? 'Klient',
          service: editingAppointment.service,
          appointment_date: editingAppointment.appointment_date,
          appointment_time: editingAppointment.appointment_time,
          location: editingAppointment.location,
          status: 'canceled',
        });
        void syncClientAppointmentReminders(user.id);
        setEditingAppointment(null);
        Alert.alert('Termini u anulua', 'Termini u anulua me sukses.');
      } catch (error) {
        Alert.alert('Anulimi dështoi', error instanceof Error ? error.message : 'Ju lutemi provoni përsëri.');
      } finally {
        setCancelingAppointment(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Jeni i sigurt që dëshironi ta anuloni këtë termin?')) void cancel();
      return;
    }

    Alert.alert(
      'Anulo terminin?',
      'Ky veprim do ta kalojë terminin në historik si të anuluar.',
      [
        { text: 'Jo', style: 'cancel' },
        { text: 'Po, anuloje', style: 'destructive', onPress: () => void cancel() },
      ]
    );
  };

  const visibleAppointments = grouped[activeTab];

  return (
    <>
      <ScrollView
        style={{ backgroundColor: Colors.background }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        <ScreenHeader
          eyebrow="Terminet"
          title="Vizitat tuaja"
          subtitle="Terminet e ardhshme dhe historiku juaj te Fresh Look."
        />

        <Pressable
          style={[styles.bookButton, { backgroundColor: Colors.primary }]}
          onPress={() => router.push('/client/book' as any)}
        >
          <Ionicons name="add-circle-outline" size={20} color={Colors.onPrimary} />
          <Text style={[styles.bookButtonText, { color: Colors.onPrimary }]}>Rezervo termin të ri</Text>
        </Pressable>

        <View style={[styles.segment, { backgroundColor: Colors.surface }]}>
          {(['upcoming', 'history'] as VisitTab[]).map((tab) => {
            const active = activeTab === tab;
            const count = grouped[tab].length;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.segmentButton,
                  active && {
                    backgroundColor: Colors.elevated,
                    borderColor: Colors.border,
                  },
                ]}
              >
                <Text style={[styles.segmentText, { color: active ? Colors.text : Colors.muted }]}>
                  {tab === 'upcoming' ? 'Në ardhje' : 'Historiku'}
                </Text>
                <View
                  style={[
                    styles.countBadge,
                    { backgroundColor: active ? Colors.primarySoft : Colors.background },
                  ]}
                >
                  <Text style={[styles.countText, { color: active ? Colors.primary : Colors.muted }]}>
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={styles.loader} />
        ) : visibleAppointments.length ? (
          <View style={styles.list}>
            {visibleAppointments.map((item) => (
              <AppointmentCard
                key={item.id}
                item={item}
                canEdit={activeTab === 'upcoming'}
                onEdit={() => openEditModal(item)}
              />
            ))}
          </View>
        ) : (
          <PremiumCard>
            <EmptyState
              icon={activeTab === 'upcoming' ? 'calendar-outline' : 'time-outline'}
              title={activeTab === 'upcoming' ? 'Nuk keni vizita të ardhshme' : 'Ende nuk keni historik vizitash'}
              message={
                activeTab === 'upcoming'
                  ? 'Termini juaj i ardhshëm do të shfaqet këtu sapo të rezervohet.'
                  : 'Vizitat e përfunduara do të ruhen këtu që t’i gjeni lehtë.'
              }
            />
          </PremiumCard>
        )}
      </ScrollView>

      <Modal visible={!!editingAppointment} transparent animationType="fade" onRequestClose={closeEditModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: Colors.elevated, borderColor: Colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Text style={[styles.modalEyebrow, { color: Colors.primary }]}>Ndrysho terminin</Text>
                <Text style={[styles.modalTitle, { color: Colors.text }]} numberOfLines={2}>
                  {editingAppointment?.service || 'Termin'}
                </Text>
              </View>
              <Pressable
                style={[styles.closeButton, { backgroundColor: Colors.surface }]}
                onPress={closeEditModal}
              >
                <Ionicons name="close" size={20} color={Colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Pressable
                style={[styles.dateButton, { borderColor: Colors.border, backgroundColor: Colors.surface }]}
                onPress={() => setShowEditDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                <Text style={[styles.dateButtonText, { color: Colors.text }]}>{editDateValue}</Text>
              </Pressable>
              {showEditDatePicker && (
                <DateTimePicker
                  value={editDate}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={(_, value) => {
                    if (Platform.OS !== 'ios') setShowEditDatePicker(false);
                    if (value) {
                      setEditDate(value);
                      setEditTime('');
                    }
                  }}
                />
              )}

              <Text style={[styles.fieldLabel, { color: Colors.text }]}>Lokacioni</Text>
              <View style={styles.locationRow}>
                {LOCATIONS.map((item) => {
                  const selected = editLocation === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => {
                        setEditLocation(item);
                        setEditTime('');
                      }}
                      style={[
                        styles.locationPill,
                        {
                          backgroundColor: selected ? Colors.primary : Colors.surface,
                          borderColor: selected ? Colors.primary : Colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.locationText, { color: selected ? Colors.onPrimary : Colors.text }]}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { color: Colors.text }]}>Ora</Text>
              <View style={styles.timeGrid}>
                {loadingTimes && <ActivityIndicator color={Colors.primary} style={styles.timeLoader} />}
                {TIME_SLOTS.map((slot) => {
                  const booked = bookedTimes.includes(slot);
                  const selected = editTime === slot;
                  return (
                    <Pressable
                      key={slot}
                      disabled={booked || !editLocation}
                      onPress={() => setEditTime(slot)}
                      style={[
                        styles.timeButton,
                        {
                          backgroundColor: selected ? Colors.primary : Colors.surface,
                          borderColor: selected ? Colors.primary : Colors.border,
                          opacity: booked || !editLocation ? 0.42 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.timeText, { color: selected ? Colors.onPrimary : Colors.text }]}>
                        {slot}
                      </Text>
                      {booked && <Text style={[styles.bookedText, { color: Colors.muted }]}>E zënë</Text>}
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { color: Colors.text }]}>Shënim për stafin</Text>
              <TextInput
                value={editComment}
                onChangeText={setEditComment}
                placeholder="Shtoni ose ndryshoni shënimin..."
                placeholderTextColor={Colors.muted}
                multiline
                style={[
                  styles.commentInput,
                  { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface },
                ]}
              />

              <View style={styles.modalActions}>
                <Pressable
                  disabled={savingEdit || cancelingAppointment}
                  onPress={confirmCancelAppointment}
                  style={[styles.cancelAppointmentButton, { borderColor: DANGER }]}
                >
                  <Text style={[styles.cancelAppointmentText, { color: DANGER }]}>
                    {cancelingAppointment ? 'Duke anuluar...' : 'Anulo terminin'}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={savingEdit || cancelingAppointment}
                  onPress={saveAppointmentChanges}
                  style={[styles.saveButton, { backgroundColor: Colors.primary, opacity: savingEdit ? 0.65 : 1 }]}
                >
                  {savingEdit ? (
                    <ActivityIndicator color={Colors.onPrimary} />
                  ) : (
                    <Text style={[styles.saveButtonText, { color: Colors.onPrimary }]}>Ruaj ndryshimet</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function AppointmentCard({ item, canEdit, onEdit }: { item: Appointment; canEdit: boolean; onEdit: () => void }) {
  const Colors = useClientColors();
  const dateParts = formatDate(item.appointment_date).split(' ');

  return (
    <PremiumCard elevated>
      <View style={styles.cardTop}>
        <View style={[styles.dateTile, { backgroundColor: Colors.primarySoft }]}>
          <Text style={[styles.dateDay, { color: Colors.primary }]}>{dateParts[0] || '--'}</Text>
          <Text style={[styles.dateMonth, { color: Colors.primary }]}>
            {dateParts.slice(1).join(' ') || 'Vizitë'}
          </Text>
        </View>
        <View style={styles.cardHeading}>
          <Text style={[styles.cardTitle, { color: Colors.text }]}>
            {item.service || 'Termin'}
          </Text>
          <StatusBadge label={item.status || 'scheduled'} />
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: Colors.border }]} />
      <MetaRow icon="time-outline" text={formatTime(item.appointment_time)} />
      {!!item.location && <MetaRow icon="location-outline" text={item.location} />}
      {!!item.visit_notes && (
        <View style={[styles.notes, { backgroundColor: Colors.surface }]}>
          <Ionicons name="document-text-outline" size={17} color={Colors.primary} />
          <Text style={[styles.notesText, { color: Colors.text }]}>{item.visit_notes}</Text>
        </View>
      )}
      {!!item.comment && (
        <View style={[styles.notes, { backgroundColor: Colors.surface }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={17} color={Colors.primary} />
          <Text style={[styles.notesText, { color: Colors.text }]}>{item.comment}</Text>
        </View>
      )}
      {canEdit && (
        <Pressable style={[styles.editButton, { borderColor: Colors.primary }]} onPress={onEdit}>
          <Ionicons name="create-outline" size={17} color={Colors.primary} />
          <Text style={[styles.editButtonText, { color: Colors.primary }]}>Ndrysho</Text>
        </Pressable>
      )}
    </PremiumCard>
  );
}

function MetaRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const Colors = useClientColors();
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={17} color={Colors.primary} />
      <Text style={[styles.metaText, { color: Colors.muted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 118,
  },
  bookButton: {
    minHeight: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
  },
  bookButtonText: { fontSize: 14, fontWeight: '800' },
  segment: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    marginBottom: 22,
  },
  segmentButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
  },
  loader: {
    marginTop: 55,
  },
  list: {
    gap: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  dateTile: {
    width: 62,
    minHeight: 64,
    borderRadius: 16,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 18,
    fontWeight: '800',
  },
  dateMonth: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 2,
  },
  cardHeading: {
    flex: 1,
    gap: 9,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 17,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 9,
  },
  metaText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  notes: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 14,
    padding: 13,
    marginTop: 7,
  },
  notesText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  editButton: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  modalTitleWrap: {
    flex: 1,
  },
  modalEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 5,
  },
  modalTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    paddingBottom: 4,
  },
  dateButton: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 18,
    marginBottom: 10,
  },
  locationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  locationPill: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeLoader: {
    width: '100%',
    marginVertical: 4,
  },
  timeButton: {
    width: '30%',
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  bookedText: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  commentInput: {
    minHeight: 86,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelAppointmentButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  cancelAppointmentText: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  saveButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
});
