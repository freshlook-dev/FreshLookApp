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
};

export default function CalendarTab() {
  const { user } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAppointments();
    }
  }, [user]);

  const loadAppointments = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('appointments')
      .select('*');

    if (!error) {
      setAppointments(data ?? []);
    }

    setLoading(false);
  };

  // Build calendar dots
  const markedDates = appointments.reduce((acc: any, appt) => {
    acc[appt.appointment_date] = {
      marked: true,
      dotColor: Colors.primary,
    };
    return acc;
  }, {});

  // Appointments for selected day
  const dailyAppointments = appointments
    .filter((a) => a.appointment_date === selectedDate)
    .sort((a, b) =>
      a.appointment_time.localeCompare(b.appointment_time)
    );

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
      <SectionTitle>Calendar</SectionTitle>

      <Calendar
        markedDates={{
          ...markedDates,
          ...(selectedDate
            ? {
                [selectedDate]: {
                  selected: true,
                  selectedColor: Colors.primary,
                  marked: true,
                },
              }
            : {}),
        }}
        onDayPress={(day) => setSelectedDate(day.dateString)}
        theme={{
          selectedDayBackgroundColor: Colors.primary,
          todayTextColor: Colors.primary,
          arrowColor: Colors.primary,
          dotColor: Colors.primary,
        }}
      />

      <View style={styles.listContainer}>
        <SectionTitle>
          {selectedDate
            ? `Appointments on ${selectedDate}`
            : 'Select a date'}
        </SectionTitle>

        {selectedDate && dailyAppointments.length === 0 && (
          <Text style={styles.empty}>
            No appointments for this day
          </Text>
        )}

        <FlatList
          data={dailyAppointments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.client}>{item.client_name}</Text>
              <Text style={styles.service}>{item.service}</Text>
              <Text style={styles.time}>{item.appointment_time}</Text>
            </Card>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    marginTop: Spacing.lg,
    flex: 1,
  },
  empty: {
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  client: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  service: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  time: {
    fontSize: 13,
    marginTop: Spacing.xs,
    color: Colors.textSecondary,
  },
});
