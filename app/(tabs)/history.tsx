'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

type Status = 'arrived' | 'canceled' | 'upcoming';
type Filter = 'arrived' | 'canceled';

type Appointment = {
  id: string;
  client_name: string;
  service: string;
  appointment_date: string;
  appointment_time: string;
  location: string | null;
  phone: string | null;
  comment: string | null;
  status: Status;
  archived: boolean;
  creator_name: string | null;
};

const formatDate = (date: string) => {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}.${String(
    d.getMonth() + 1
  ).padStart(2, '0')}.${d.getFullYear()}`;
};

export default function HistoryScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const [loading, setLoading] = useState(true);
  const [arrived, setArrived] = useState<Appointment[]>([]);
  const [canceled, setCanceled] = useState<Appointment[]>([]);
  const [archived, setArchived] = useState<Appointment[]>([]);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [filter, setFilter] = useState<Filter>('arrived');

  useEffect(() => {
    if (user?.id) {
      loadData();
      checkUserRole();
    }
  }, [user]);

  /* ================= LOAD DATA ================= */

  const loadData = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        client_name,
        service,
        appointment_date,
        appointment_time,
        location,
        phone,
        comment,
        status,
        archived,
        creator:profiles!appointments_created_by_fkey(full_name)
      `)
      .in('status', ['arrived', 'canceled'])
      .order('appointment_date', { ascending: false });

    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }

    const mapped = data.map((a: any) => ({
      ...a,
      creator_name: a.creator?.full_name ?? null,
    }));

    setArrived(mapped.filter((a) => a.status === 'arrived' && !a.archived));
    setCanceled(mapped.filter((a) => a.status === 'canceled' && !a.archived));
    setArchived(mapped.filter((a) => a.archived));

    setLoading(false);
  };

  /* ================= ROLE ================= */

  const checkUserRole = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    setCanManage(data?.role === 'owner' || data?.role === 'manager');
  };

  /* ================= AUDIT HELPERS ================= */

  const logStatusChange = async (
    appointment: Appointment,
    newStatus: Status
  ) => {
    if (!user?.id) return;

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'STATUS_CHANGE',
      target_id: appointment.id,
      metadata: {
        appointment: {
          client_name: appointment.client_name,
          service: appointment.service,
        },
        changed: {
          status: {
            old: appointment.status,
            new: newStatus,
          },
        },
      },
    });
  };

  const logArchiveChange = async (
    appointment: Appointment,
    archived: boolean
  ) => {
    if (!user?.id) return;

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: archived ? 'ARCHIVE' : 'UNARCHIVE',
      target_id: appointment.id,
      metadata: {
        appointment: {
          client_name: appointment.client_name,
          service: appointment.service,
        },
        changed: {
          archived: {
            old: !archived,
            new: archived,
          },
        },
      },
    });
  };

  /* ================= ACTIONS ================= */

  const updateStatus = async (id: string, status: Status) => {
    const appointment = [...arrived, ...canceled, ...archived].find(
      (a) => a.id === id
    );
    if (!appointment) return;

    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    await logStatusChange(appointment, status);

    setSelected(null);
    loadData();
  };

  const archiveRecord = async (id: string) => {
    if (!canManage) return;

    const appointment = [...arrived, ...canceled].find((a) => a.id === id);
    if (!appointment) return;

    const confirmed =
      Platform.OS === 'web'
        ? window.confirm('A jeni të sigurt?')
        : await new Promise<boolean>((resolve) => {
            Alert.alert('Arkivo regjistrimin', 'A jeni të sigurt?', [
              { text: 'Jo', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Po', onPress: () => resolve(true) },
            ]);
          });

    if (!confirmed) return;

    await supabase
      .from('appointments')
      .update({ archived: true })
      .eq('id', id);

    await logArchiveChange(appointment, true);

    setSelected(null);
    loadData();
  };

  const unarchiveRecord = async (id: string) => {
    if (!canManage) return;

    const appointment = archived.find((a) => a.id === id);
    if (!appointment) return;

    await supabase
      .from('appointments')
      .update({ archived: false })
      .eq('id', id);

    await logArchiveChange(appointment, false);

    setSelected(null);
    loadData();
  };

  /* ================= RENDER ================= */

  const renderItem = (item: Appointment) => (
    <Pressable
      onPress={() => setSelected(item)}
      style={[styles.row, { backgroundColor: Colors.card }]}
    >
      <Text style={[styles.client, { color: Colors.text }]}>
        {item.client_name}
      </Text>
      {item.creator_name && (
        <Text style={[styles.creator, { color: Colors.muted }]}>
          Krijuar nga: {item.creator_name}
        </Text>
      )}
    </Pressable>
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={styles.filterRow}>
        <Pressable
          onPress={() => setFilter('arrived')}
          style={[
            styles.filterBtn,
            {
              backgroundColor:
                filter === 'arrived' ? Colors.primary : Colors.card,
            },
          ]}
        >
          <Text
            style={[
              styles.filterText,
              { color: filter === 'arrived' ? '#fff' : Colors.text },
            ]}
          >
            Ka ardhur
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter('canceled')}
          style={[
            styles.filterBtn,
            {
              backgroundColor:
                filter === 'canceled' ? Colors.primary : Colors.card,
            },
          ]}
        >
          <Text
            style={[
              styles.filterText,
              { color: filter === 'canceled' ? '#fff' : Colors.text },
            ]}
          >
            Anulim
          </Text>
        </Pressable>

        {canManage && (
          <Pressable
            onPress={() => router.push('/archived')}
            style={[
              styles.archiveNavBtn,
              { backgroundColor: Colors.primary },
            ]}
          >
            <Text style={styles.archiveNavText}>Arkivuar</Text>
          </Pressable>
        )}
      </View>

      {filter === 'arrived' && (
        <FlatList
          data={arrived}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderItem(item)}
        />
      )}

      {filter === 'canceled' && (
        <FlatList
          data={canceled}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderItem(item)}
        />
      )}

      <Modal visible={!!selected} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: Colors.card }]}>
            <Pressable onPress={() => setSelected(null)} style={styles.close}>
              <Text style={[styles.closeText, { color: Colors.text }]}>✕</Text>
            </Pressable>

            {selected && (
              <>
                <Text style={[styles.modalName, { color: Colors.text }]}>
                  {selected.client_name}
                </Text>

                <Text style={[styles.modalText, { color: Colors.text }]}>
                  {selected.service}
                </Text>

                <Text style={[styles.modalText, { color: Colors.muted }]}>
                  {formatDate(selected.appointment_date)} •{' '}
                  {selected.appointment_time}
                </Text>

                {selected.phone && (
                  <Text style={[styles.modalText, { color: Colors.text }]}>
                    📞 {selected.phone}
                  </Text>
                )}

                {!selected.archived && (
                  <>
                    {selected.status !== 'arrived' && (
                      <Pressable
                        onPress={() =>
                          updateStatus(selected.id, 'arrived')
                        }
                        style={styles.statusBtn}
                      >
                        <Text style={styles.statusText}>Ka ardhur</Text>
                      </Pressable>
                    )}

                    {selected.status !== 'canceled' && (
                      <Pressable
                        onPress={() =>
                          updateStatus(selected.id, 'canceled')
                        }
                        style={styles.statusBtn}
                      >
                        <Text style={styles.statusText}>Anulim</Text>
                      </Pressable>
                    )}

                    {selected.status !== 'upcoming' && (
                      <Pressable
                        onPress={() =>
                          updateStatus(selected.id, 'upcoming')
                        }
                        style={styles.statusBtn}
                      >
                        <Text style={styles.statusText}>Në pritje</Text>
                      </Pressable>
                    )}

                    {canManage && (
                      <Pressable
                        onPress={() => archiveRecord(selected.id)}
                        style={[styles.hideBtn, { backgroundColor: Colors.primary }]}
                      >
                        <Text style={styles.hideText}>Arkivo</Text>
                      </Pressable>
                    )}
                  </>
                )}

                {selected.archived && canManage && (
                  <Pressable
                    onPress={() => unarchiveRecord(selected.id)}
                    style={[styles.unarchiveBtn, { backgroundColor: Colors.primary }]}
                  >
                    <Text style={styles.unarchiveText}>Ç’arkivo</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterRow: { flexDirection: 'row', marginBottom: 16 },
  filterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 6,
  },
  filterText: { fontWeight: '700' },
  archiveNavBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  archiveNavText: { color: '#fff', fontWeight: '700' },
  row: { padding: 14, borderRadius: 14, marginBottom: 8 },
  client: { fontSize: 15, fontWeight: '700' },
  creator: { fontSize: 12, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: { borderRadius: 16, padding: 20, width: '90%' },
  close: { position: 'absolute', top: 10, right: 14 },
  closeText: { fontSize: 18, fontWeight: '800' },
  modalName: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  modalText: { fontSize: 14, marginBottom: 4 },
  statusBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#EDEDED',
  },
  statusText: { fontWeight: '700' },
  hideBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  hideText: { color: '#fff', fontWeight: '700' },
  unarchiveBtn: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  unarchiveText: { color: '#fff', fontWeight: '700' },
});
