'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

type Role = 'owner' | 'manager' | 'staff';

type StaffUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  is_active: boolean | null;
};

type Appointment = {
  id: string;
  client_name: string;
  service: string;
  appointment_date: string;
  appointment_time: string;
  created_at: string | null;
  location: string | null;
  status: string;
  archived: boolean;
  created_by: string | null;
  creator_name: string | null;
};

const formatDate = (date: string) => {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}.${String(
    d.getMonth() + 1
  ).padStart(2, '0')}.${d.getFullYear()}`;
};

const formatTime = (time: string) => time.slice(0, 5);

export default function ManageAppointmentsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    loadData();
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;

    setLoading(true);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = (profile?.role as Role | undefined) ?? null;
    setMyRole(role);

    if (role !== 'owner') {
      router.replace('/(tabs)/profile');
      return;
    }

    const [appointmentsRes, staffRes] = await Promise.all([
      supabase
        .from('appointments')
        .select(
          `
          id,
          client_name,
          service,
          appointment_date,
          appointment_time,
          created_at,
          location,
          status,
          archived,
          created_by,
          creator:profiles!appointments_created_by_fkey(full_name)
        `
        )
        .order('created_at', { ascending: false })
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false })
        .limit(250),
      supabase
        .from('profiles')
        .select('id, email, full_name, role, is_active')
        .in('role', ['owner', 'manager', 'staff'])
        .order('full_name'),
    ]);

    if (appointmentsRes.error) {
      Alert.alert('Error', appointmentsRes.error.message);
      setLoading(false);
      return;
    }

    if (staffRes.error) {
      Alert.alert('Error', staffRes.error.message);
      setLoading(false);
      return;
    }

    setAppointments(
      (appointmentsRes.data ?? []).map((a: any) => ({
        ...a,
        creator_name: a.creator?.full_name ?? null,
      }))
    );

    setStaff((staffRes.data ?? []) as StaffUser[]);
    setLoading(false);
  };

  useAutoRefresh(loadData, {
    enabled: !!user?.id && myRole === 'owner',
    tables: ['appointments', 'profiles'],
    channelName: 'manage-appointments',
  });

  const filteredAppointments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return appointments;

    return appointments.filter((item) =>
      [
        item.client_name,
        item.service,
        item.location ?? '',
        item.status,
        item.archived ? 'archived arkivuar' : '',
        item.creator_name ?? '',
        item.appointment_date,
        item.appointment_time,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [appointments, search]);

  const changeCreator = async (appointment: Appointment, nextUser: StaffUser) => {
    if (!user?.id || savingId) return;

    if (appointment.created_by === nextUser.id) {
      setSelected(null);
      return;
    }

    setSavingId(appointment.id);

    const { error } = await supabase
      .from('appointments')
      .update({ created_by: nextUser.id })
      .eq('id', appointment.id);

    if (error) {
      Alert.alert('Error', error.message);
      setSavingId(null);
      return;
    }

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'CHANGE_APPOINTMENT_OWNER',
      target_id: appointment.id,
      metadata: {
        appointment: {
          client_name: appointment.client_name,
          service: appointment.service,
        },
        changed: {
          created_by: {
            old: appointment.created_by,
            new: nextUser.id,
          },
        },
        assigned_to: {
          email: nextUser.email,
          full_name: nextUser.full_name,
        },
      },
    });

    setAppointments((prev) =>
      prev.map((item) =>
        item.id === appointment.id
          ? {
              ...item,
              created_by: nextUser.id,
              creator_name: nextUser.full_name ?? nextUser.email,
            }
          : item
      )
    );

    setSavingId(null);
    setSelected(null);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (myRole !== 'owner') return null;

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Text style={[styles.title, { color: Colors.text }]}>Menaxho terminet</Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Kerko termin, klient, sherbim, staff..."
        placeholderTextColor={Colors.muted}
        style={[
          styles.searchInput,
          {
            backgroundColor: Colors.card,
            borderColor: Colors.primary,
            color: Colors.text,
          },
        ]}
      />

      <FlatList
        data={filteredAppointments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.appointmentsList}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: Colors.card }]}>
            <View style={styles.appointmentInfo}>
              <Text style={[styles.client, { color: Colors.text }]}>
                {item.client_name}
              </Text>

              <Text style={[styles.meta, { color: Colors.muted }]}>
                {item.service} · {formatDate(item.appointment_date)}{' '}
                {formatTime(item.appointment_time)}
              </Text>

              <Text style={[styles.meta, { color: Colors.muted }]}>
                Staff: {item.creator_name ?? 'Pa staff'} · {item.status}
                {item.archived ? ' · Arkivuar' : ''}
              </Text>
            </View>

            <Pressable
              onPress={() => setSelected(item)}
              disabled={savingId === item.id}
              style={[
                styles.actionBtn,
                {
                  backgroundColor:
                    savingId === item.id ? Colors.muted : Colors.primary,
                },
              ]}
            >
              <Text style={styles.actionText}>
                {savingId === item.id ? '...' : 'Ndrysho'}
              </Text>
            </Pressable>
          </View>
        )}
      />

      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: Colors.card }]}>
            {selected && (
              <>
                <Text style={[styles.modalTitle, { color: Colors.text }]}>
                  {selected.client_name}
                </Text>

                <Text style={[styles.modalSubtitle, { color: Colors.muted }]}>
                  Zgjidh kush e ka krijuar / menaxhon termin.
                </Text>

                <ScrollView
                  style={styles.staffScroll}
                  contentContainerStyle={styles.staffListContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {staff.map((staffUser) => {
                    const active = selected.created_by === staffUser.id;
                    const disabled = staffUser.is_active === false;

                    return (
                      <Pressable
                        key={staffUser.id}
                        onPress={() => changeCreator(selected, staffUser)}
                        disabled={disabled || savingId === selected.id}
                        style={[
                          styles.staffOption,
                          {
                            borderColor: active ? Colors.primary : '#E0E0E0',
                            opacity: disabled ? 0.45 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.staffName, { color: Colors.text }]}>
                          {staffUser.full_name ?? staffUser.email}
                        </Text>

                        <Text style={[styles.staffMeta, { color: Colors.muted }]}>
                          {staffUser.role.toUpperCase()}
                          {disabled ? ' · Jo aktiv' : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Pressable
                  onPress={() => setSelected(null)}
                  style={styles.closeBtn}
                >
                  <Text style={styles.closeText}>Mbyll</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  appointmentsList: {
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  appointmentInfo: {
    flex: 1,
    paddingRight: 12,
  },
  client: {
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '78%',
    borderRadius: 18,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    marginTop: 6,
    marginBottom: 14,
    fontSize: 13,
    fontWeight: '600',
  },
  staffScroll: {
    maxHeight: 430,
  },
  staffListContent: {
    paddingBottom: 8,
  },
  staffOption: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  staffName: {
    fontSize: 15,
    fontWeight: '800',
  },
  staffMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    marginTop: 6,
    backgroundColor: '#D64545',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});