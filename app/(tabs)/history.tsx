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
import { router } from 'expo-router'; // ✅ ADDED

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

type Status = 'arrived' | 'canceled' | 'upcoming';
type Filter = 'arrived' | 'canceled'; // ✅ ADDED

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

  const [loading, setLoading] = useState(true);
  const [arrived, setArrived] = useState<Appointment[]>([]);
  const [canceled, setCanceled] = useState<Appointment[]>([]);
  const [archived, setArchived] = useState<Appointment[]>([]);
  const [selected, setSelected] = useState<Appointment | null>(null);

  const [canManage, setCanManage] = useState(false);
  const [filter, setFilter] = useState<Filter>('arrived'); // ✅ ADDED

  useEffect(() => {
    if (user?.id) {
      loadData();
      checkUserRole();
    }
  }, [user]);

  /* ---------------- AUDIT LOG ---------------- */

  const logAction = async (
    action: 'STATUS_CHANGE' | 'ARCHIVE' | 'UNARCHIVE',
    targetId: string,
    metadata?: any
  ) => {
    if (!user?.id) return;

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action,
      target_id: targetId,
      metadata,
    });
  };

  /* ---------------- LOAD DATA ---------------- */

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

  /* ---------------- ROLE ---------------- */

  const checkUserRole = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    setCanManage(data?.role === 'owner' || data?.role === 'manager');
  };

  /* ---------------- ACTIONS ---------------- */

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    await logAction('STATUS_CHANGE', id, { status });

    setSelected(null);
    loadData();
  };

  const archiveRecord = async (id: string) => {
    if (!canManage) return;

    const message = 'A jeni të sigurt që doni ta fshihni këtë regjistrim?';

    const confirmed =
      Platform.OS === 'web'
        ? confirm(message)
        : await new Promise<boolean>((resolve) => {
            Alert.alert('Fshih regjistrimin', message, [
              { text: 'Jo', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Po', onPress: () => resolve(true) },
            ]);
          });

    if (!confirmed) return;

    const { error } = await supabase
      .from('appointments')
      .update({ archived: true })
      .eq('id', id);

    if (!error) {
      await logAction('ARCHIVE', id);
    }

    setSelected(null);
    loadData();
  };

  const unarchiveRecord = async (id: string) => {
    if (!canManage) return;

    const { error } = await supabase
      .from('appointments')
      .update({ archived: false })
      .eq('id', id);

    if (!error) {
      await logAction('UNARCHIVE', id);
    }

    setSelected(null);
    loadData();
  };

  /* ---------------- RENDER ---------------- */

  const renderItem = (item: Appointment) => (
    <Pressable onPress={() => setSelected(item)} style={styles.row}>
      <Text style={styles.client}>{item.client_name}</Text>
      {item.creator_name && (
        <Text style={styles.creator}>Krijuar nga: {item.creator_name}</Text>
      )}
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ✅ FILTER BUTTONS */}
      <View style={styles.filterRow}>
        <Pressable
          onPress={() => setFilter('arrived')}
          style={[
            styles.filterBtn,
            filter === 'arrived' && styles.filterActive,
          ]}
        >
          <Text style={styles.filterText}>Ka ardhur</Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter('canceled')}
          style={[
            styles.filterBtn,
            filter === 'canceled' && styles.filterActive,
          ]}
        >
          <Text style={styles.filterText}>Anulim</Text>
        </Pressable>

        {/* ✅ REDIRECT BUTTON */}
        {canManage && (
          <Pressable
            onPress={() => router.push('/archived')}
            style={styles.archiveNavBtn}
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

      {/* ---------------- MODAL ---------------- */}

      <Modal visible={!!selected} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Pressable onPress={() => setSelected(null)} style={styles.close}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>

            {selected && (
              <>
                <Text style={styles.modalName}>{selected.client_name}</Text>
                <Text style={styles.modalText}>{selected.service}</Text>
                <Text style={styles.modalText}>
                  {formatDate(selected.appointment_date)} •{' '}
                  {selected.appointment_time}
                </Text>

                {selected.creator_name && (
                  <Text style={styles.modalText}>
                    👤 {selected.creator_name}
                  </Text>
                )}

                {!selected.archived && (
                  <>
                    {selected.status !== 'arrived' && (
                      <Pressable
                        onPress={() => updateStatus(selected.id, 'arrived')}
                        style={styles.statusBtn}
                      >
                        <Text style={styles.statusText}>Ka ardhur</Text>
                      </Pressable>
                    )}

                    {selected.status !== 'canceled' && (
                      <Pressable
                        onPress={() => updateStatus(selected.id, 'canceled')}
                        style={styles.statusBtn}
                      >
                        <Text style={styles.statusText}>Anulim</Text>
                      </Pressable>
                    )}

                    <Pressable
                      onPress={() => updateStatus(selected.id, 'upcoming')}
                      style={styles.statusBtn}
                    >
                      <Text style={styles.statusText}>Ne pritje</Text>
                    </Pressable>

                    {canManage && (
                      <Pressable
                        onPress={() => archiveRecord(selected.id)}
                        style={styles.hideBtn}
                      >
                        <Text style={styles.hideText}>Fshih</Text>
                      </Pressable>
                    )}
                  </>
                )}

                {selected.archived && canManage && (
                  <Pressable
                    onPress={() => unarchiveRecord(selected.id)}
                    style={styles.unarchiveBtn}
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

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F4',
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  filterBtn: {
    flex: 1,
    backgroundColor: '#EDEDED',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 6,
  },
  filterActive: {
    backgroundColor: '#C9A24D',
  },
  filterText: {
    fontWeight: '700',
  },
  archiveNavBtn: {
    backgroundColor: '#2B2B2B',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  archiveNavText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  row: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  client: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2B2B2B',
  },
  creator: {
    fontSize: 12,
    color: '#7A7A7A',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '90%',
  },
  close: {
    position: 'absolute',
    top: 10,
    right: 14,
  },
  closeText: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  modalText: {
    fontSize: 14,
    marginBottom: 4,
  },
  statusBtn: {
    marginTop: 10,
    backgroundColor: '#EDEDED',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  statusText: {
    fontWeight: '700',
  },
  hideBtn: {
    marginTop: 12,
    backgroundColor: '#C9A24D',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  hideText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  unarchiveBtn: {
    marginTop: 16,
    backgroundColor: '#2B2B2B',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  unarchiveText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
