'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';

import { Calendar } from 'react-native-calendars';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

import { Colors, Spacing } from '../../constants/theme';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';

type Appointment = {
  id: string;
  client_name: string;
  service: string;
  appointment_date: string;
  appointment_time: string;
  comment: string | null;
  creator_name: string | null;
};

export default function CalendarTab() {
  const { user } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadAppointments();
  }, [user]);

  const loadAppointments = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        client_name,
        service,
        appointment_date,
        appointment_time,
        comment,
        profiles:created_by (
          full_name
        )
      `);

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
      creator_name: a.profiles?.full_name ?? 'Unknown',
    }));

    setAppointments(mapped);
    setLoading(false);
  };

  const markedDates = appointments.reduce((acc: any, a) => {
    acc[a.appointment_date] = { marked: true, dotColor: Colors.primary };
    return acc;
  }, {});

  const dailyAppointments = appointments.filter(
    (a) => a.appointment_date === selectedDate
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
      <SectionTitle>Calendar</SectionTitle>

      <Calendar
        markedDates={markedDates}
        onDayPress={(day) => setSelectedDate(day.dateString)}
      />

      <FlatList
        data={dailyAppointments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.client}>{item.client_name}</Text>
            <Text style={styles.service}>{item.service}</Text>
            <Text style={styles.time}>{item.appointment_time}</Text>
            <Text style={styles.creator}>👤 {item.creator_name}</Text>
            {item.comment && (
              <Text style={styles.comment}>📝 {item.comment}</Text>
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
  time: { marginTop: 4, fontSize: 13, color: Colors.textSecondary },
  creator: { marginTop: 6, fontSize: 12, color: Colors.textSecondary },
  comment: { marginTop: 4, fontStyle: 'italic', color: Colors.textSecondary },
});
