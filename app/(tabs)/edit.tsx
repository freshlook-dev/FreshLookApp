'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, router } from 'expo-router';

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
};

export default function EditAppointment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);

  const [clientName, setClientName] = useState('');
  const [service, setService] = useState('');

  const [date, setDate] = useState<Date>(new Date());
  const [time, setTime] = useState<Date>(new Date());

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (user && id) loadData();
  }, [user, id]);

  const loadData = async () => {
    setLoading(true);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single();

    if (!profile || (profile.role as Role) === 'staff') {
      Alert.alert('Access denied', 'You cannot edit appointments');
      router.replace('/(tabs)/upcoming');
      return;
    }

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      Alert.alert('Error', 'Appointment not found');
      router.replace('/(tabs)/upcoming');
      return;
    }

    const appt = data as Appointment;

    setClientName(appt.client_name);
    setService(appt.service);

    setDate(new Date(appt.appointment_date));
    setTime(new Date(`1970-01-01T${appt.appointment_time}`));

    setLoading(false);
  };

  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const formatTime = (d: Date) => d.toTimeString().slice(0, 5);

  const handleSave = async () => {
    if (!clientName || !service) {
      Alert.alert('Error', 'All fields are required');
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from('appointments')
      .update({
        client_name: clientName,
        service,
        appointment_date: formatDate(date),
        appointment_time: formatTime(time),
      })
      .eq('id', id);

    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }

    await supabase.from('audit_logs').insert({
      actor_id: user!.id,
      action: 'UPDATE_APPOINTMENT',
      target_id: id,
    });

    // ✅ Notifications are created automatically by DB trigger
    Alert.alert('Success', 'Appointment updated');
    router.replace('/(tabs)/upcoming');
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
      <SectionTitle>Edit Appointment</SectionTitle>

      <Card>
        <Text style={styles.label}>Client Name</Text>
        <TextInput value={clientName} onChangeText={setClientName} style={styles.input} />
      </Card>

      <Card>
        <Text style={styles.label}>Service</Text>
        <TextInput value={service} onChangeText={setService} style={styles.input} />
      </Card>

      <Card>
        <Text style={styles.label}>Date</Text>
        <Pressable onPress={() => setShowDatePicker(true)} style={styles.pickerButton}>
          <Text style={styles.pickerText}>{formatDate(date)}</Text>
        </Pressable>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(e, d) => {
              setShowDatePicker(false);
              if (d) setDate(d);
            }}
          />
        )}
      </Card>

      <Card>
        <Text style={styles.label}>Time</Text>
        <Pressable onPress={() => setShowTimePicker(true)} style={styles.pickerButton}>
          <Text style={styles.pickerText}>{formatTime(time)}</Text>
        </Pressable>

        {showTimePicker && (
          <DateTimePicker
            value={time}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(e, t) => {
              setShowTimePicker(false);
              if (t) setTime(t);
            }}
          />
        )}
      </Card>

      <Pressable onPress={handleSave} style={styles.saveButton}>
        <Text style={styles.saveButtonText}>Save Changes</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: Colors.textSecondary, borderRadius: 10, padding: Spacing.md, fontSize: 16 },
  pickerButton: { borderWidth: 1, borderColor: Colors.textSecondary, borderRadius: 10, padding: Spacing.md, alignItems: 'center' },
  pickerText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  saveButton: { marginTop: Spacing.lg, backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
