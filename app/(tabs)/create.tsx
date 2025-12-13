'use client';

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

import { Colors, Spacing } from '../../constants/theme';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';

export default function CreateAppointment() {
  const { user } = useAuth();

  const [clientName, setClientName] = useState('');
  const [service, setService] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const formatTime = (d: Date) => d.toTimeString().slice(0, 5);

  const handleCreate = async () => {
    if (!clientName || !service || !user) {
      Alert.alert('Error', 'All fields are required');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('appointments').insert({
        client_name: clientName,
        service,
        appointment_date: formatDate(date),
        appointment_time: formatTime(time),
        created_by: user.id,
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'CREATE_APPOINTMENT',
      });

      // ✅ Notifications are created automatically by DB trigger
      Alert.alert('Success', 'Appointment created');
      router.replace('/(tabs)/upcoming');
    } catch {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SectionTitle>New Appointment</SectionTitle>

      <Card>
        <Text style={styles.label}>Client Name</Text>
        <TextInput
          value={clientName}
          onChangeText={setClientName}
          placeholder="Client full name"
          style={styles.input}
        />
      </Card>

      <Card>
        <Text style={styles.label}>Service</Text>
        <TextInput
          value={service}
          onChangeText={setService}
          placeholder="Service (e.g. Facial)"
          style={styles.input}
        />
      </Card>

      <Card>
        <Text style={styles.label}>Date</Text>
        <Pressable onPress={() => setShowDatePicker(true)} style={styles.picker}>
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
        <Pressable onPress={() => setShowTimePicker(true)} style={styles.picker}>
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

      <Pressable style={styles.button} onPress={handleCreate} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'Saving...' : 'Create Appointment'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, backgroundColor: Colors.background },
  label: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: Colors.textSecondary, borderRadius: 10, padding: Spacing.md, fontSize: 16 },
  picker: { borderWidth: 1, borderColor: Colors.textSecondary, borderRadius: 10, padding: Spacing.md, alignItems: 'center' },
  pickerText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  button: { marginTop: Spacing.lg, backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
