import { supabase } from '../context/supabase';

export type AppointmentNotificationEvent = 'created' | 'updated' | 'status_changed' | 'canceled';

type AppointmentPayload = {
  id?: string | null;
  service?: string | null;
  client_name?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  location?: string | null;
  status?: string | null;
};

export async function notifyStaffAppointmentChange(
  event: AppointmentNotificationEvent,
  appointment: AppointmentPayload
) {
  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        mode: 'appointment_event',
        event,
        appointment,
      },
    });

    if (error || data?.error) {
      throw error ?? new Error(String(data.error));
    }
  } catch (error) {
    console.warn('Staff appointment notification failed', error);
  }
}
