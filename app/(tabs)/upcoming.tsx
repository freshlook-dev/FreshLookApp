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
  comment?: string | null;
  created_by: string;
  creator_name?: string | null;
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
        creator:profiles!appointments_created_by_fkey(full_name)
      `)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });

    if (!error && data) {
      const mapped = data.map((a: any) => ({
        ...a,
        creator_name: a.creator?.full_name ?? 'Unknown',
      }));
      setAppointments(mapped);
    }

    setLoading(false);
  };

  const canEdit = profile?.role === 'owner' || profile?.role === 'manager';

  const handleDelete = async (appointmentId: string) => {
    Alert.alert(
      'Delete Appointment',
      'Are you sure you want to delete this appointment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('appointments')
              .delete()
              .eq('id', appointmentId);

            await supabase.from('audit_logs').insert({
              actor_id: user!.id,
              action: 'DELETE_APPOINTMENT',
              target_id: appointmentId,
            });

            loadData();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: Spacing.sm }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionTitle>Upcoming Appointments</SectionTitle>

      {appointments.length === 0 ? (
        <Text style={styles.empty}>No appointments found</Text>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
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

              {item.comment ? (
                <Text style={styles.comment}>📝 {item.comment}</Text>
              ) : null}

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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
    backgroundColor: Colors.background,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: {
    textAlign: 'center',
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  client: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  service: {
    fontSize: 14,
    marginTop: 2,
    color: Colors.textSecondary,
  },
  datetime: {
    fontSize: 13,
    marginTop: Spacing.xs,
    color: Colors.textSecondary,
  },
  creator: {
    marginTop: Spacing.xs,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  comment: {
    marginTop: Spacing.xs,
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  actions: { flexDirection: 'row', marginTop: Spacing.sm },
  edit: {
    marginRight: Spacing.md,
    fontWeight: '700',
    color: Colors.accent,
  },
  delete: { fontWeight: '700', color: Colors.danger },
});
