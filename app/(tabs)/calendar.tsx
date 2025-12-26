'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';

import { Calendar, DateData } from 'react-native-calendars';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

import { Spacing } from '../../constants/theme';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';

type Appointment = {
  id: string;
  client_name: string;
  service: string;
  appointment_date: string;
  appointment_time: string;
  phone: string | null;
  location: string | null;
  comment: string | null;
  creator_name: string | null;
  status: 'upcoming';
};

/* 🔹 HELPERS */
const formatTime = (time: string) => time.slice(0, 5);
const today = new Date().toISOString().split('T')[0];

export default function CalendarTab() {
  const { user } = useAuth();

  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setSelectedDate(today);
      loadAppointments();
    }
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
        phone,
        location,
        comment,
        status,
        profiles:created_by (
          full_name
        )
      `)
      .eq('status', 'upcoming')
      .eq('archived', false);

    if (!error && data) {
      setAppointments(
        data.map((a: any) => ({
          ...a,
          creator_name: a.profiles?.full_name ?? 'Unknown',
        }))
      );
    }

    setLoading(false);
  };

  /* 🔴 MARKED DATES */
  const markedDates = appointments.reduce((acc: any, a) => {
    acc[a.appointment_date] = {
      marked: true,
      dotColor: Colors.primary,
    };
    return acc;
  }, {});

  /* 📅 DAILY APPOINTMENTS */
  const dailyAppointments = appointments
    .filter((a) => a.appointment_date === selectedDate)
    .sort((a, b) =>
      a.appointment_time.localeCompare(b.appointment_time)
    );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: Colors.background },
      ]}
    >
      <SectionTitle>Calendar</SectionTitle>

      <Calendar
        minDate={today}
        disableAllTouchEventsForDisabledDays
        markedDates={{
          ...markedDates,

          ...(today && today !== selectedDate && {
            [today]: {
              marked: markedDates[today]?.marked,
              dotColor: Colors.primary,
              selected: true,
              selectedColor: Colors.primary + '20',
            },
          }),

          ...(selectedDate && {
            [selectedDate]: {
              selected: true,
              selectedColor: Colors.primary,
              marked: markedDates[selectedDate]?.marked,
              dotColor: Colors.primary,
            },
          }),
        }}
        onDayPress={(day: DateData) =>
          setSelectedDate(day.dateString)
        }
        theme={{
          backgroundColor: Colors.background,
          calendarBackground: Colors.background,
          dayTextColor: Colors.text,
          monthTextColor: Colors.text,
          textSectionTitleColor: Colors.muted,
          todayTextColor: Colors.primary,
          arrowColor: Colors.primary,
          selectedDayTextColor: '#fff',
          dotColor: Colors.primary,
          selectedDotColor: '#fff',
        }}
      />

      {selectedDate && dailyAppointments.length === 0 && (
        <Text style={[styles.empty, { color: Colors.muted }]}>
          No appointments for this day
        </Text>
      )}

      <FlatList
        data={dailyAppointments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Card>
            <Text style={[styles.client, { color: Colors.text }]}>
              {item.client_name}
            </Text>
            <Text style={[styles.service, { color: Colors.muted }]}>
              {item.service}
            </Text>

            <Text style={[styles.time, { color: Colors.muted }]}>
              {formatTime(item.appointment_time)}
            </Text>

            {item.phone && (
              <Text style={[styles.phone, { color: Colors.muted }]}>
                📞 {item.phone}
              </Text>
            )}

            {item.location && (
              <Text
                style={[styles.location, { color: Colors.muted }]}
              >
                📍 {item.location}
              </Text>
            )}

            <Text style={[styles.creator, { color: Colors.muted }]}>
              👤 {item.creator_name}
            </Text>

            {item.comment && (
              <Text
                style={[styles.comment, { color: Colors.muted }]}
              >
                📝 {item.comment}
              </Text>
            )}
          </Card>
        )}
      />
    </View>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  client: {
    fontSize: 16,
    fontWeight: '700',
  },
  service: {
    fontSize: 14,
  },
  time: {
    marginTop: 4,
    fontSize: 13,
  },
  phone: {
    marginTop: 4,
    fontSize: 13,
  },
  location: {
    marginTop: 2,
    fontSize: 13,
  },
  creator: {
    marginTop: 6,
    fontSize: 12,
  },
  comment: {
    marginTop: 4,
    fontStyle: 'italic',
  },
  empty: {
    marginTop: Spacing.md,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
