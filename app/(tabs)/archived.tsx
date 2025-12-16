'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

type Appointment = {
  id: string;
  client_name: string;
  service: string;
  appointment_date: string;
  appointment_time: string;
  creator_name: string | null;
  archived_by: string | null;
  archived_at: string | null;
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} • ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

export default function ArchivedScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [search, setSearch] = useState('');

  /* ---------------- ROLE GUARD ---------------- */

  useEffect(() => {
    if (!user?.id) return;

    const checkRole = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (data?.role !== 'owner' && data?.role !== 'manager') {
        router.replace('/(tabs)');
        return;
      }

      loadData();
    };

    checkRole();
  }, [user]);

  /* ---------------- LOAD DATA ---------------- */

  const loadData = async () => {
    setLoading(true);

    /* 1️⃣ Archived appointments */
    const { data: appts, error: apptError } = await supabase
      .from('appointments')
      .select(`
        id,
        client_name,
        service,
        appointment_date,
        appointment_time,
        creator:profiles!appointments_created_by_fkey(full_name)
      `)
      .eq('archived', true)
      .order('appointment_date', { ascending: false });

    if (apptError) {
      Alert.alert('Error', apptError.message);
      setLoading(false);
      return;
    }

    const ids = appts.map((a) => a.id);

    /* 2️⃣ Archive audit logs */
    const { data: logs } = await supabase
      .from('audit_logs')
      .select(`
        target_id,
        created_at,
        actor:profiles!audit_logs_actor_id_fkey(full_name)
      `)
      .eq('action', 'ARCHIVE')
      .in('target_id', ids)
      .order('created_at', { ascending: false });

    /* 3️⃣ Map logs to appointments */
    const mapped = appts.map((a: any) => {
      const log = logs?.find((l) => l.target_id === a.id);

      return {
        id: a.id,
        client_name: a.client_name,
        service: a.service,
        appointment_date: a.appointment_date,
        appointment_time: a.appointment_time,
        creator_name: a.creator?.[0]?.full_name ?? null,
        archived_by: log?.actor?.[0]?.full_name ?? null,
        archived_at: log?.created_at ?? null,
      };
    });

    setAppointments(mapped);
    setLoading(false);
  };

  /* ---------------- SEARCH ---------------- */

  const filtered = useMemo(() => {
    if (!search.trim()) return appointments;

    return appointments.filter((a) =>
      a.client_name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, appointments]);

  /* ---------------- UNARCHIVE ---------------- */

  const unarchiveRecord = async (id: string) => {
    const { error } = await supabase
      .from('appointments')
      .update({ archived: false })
      .eq('id', id);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    await supabase.from('audit_logs').insert({
      actor_id: user!.id,
      action: 'UNARCHIVE',
      target_id: id,
      metadata: { screen: 'archived' },
    });

    setSelected(null);
    loadData();
  };

  /* ---------------- RENDER ---------------- */

  const renderItem = ({ item }: { item: Appointment }) => (
    <Pressable onPress={() => setSelected(item)} style={styles.row}>
      <Text style={styles.client}>{item.client_name}</Text>

      {item.archived_by && item.archived_at && (
        <Text style={styles.meta}>
          Arkivuar nga {item.archived_by} •{' '}
          {formatDateTime(item.archived_at)}
        </Text>
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
      <Text style={styles.title}>Arkivuar</Text>

      <TextInput
        placeholder="Kërko klientin..."
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.empty}>Asnjë rezultat</Text>
        }
      />

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

                {selected.archived_by && selected.archived_at && (
                  <Text style={styles.modalText}>
                    📦 Arkivuar nga {selected.archived_by}
                    {'\n'}
                    🕒 {formatDateTime(selected.archived_at)}
                  </Text>
                )}

                <Pressable
                  onPress={() => unarchiveRecord(selected.id)}
                  style={styles.unarchiveBtn}
                >
                  <Text style={styles.unarchiveText}>Ç’arkivo</Text>
                </Pressable>
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
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
  },
  search: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: '#7A7A7A',
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
  },
  meta: {
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
    marginBottom: 6,
  },
  unarchiveBtn: {
    marginTop: 20,
    backgroundColor: '#2B2B2B',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  unarchiveText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
