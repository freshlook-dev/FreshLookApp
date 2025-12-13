'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

import { Colors, Spacing } from '../../constants/theme';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';

type Role = 'owner' | 'manager' | 'staff';

type Appointment = {
  id: string;
  client_name: string;
  service: string;
  appointment_date: string;
  appointment_time: string;
  comment: string | null;
  created_by: string;
  creator_name: string | null;
};

type Profile = {
  id: string;
  role: Role;
};

export default function UpcomingAppointments() {
  const { user } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user!.id)
      .single();

    setProfile(profileData);

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        client_name,
        service,
        appointment_date,
        appointment_time,
        comment,
        created_by,
        profiles:created_by (
          full_name
        )
      `)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const mapped: Appointment[] = (data ?? []).map((a: any) => ({
      id: a.id,
      client_name: a.client_name,
      service: a.service,
      appointment_date: a.appointment_date,
      appointment_time: a.appointment_time,
      comment: a.comment,
      created_by: a.created_by,
      creator_name: a.profiles?.full_name ?? 'Unknown',
    }));

    setAppointments(mapped);
    setLoading(false);
  };

  const canEdit = profile?.role === 'owner' || profile?.role === 'manager';

  const handleDelete = async (id: string) => {
    Alert.alert('Delete appointment?', 'This action cannot be undone', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('appointments').delete().eq('id', id);
          loadData();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionTitle>Upcoming Appointments</SectionTitle>

      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.client}>{item.client_name}</Text>
            <Text style={styles.service}>{item.service}</Text>
            <Text style={styles.datetime}>
              {item.appointment_date} • {item.appointment_time}
            </Text>

            <Text style={styles.creator}>
              👤 Created by: {item.creator_name}
            </Text>

            {item.comment && (
              <Text style={styles.comment}>📝 {item.comment}</Text>
            )}

            {canEdit && (
              <View style={styles.actions}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/edit',
                      params: { id: item.id },
                    })
                  }
                >
                  <Text style={styles.edit}>Edit</Text>
                </Pressable>

                <Pressable onPress={() => handleDelete(item.id)}>
                  <Text style={styles.delete}>Delete</Text>
                </Pressable>
              </View>
            )}
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  client: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  service: { fontSize: 14, color: Colors.textSecondary },
  datetime: { marginTop: 4, fontSize: 13, color: Colors.textSecondary },
  creator: { marginTop: 6, fontSize: 12, color: Colors.textSecondary },
  comment: { marginTop: 4, fontStyle: 'italic', color: Colors.textSecondary },
  actions: { flexDirection: 'row', marginTop: Spacing.sm },
  edit: { marginRight: Spacing.md, color: Colors.accent, fontWeight: '700' },
  delete: { color: Colors.danger, fontWeight: '700' },
});
