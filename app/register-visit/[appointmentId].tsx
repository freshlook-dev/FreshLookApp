'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

type Role = 'owner' | 'manager' | 'staff';
type PaymentMethod = 'cash' | 'bank' | 'mixed';

export default function RegisterVisitScreen() {
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [role, setRole] = useState<Role>('staff');

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('cash');
  const [paidCash, setPaidCash] = useState('');
  const [paidBank, setPaidBank] = useState('');
  const [notes, setNotes] = useState('');

  const [existing, setExisting] = useState(false);
  const [originalData, setOriginalData] = useState<any>(null);

  /* ================= LOAD ================= */

  useEffect(() => {
    if (!user?.id || !appointmentId) return;
    loadAll();
  }, [user, appointmentId]);

  const loadAll = async () => {
    setLoading(true);

    const [{ data: profile }, { data: appointment }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user!.id).single(),
      supabase
        .from('appointments')
        .select(
          'status, payment_method, paid_cash, paid_bank, visit_notes'
        )
        .eq('id', appointmentId)
        .single(),
    ]);

    setRole(profile?.role ?? 'staff');

    if (appointment?.payment_method) {
      setExisting(true);
      setOriginalData(appointment);
      setPaymentMethod(appointment.payment_method);
      setPaidCash(
        appointment.paid_cash !== null
          ? String(appointment.paid_cash)
          : ''
      );
      setPaidBank(
        appointment.paid_bank !== null
          ? String(appointment.paid_bank)
          : ''
      );
      setNotes(appointment.visit_notes ?? '');
    }

    setLoading(false);
  };

  /* ================= PERMISSIONS ================= */

  const canSave =
    role === 'owner' || (role === 'manager' && !existing);

  /* ================= SAVE ================= */

  const handleSave = async () => {
    if (!canSave) {
      Alert.alert('Nuk keni leje për këtë veprim');
      return;
    }

    if (
      paymentMethod === 'cash' &&
      paidCash.trim() === ''
    ) {
      Alert.alert('Shkruani shumën cash');
      return;
    }

    if (
      paymentMethod === 'bank' &&
      paidBank.trim() === ''
    ) {
      Alert.alert('Shkruani shumën bankë');
      return;
    }

    if (
      paymentMethod === 'mixed' &&
      (paidCash.trim() === '' || paidBank.trim() === '')
    ) {
      Alert.alert('Shkruani të dy shumat');
      return;
    }

    Alert.alert(
      existing ? 'Përditëso regjistrimin' : 'Regjistro vizitën',
      'A jeni të sigurt që dëshironi ta ruani këtë regjistrim?',
      [
        { text: 'Jo', style: 'cancel' },
        {
          text: 'Po',
          onPress: async () => {
            setSaving(true);

            const payload = {
              payment_method: paymentMethod,
              paid_cash:
                paidCash.trim() === '' ? null : Number(paidCash),
              paid_bank:
                paidBank.trim() === '' ? null : Number(paidBank),
              visit_notes: notes || null,
            };

            const { error } = await supabase
              .from('appointments')
              .update(payload)
              .eq('id', appointmentId);

            if (error) {
              Alert.alert('Error', error.message);
              setSaving(false);
              return;
            }

            /* ================= AUDIT LOG ================= */

            await supabase.from('audit_logs').insert({
              actor_id: user!.id,
              action: existing
                ? 'VISIT_UPDATED'
                : 'VISIT_REGISTERED',
              target_id: appointmentId,
              metadata: {
                before: existing ? originalData : null,
                after: payload,
                role,
              },
            });

            setSaving(false);

            Alert.alert(
              'Sukses ✅',
              existing
                ? 'Regjistrimi u përditësua me sukses.'
                : 'Vizita u regjistrua me sukses.',
              [
                {
                  text: 'OK',
                  onPress: () => router.replace('/(tabs)'),
                },
              ]
            );
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View
        style={[styles.center, { backgroundColor: Colors.background }]}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: Colors.background }]}
    >
      <Text style={[styles.title, { color: Colors.text }]}>
        Regjistrim vizite
      </Text>

      <View style={styles.methodRow}>
        {(['cash', 'bank', 'mixed'] as PaymentMethod[]).map(
          (m) => (
            <Pressable
              key={m}
              onPress={() => setPaymentMethod(m)}
              style={[
                styles.methodBtn,
                {
                  backgroundColor:
                    paymentMethod === m
                      ? Colors.primary
                      : Colors.card,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    paymentMethod === m
                      ? '#fff'
                      : Colors.text,
                  fontWeight: '700',
                }}
              >
                {m === 'cash'
                  ? 'Cash'
                  : m === 'bank'
                  ? 'Bank'
                  : 'Cash + Bank'}
              </Text>
            </Pressable>
          )
        )}
      </View>

      {(paymentMethod === 'cash' ||
        paymentMethod === 'mixed') && (
        <TextInput
          value={paidCash}
          onChangeText={setPaidCash}
          keyboardType="numeric"
          placeholder="Sa ka paguar cash"
          style={[styles.input, { color: Colors.text }]}
        />
      )}

      {(paymentMethod === 'bank' ||
        paymentMethod === 'mixed') && (
        <TextInput
          value={paidBank}
          onChangeText={setPaidBank}
          keyboardType="numeric"
          placeholder="Sa ka paguar bankë"
          style={[styles.input, { color: Colors.text }]}
        />
      )}

      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Shënime shtesë pas vizitës"
        multiline
        style={[
          styles.input,
          { height: 90, color: Colors.text },
        ]}
      />

      <Pressable
        onPress={handleSave}
        disabled={!canSave || saving}
        style={[
          styles.saveBtn,
          {
            backgroundColor: canSave
              ? Colors.primary
              : Colors.muted,
          },
        ]}
      >
        <Text style={styles.saveText}>
          {existing ? 'Përditëso' : 'Ruaj'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.replace('/(tabs)')}
        style={[styles.homeBtn, { backgroundColor: Colors.card }]}
      >
        <Text style={[styles.homeText, { color: Colors.text }]}>
          Shko në Home
        </Text>
      </Pressable>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  methodRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  saveBtn: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '800' },
  homeBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  homeText: { fontWeight: '700' },
});
