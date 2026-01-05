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
  Platform,
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
          'payment_method, paid_cash, paid_bank, visit_notes'
        )
        .eq('id', appointmentId)
        .single(),
    ]);

    setRole(profile?.role ?? 'staff');

    if (appointment?.payment_method) {
      setExisting(true);
      setOriginalData(appointment);
      setPaymentMethod(appointment.payment_method);
      setPaidCash(appointment.paid_cash?.toString() ?? '');
      setPaidBank(appointment.paid_bank?.toString() ?? '');
      setNotes(appointment.visit_notes ?? '');
    }

    setLoading(false);
  };

  const canSave =
    role === 'owner' || (role === 'manager' && !existing);

  const validate = () => {
    if (paymentMethod === 'cash' && !paidCash) return false;
    if (paymentMethod === 'bank' && !paidBank) return false;
    if (paymentMethod === 'mixed' && (!paidCash || !paidBank)) return false;
    return true;
  };

  const doSave = async () => {
    setSaving(true);

    const payload = {
      payment_method: paymentMethod,
      paid_cash: paidCash ? Number(paidCash) : null,
      paid_bank: paidBank ? Number(paidBank) : null,
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

    await supabase.from('audit_logs').insert({
      actor_id: user!.id,
      action: existing ? 'VISIT_UPDATED' : 'VISIT_REGISTERED',
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
      [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
    );
  };

  const handleSave = () => {
    if (!canSave) return Alert.alert('Nuk keni leje');
    if (!validate()) return Alert.alert('Plotësoni fushat e pagesës');

    if (Platform.OS === 'web') {
      if (window.confirm('A jeni të sigurt që dëshironi ta ruani?')) {
        doSave();
      }
    } else {
      Alert.alert(
        'Konfirmim',
        'A jeni të sigurt që dëshironi ta ruani?',
        [
          { text: 'Jo', style: 'cancel' },
          { text: 'Po', onPress: doSave },
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Text style={[styles.title, { color: Colors.text }]}>
        Regjistrim vizite
      </Text>

      <View style={styles.methodRow}>
        {(['cash', 'bank', 'mixed'] as PaymentMethod[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => setPaymentMethod(m)}
            style={[
              styles.methodBtn,
              {
                backgroundColor:
                  paymentMethod === m ? Colors.primary : Colors.card,
              },
            ]}
          >
            <Text style={{ color: paymentMethod === m ? '#fff' : Colors.text }}>
              {m === 'cash'
                ? 'Cash'
                : m === 'bank'
                ? 'Bank'
                : 'Cash + Bank'}
            </Text>
          </Pressable>
        ))}
      </View>

      {(paymentMethod === 'cash' || paymentMethod === 'mixed') && (
        <View style={styles.moneyRow}>
          <Text style={styles.euro}>€</Text>
          <TextInput
            value={paidCash}
            onChangeText={setPaidCash}
            keyboardType="numeric"
            placeholder="Cash"
            style={styles.moneyInput}
          />
        </View>
      )}

      {(paymentMethod === 'bank' || paymentMethod === 'mixed') && (
        <View style={styles.moneyRow}>
          <Text style={styles.euro}>€</Text>
          <TextInput
            value={paidBank}
            onChangeText={setPaidBank}
            keyboardType="numeric"
            placeholder="Bank"
            style={styles.moneyInput}
          />
        </View>
      )}

      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Shënime shtesë"
        multiline
        style={[styles.input, { height: 90 }]}
      />

      <Pressable
        onPress={handleSave}
        disabled={saving}
        style={[styles.saveBtn, { backgroundColor: Colors.primary }]}
      >
        <Text style={styles.saveText}>Ruaj</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  methodRow: { flexDirection: 'row', marginBottom: 16 },
  methodBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 6,
  },
  moneyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  euro: { fontSize: 18, marginRight: 6 },
  moneyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
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
});
