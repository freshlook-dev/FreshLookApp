import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { supabase } from '../context/supabase';
import { kosovoAppointmentDateTime } from './dateTime';

type Appointment = {
  id: string;
  service: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  location: string | null;
};

const REMINDERS = [
  { key: '12h', hours: 12, label: '12 orë' },
  { key: '2h', hours: 2, label: '2 orë' },
  { key: '1h', hours: 1, label: '1 orë' },
];

let reminderQueue: Promise<void> = Promise.resolve();

const enqueueReminderOperation = (operation: () => Promise<void>) => {
  const next = reminderQueue.catch(() => {}).then(operation);
  reminderQueue = next;
  return next;
};

function appointmentDateTime(item: Appointment) {
  return kosovoAppointmentDateTime(
    item.appointment_date,
    String(item.appointment_time ?? '').substring(0, 8)
  );
}

function reminderBody(item: Appointment, label: string) {
  const service = item.service || 'termini';
  const location = item.location ? ` në ${item.location}` : '';
  return `Kujtesë: ${service}${location} fillon pas ${label}.`;
}

async function cancelClientAppointmentReminders(userId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(
        (item) =>
          item.content.data?.type === 'appointment_reminder' &&
          item.content.data?.userId === userId
      )
      .map((item) =>
        Notifications.cancelScheduledNotificationAsync(item.identifier)
      )
  );
}

async function performReminderSync(userId: string) {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return;

  // Read the replacement set before deleting working reminders. A temporary
  // database failure must not silently wipe all reminders on the device.
  const { data, error } = await supabase
    .from('appointments')
    .select('id, service, appointment_date, appointment_time, location')
    .eq('user_id', userId)
    .eq('status', 'upcoming')
    .eq('archived', false);

  if (error) throw error;

  await cancelClientAppointmentReminders(userId);

  const now = Date.now();
  const minLeadTime = 60 * 1000;

  for (const appointment of ((data ?? []) as Appointment[])) {
    const start = appointmentDateTime(appointment);
    if (!start) continue;

    for (const reminder of REMINDERS) {
      const triggerDate = new Date(start.getTime() - reminder.hours * 60 * 60 * 1000);
      if (triggerDate.getTime() <= now + minLeadTime) continue;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Kujtesë për terminin',
          body: reminderBody(appointment, reminder.label),
          sound: 'default',
          data: {
            type: 'appointment_reminder',
            userId,
            appointmentId: appointment.id,
            reminder: reminder.key,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
          channelId: Platform.OS === 'android' ? 'default' : undefined,
        },
      });
    }
  }
}

export function syncClientAppointmentReminders(userId: string) {
  return enqueueReminderOperation(() => performReminderSync(userId));
}

export function clearClientAppointmentReminders(userId: string) {
  return enqueueReminderOperation(() => cancelClientAppointmentReminders(userId));
}
