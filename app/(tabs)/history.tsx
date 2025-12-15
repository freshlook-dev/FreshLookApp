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

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

type Status = 'arrived' | 'canceled';

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
  const [selected, setSelected] = useState<Appointment | null>(null);

  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadData();
      checkUserRole();
    }
  }, [user]);

  // Load appointment data
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
        status
      `)
      .in('status', ['arrived', 'canceled'])
      .eq('archived', false)
      .order('appointment_date', { ascending: false });

    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }

    setArrived(data.filter((a) => a.status === 'arrived'));
    setCanceled(data.filter((a) => a.status === 'canceled'));
    setLoading(false);
  };

  // Check if the user is an owner
  const checkUserRole = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error checking role:', error.message);
      return;
    }

    if (data?.role === 'owner') {
      setIsOwner(true);
    } else {
      setIsOwner(false);
    }
  };

  // Archive (delete) record (only for owner)
  const archiveRecord = async (id: string) => {
    if (!isOwner) {
      Alert.alert(
        'Access Denied',
        'Only the owner can delete (archive) appointments.'
      );
      return;
    }

    // Web: confirm() is reliable
    const message =
      'A jeni të sigurt që doni ta fshihni këtë regjistrim?';

    const isConfirmed = Platform.OS === 'web' ? confirm(message) : await new Promise<boolean>((resolve) => {
      Alert.alert('Fshih regjistrimin', message, [
        { text: 'Jo', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Po', onPress: () => resolve(true) },
      ]);
    });

    if (!isConfirmed) return;

    const { error } = await supabase
      .from('appointments')
      .update({ archived: true })
      .eq('id', id);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setSelected(null);
    loadData();
  };

  const renderItem = (item: Appointment) => (
    <Pressable onPress={() => setSelected(item)} style={styles.row}>
      <Text style={styles.client}>{item.client_name}</Text>
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
      <Text style={styles.title}>Ka ardhur</Text>
      <FlatList
        data={arrived}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderItem(item)}
        ListEmptyComponent={<Text style={styles.empty}>Asnjë regjistrim</Text>}
      />

      <Text style={[styles.title, { marginTop: 24 }]}>Anulim</Text>
      <FlatList
        data={canceled}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderItem(item)}
        ListEmptyComponent={<Text style={styles.empty}>Asnjë regjistrim</Text>}
      />

      {/* MODAL */}
      <Modal visible={!!selected} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Pressable
              onPress={() => setSelected(null)}
              style={styles.close}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>

            {selected && (
              <>
                <Text style={styles.modalName}>
                  {selected.client_name}
                </Text>

                <Text style={styles.modalText}>{selected.service}</Text>

                <Text style={styles.modalText}>
                  {formatDate(selected.appointment_date)} •{' '}
                  {selected.appointment_time}
                </Text>

                {selected.location && (
                  <Text style={styles.modalText}>
                    📍 {selected.location}
                  </Text>
                )}

                {selected.phone && (
                  <Text style={styles.modalText}>
                    📞 {selected.phone}
                  </Text>
                )}

                {selected.comment && (
                  <Text style={styles.modalText}>
                    📝 {selected.comment}
                  </Text>
                )}

                {isOwner && (
                  <Pressable
                    onPress={() => archiveRecord(selected.id)}
                    style={styles.hideBtn}
                  >
                    <Text style={styles.hideText}>Fshih</Text>
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

/* ---------- STYLES ---------- */

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
    fontSize: 20,
    fontWeight: '800',
    color: '#2B2B2B',
    marginBottom: 8,
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
  empty: {
    fontSize: 13,
    color: '#7A7A7A',
    marginBottom: 12,
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
  hideBtn: {
    marginTop: 16,
    backgroundColor: '#C9A24D',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  hideText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

