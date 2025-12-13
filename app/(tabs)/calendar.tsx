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
    if (user) loadAppointments();
  }, [user]);

  const loadAppointments = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('appointments')
      .select('*');

    if (!error) setAppointments(data ?? []);
    setLoading(false);
  };

  // Build calendar dots
  const markedDates = appointments.reduce((acc: any, appt) => {
    acc[appt.appointment_date] = {
      marked: true,
      dotColor: '#C9A24D',
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
        <ActivityIndicator size="large" color="#C9A24D" />
        <Text style={styles.loadingText}>Loading calendar…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>Calendar</Text>

      {/* Calendar */}
      <View style={styles.calendarWrapper}>
        <Calendar
          markedDates={{
            ...markedDates,
            ...(selectedDate
              ? {
                  [selectedDate]: {
                    selected: true,
                    selectedColor: '#C9A24D',
                    marked: true,
                  },
                }
              : {}),
          }}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          theme={{
            backgroundColor: '#FFFFFF',
            calendarBackground: '#FFFFFF',
            selectedDayBackgroundColor: '#C9A24D',
            todayTextColor: '#C9A24D',
            arrowColor: '#C9A24D',
            dotColor: '#C9A24D',
            textDayFontWeight: '500',
            textMonthFontWeight: '700',
            textDayHeaderFontWeight: '600',
          }}
        />
      </View>

      {/* Appointments list */}
      <View style={styles.listContainer}>
        <Text style={styles.subTitle}>
          {selectedDate
            ? `Appointments on ${selectedDate}`
            : 'Select a date'}
        </Text>

        {selectedDate && dailyAppointments.length === 0 && (
          <Text style={styles.empty}>
            No appointments for this day
          </Text>
        )}

        <FlatList
          data={dailyAppointments}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.client}>{item.client_name}</Text>
              <Text style={styles.service}>{item.service}</Text>
              <Text style={styles.time}>{item.appointment_time}</Text>
            </View>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F4',
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2B2B2B',
    marginBottom: 12,
  },

  calendarWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  listContainer: {
    flex: 1,
    marginTop: 20,
  },

  subTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2B2B2B',
    marginBottom: 8,
  },

  listContent: {
    paddingBottom: 40,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },

  client: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2B2B2B',
  },

  service: {
    fontSize: 14,
    marginTop: 2,
    color: '#7A7A7A',
  },

  time: {
    fontSize: 13,
    marginTop: 6,
    color: '#7A7A7A',
  },

  empty: {
    marginTop: 12,
    color: '#7A7A7A',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF8F4',
  },

  loadingText: {
    marginTop: 10,
    color: '#7A7A7A',
  },
});
