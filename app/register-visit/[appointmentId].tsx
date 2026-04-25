'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  Platform,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

type PaymentMethod = 'cash' | 'bank' | 'mixed';

type Treatment = {
  id: string;
  name: string;
  price: number;
};

const TREATMENTS: Treatment[] = [
  { id: 'facial', name: 'Pastrimi i fytyres', price: 50 },
  { id: 'carbon', name: 'Carbon Peeling', price: 50 },
  { id: 'tattoo', name: 'Largim i tatuazhit', price: 50 },
  { id: 'plasma', name: 'Plasma Pen', price: 100 },
  { id: 'epilim', name: 'Depilim me Laser', price: 100 },
  { id: 'ems', name: 'EMS', price: 50 },
  { id: 'manikyr', name: 'Manikyr', price: 15 },
  { id: 'microblading', name: 'Microblading', price: 100 },
  { id: 'filler05', name: '0.5ml', price: 80 },
  { id: 'filler1', name: '1ml', price: 150 },
  { id: '1', name: '1€', price: 1 },
  { id: '5', name: '5€', price: 5 },
  { id: '10', name: '10€', price: 10 },
];

export default function RegisterVisitScreen() {
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.10)' : '#E5E7EB';
  const softBackground = theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#F8FAFC';
  const modalOverlay = 'rgba(0,0,0,0.45)';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clientName, setClientName] = useState('');
  const [clientUserId, setClientUserId] = useState<string | null>(null);
  const [previousTotalAmount, setPreviousTotalAmount] = useState<number | null>(
    null
  );
  const [serviceName, setServiceName] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidBank, setPaidBank] = useState('');
  const [notes, setNotes] = useState('');

  const [overrideModalVisible, setOverrideModalVisible] = useState(false);
  const [overridePercent, setOverridePercent] = useState<10 | 20 | null>(null);
  const [manualTotalInput, setManualTotalInput] = useState('');

  useEffect(() => {
    if (!appointmentId) return;
    loadAppointment();
  }, [appointmentId]);

  const loadAppointment = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('appointments')
      .select(
        'client_name, service, appointment_date, appointment_time, visit_notes, user_id, total_amount'
      )
      .eq('id', appointmentId)
      .single();

    if (error) {
      Alert.alert('Gabim', error.message);
      setLoading(false);
      return;
    }

    setClientName(data?.client_name ?? '');
    setClientUserId(data?.user_id ?? null);
    const savedTotal = Number(data?.total_amount);
    setPreviousTotalAmount(Number.isFinite(savedTotal) ? savedTotal : null);
    setServiceName(data?.service ?? '');
    setAppointmentDate(data?.appointment_date ?? '');
    setAppointmentTime(data?.appointment_time ?? '');
    setNotes(data?.visit_notes ?? '');
    setLoading(false);
  };

  const increase = (id: string) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  };

  const decrease = (id: string) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) - 1),
    }));
  };

  const selectedTreatments = useMemo(() => {
    return TREATMENTS.filter((item) => (quantities[item.id] || 0) > 0).map(
      (item) => {
        const qty = quantities[item.id] || 0;
        const total = qty * item.price;

        return {
          id: item.id,
          name: item.name,
          price: item.price,
          qty,
          total,
        };
      }
    );
  }, [quantities]);

  const baseTotalAmount = useMemo(() => {
    return selectedTreatments.reduce((sum, item) => sum + item.total, 0);
  }, [selectedTreatments]);

  const manualTotalValue = Number(manualTotalInput);
  const hasManualTotal =
    manualTotalInput.trim() !== '' &&
    Number.isFinite(manualTotalValue) &&
    manualTotalValue >= 0;

  const totalAmount = useMemo(() => {
    if (hasManualTotal) return manualTotalValue;
    if (overridePercent === 10) return Number((baseTotalAmount * 0.9).toFixed(2));
    if (overridePercent === 20) return Number((baseTotalAmount * 0.8).toFixed(2));
    return baseTotalAmount;
  }, [baseTotalAmount, hasManualTotal, manualTotalValue, overridePercent]);

  const paidBankValueRaw = Number(paidBank);
  const paidBankValue =
    paymentMethod === 'mixed'
      ? Number.isFinite(paidBankValueRaw)
        ? paidBankValueRaw
        : 0
      : paymentMethod === 'bank'
      ? totalAmount
      : 0;

  const paidCashValue =
    paymentMethod === 'cash'
      ? totalAmount
      : paymentMethod === 'bank'
      ? 0
      : Math.max(0, Number((totalAmount - paidBankValue).toFixed(2)));

  const freshPointsEarned = Math.floor(totalAmount / 2);
  const previousFreshPoints = Math.floor((previousTotalAmount ?? 0) / 2);
  const freshPointsDelta = clientUserId
    ? freshPointsEarned - previousFreshPoints
    : 0;

  const formatDate = (date: string) => {
    if (!date) return '';
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}.${String(
      d.getMonth() + 1
    ).padStart(2, '0')}.${d.getFullYear()}`;
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    return time.slice(0, 5);
  };

  const closeOverrideModal = () => {
    setOverrideModalVisible(false);
  };

  const applyDiscount = (percent: 10 | 20) => {
    setOverridePercent(percent);
    setManualTotalInput('');
  };

  const clearOverride = () => {
    setOverridePercent(null);
    setManualTotalInput('');
  };

  const validate = () => {
    if (!appointmentId) {
      Alert.alert('Gabim', 'Mungon ID e terminit.');
      return false;
    }

    if (selectedTreatments.length === 0) {
      Alert.alert('Gabim', 'Zgjidh të paktën një trajtim.');
      return false;
    }

    if (baseTotalAmount <= 0) {
      Alert.alert('Gabim', 'Totali duhet të jetë më i madh se 0.');
      return false;
    }

    if (manualTotalInput.trim() !== '') {
      if (!Number.isFinite(manualTotalValue) || manualTotalValue < 0) {
        Alert.alert('Gabim', 'Shuma manuale nuk është valide.');
        return false;
      }
    }

    if (paymentMethod === 'mixed') {
      if (paidBank.trim() === '') {
        Alert.alert('Gabim', 'Shkruaj shumën e paguar me bankë.');
        return false;
      }

      if (!Number.isFinite(paidBankValueRaw) || paidBankValueRaw < 0) {
        Alert.alert('Gabim', 'Shuma në bankë nuk është valide.');
        return false;
      }

      if (paidBankValueRaw > totalAmount) {
        Alert.alert(
          'Gabim',
          'Shuma në bankë nuk mund të jetë më e madhe se totali.'
        );
        return false;
      }
    }

    return true;
  };

  const finishSuccess = () => {
    if (Platform.OS === 'web') {
      window.alert('Vizita u regjistrua me sukses.');
      router.replace('/(tabs)');
      return;
    }

    Alert.alert('Sukses ✅', 'Vizita u regjistrua me sukses.', [
      { text: 'OK', onPress: () => router.replace('/(tabs)') },
    ]);
  };

  const doSave = async () => {
    if (!user?.id) {
      Alert.alert('Gabim', 'Përdoruesi nuk u gjet.');
      return;
    }

    setSaving(true);

    const payload = {
      status: 'arrived',
      payment_method: paymentMethod,
      paid_cash: paidCashValue,
      paid_bank: paidBankValue,
      visit_notes: notes.trim() || null,
      selected_treatments: selectedTreatments.map((t) => ({
        id: t.id,
        name: t.name,
        price: t.price,
        qty: t.qty,
        total: t.total,
      })),
      total_amount: totalAmount,
    };

    const { error } = await supabase
      .from('appointments')
      .update(payload)
      .eq('id', appointmentId)
      .eq('archived', false);

    if (error) {
      Alert.alert('Gabim', error.message);
      setSaving(false);
      return;
    }

    let pointsUpdateError: string | null = null;

    if (clientUserId && freshPointsDelta !== 0) {
      const { data: clientProfile, error: profileLoadError } = await supabase
        .from('profiles')
        .select('points')
        .eq('id', clientUserId)
        .single();

      if (profileLoadError) {
        pointsUpdateError = profileLoadError.message;
      } else {
        const currentPoints = Number(clientProfile?.points ?? 0);
        const nextPoints = Math.max(0, currentPoints + freshPointsDelta);

        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({ points: nextPoints })
          .eq('id', clientUserId);

        if (profileUpdateError) {
          pointsUpdateError = profileUpdateError.message;
        }
      }
    }

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'VISIT_REGISTERED',
      target_id: appointmentId,
      metadata: {
        appointment: {
          client_name: clientName,
          service: serviceName,
        },
        after: payload,
        pricing_override: {
          base_total_amount: baseTotalAmount,
          applied_discount_percent: overridePercent,
          manual_total:
            manualTotalInput.trim() !== '' ? manualTotalValue : null,
        },
        fresh_points: {
          client_user_id: clientUserId,
          earned: freshPointsEarned,
          previous: previousFreshPoints,
          delta: freshPointsDelta,
          error: pointsUpdateError,
        },
      },
    });

    setSaving(false);
    if (pointsUpdateError) {
      Alert.alert(
        'Vizita u ruajt',
        `Vizita u regjistrua, por Fresh Points nuk u perditesuan: ${pointsUpdateError}`
      );
      return;
    }

    finishSuccess();
  };

  const handleSave = () => {
    if (!validate()) return;

    if (Platform.OS === 'web') {
      if (window.confirm('A jeni të sigurt që dëshironi ta ruani vizitën?')) {
        doSave();
      }
      return;
    }

    Alert.alert('Konfirmim', 'A jeni të sigurt që dëshironi ta ruani vizitën?', [
      { text: 'Jo', style: 'cancel' },
      { text: 'Po', onPress: doSave },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: Colors.text }]}>
          Regjistro Vizitën
        </Text>

        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: Colors.card,
              borderColor,
            },
          ]}
        >
          <Text style={[styles.clientName, { color: Colors.text }]}>
            {clientName || 'Klient'}
          </Text>

          {!!serviceName && (
            <Text style={[styles.infoText, { color: Colors.muted }]}>
              Shërbimi i rezervuar: {serviceName}
            </Text>
          )}

          <Text style={[styles.infoText, { color: Colors.muted }]}>
            Data: {formatDate(appointmentDate)}
          </Text>

          <Text style={[styles.infoText, { color: Colors.muted }]}>
            Ora: {formatTime(appointmentTime)}
          </Text>
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: Colors.card,
              borderColor,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>
            Zgjidh trajtimet e kryera
          </Text>

          {TREATMENTS.map((item, index) => {
            const qty = quantities[item.id] || 0;
            const isLast = index === TREATMENTS.length - 1;

            return (
              <View
                key={item.id}
                style={[
                  styles.treatmentRow,
                  {
                    borderBottomColor: borderColor,
                    borderBottomWidth: isLast ? 0 : 1,
                  },
                ]}
              >
                <View style={styles.treatmentLeft}>
                  <Text style={[styles.treatmentName, { color: Colors.text }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.treatmentPrice, { color: Colors.muted }]}>
                    {item.price}€
                  </Text>
                </View>

                <View style={styles.qtyControls}>
                  <Pressable
                    onPress={() => decrease(item.id)}
                    style={[
                      styles.qtyBtn,
                      {
                        backgroundColor: softBackground,
                        borderColor,
                      },
                    ]}
                  >
                    <Text style={[styles.qtyBtnText, { color: Colors.text }]}>
                      −
                    </Text>
                  </Pressable>

                  <Text style={[styles.qtyValue, { color: Colors.text }]}>
                    {qty}
                  </Text>

                  <Pressable
                    onPress={() => increase(item.id)}
                    style={[
                      styles.qtyBtn,
                      {
                        backgroundColor: Colors.primary,
                        borderColor: Colors.primary,
                      },
                    ]}
                  >
                    <Text style={[styles.qtyBtnText, { color: '#fff' }]}>+</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: Colors.card,
              borderColor,
            },
          ]}
        >
          <View style={styles.totalHeaderRow}>
            <Text style={[styles.sectionTitle, { color: Colors.text, marginBottom: 0 }]}>
              Totali për pagesë
            </Text>

            <Pressable
              onPress={() => setOverrideModalVisible(true)}
              style={[
                styles.editTotalBtn,
                {
                  backgroundColor: softBackground,
                  borderColor,
                },
              ]}
            >
              <Text style={[styles.editTotalBtnText, { color: Colors.text }]}>
                Ndrysho
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.totalAmount, { color: Colors.primary }]}>
            {totalAmount}€
          </Text>

          <Text style={[styles.pointsPreview, { color: Colors.text }]}>
            Fresh Points: +{freshPointsEarned}
          </Text>

          {!clientUserId && (
            <Text style={[styles.overrideText, { color: Colors.muted }]}>
              Ky termin nuk eshte i lidhur me user te klientit.
            </Text>
          )}

          {clientUserId && freshPointsDelta !== freshPointsEarned && (
            <Text style={[styles.overrideText, { color: Colors.muted }]}>
              Ndryshimi ne points: {freshPointsDelta >= 0 ? '+' : ''}
              {freshPointsDelta}
            </Text>
          )}

          {overridePercent !== null && manualTotalInput.trim() === '' && (
            <Text style={[styles.overrideText, { color: Colors.muted }]}>
              Zbritje e aplikuar: {overridePercent}%
            </Text>
          )}

          {manualTotalInput.trim() !== '' && (
            <Text style={[styles.overrideText, { color: Colors.muted }]}>
              Totali është vendosur manualisht
            </Text>
          )}

          {(overridePercent !== null || manualTotalInput.trim() !== '') && (
            <Pressable onPress={clearOverride} style={styles.clearOverrideBtn}>
              <Text style={[styles.clearOverrideText, { color: Colors.primary }]}>
                Hiqe ndryshimin
              </Text>
            </Pressable>
          )}

          {selectedTreatments.length > 0 && (
            <View style={styles.summaryList}>
              {selectedTreatments.map((item) => (
                <View key={item.id} style={styles.summaryRow}>
                  <Text style={[styles.summaryText, { color: Colors.text }]}>
                    {item.name} x{item.qty}
                  </Text>
                  <Text style={[styles.summaryText, { color: Colors.text }]}>
                    {item.total}€
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: Colors.card,
              borderColor,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>
            Mënyra e pagesës
          </Text>

          <View style={styles.paymentMethods}>
            {(['cash', 'bank', 'mixed'] as PaymentMethod[]).map((method) => {
              const active = paymentMethod === method;

              return (
                <Pressable
                  key={method}
                  onPress={() => setPaymentMethod(method)}
                  style={[
                    styles.methodBtn,
                    {
                      backgroundColor: active ? Colors.primary : softBackground,
                      borderColor: active ? Colors.primary : borderColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.methodText,
                      { color: active ? '#fff' : Colors.text },
                    ]}
                  >
                    {method === 'cash'
                      ? 'Cash'
                      : method === 'bank'
                      ? 'Bankë'
                      : 'Cash + Bankë'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {paymentMethod === 'mixed' && (
            <View style={styles.inputWrap}>
              <Text style={[styles.inputLabel, { color: Colors.text }]}>
                Shuma në bankë
              </Text>
              <TextInput
                value={paidBank}
                onChangeText={setPaidBank}
                keyboardType="numeric"
                placeholder="Shkruaj shumën në bankë"
                placeholderTextColor={Colors.muted}
                style={[
                  styles.input,
                  {
                    color: Colors.text,
                    borderColor,
                    backgroundColor: softBackground,
                  },
                ]}
              />
            </View>
          )}

          <View style={styles.paymentSummary}>
            <View style={styles.paymentSummaryRow}>
              <Text style={[styles.paymentLabel, { color: Colors.muted }]}>
                Cash
              </Text>
              <Text style={[styles.paymentValue, { color: Colors.text }]}>
                {paidCashValue}€
              </Text>
            </View>

            <View style={styles.paymentSummaryRow}>
              <Text style={[styles.paymentLabel, { color: Colors.muted }]}>
                Bankë
              </Text>
              <Text style={[styles.paymentValue, { color: Colors.text }]}>
                {paidBankValue}€
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: Colors.card,
              borderColor,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>
            Shënime
          </Text>

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Shkruaj shënime shtesë"
            placeholderTextColor={Colors.muted}
            multiline
            textAlignVertical="top"
            style={[
              styles.notesInput,
              {
                color: Colors.text,
                borderColor,
                backgroundColor: softBackground,
              },
            ]}
          />
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[
            styles.saveBtn,
            {
              backgroundColor: saving ? Colors.muted : Colors.primary,
            },
          ]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Duke ruajtur...' : 'Ruaj Vizitën'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={[
            styles.backBtn,
            {
              backgroundColor: Colors.card,
              borderColor,
            },
          ]}
        >
          <Text style={[styles.backBtnText, { color: Colors.text }]}>
            Kthehu prapa
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={overrideModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeOverrideModal}
      >
        <View style={[styles.modalOverlay, { backgroundColor: modalOverlay }]}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: Colors.card,
                borderColor,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: Colors.text }]}>
                Ndrysho totalin
              </Text>

              <Pressable onPress={closeOverrideModal} style={styles.closeBtn}>
                <Text style={[styles.closeBtnText, { color: Colors.text }]}>✕</Text>
              </Pressable>
            </View>

            <Text style={[styles.modalSubtitle, { color: Colors.muted }]}>
              Zgjidh zbritjen ose vendos shumën manualisht.
            </Text>

            <View style={styles.discountButtons}>
              <Pressable
                onPress={() => applyDiscount(10)}
                style={[
                  styles.discountBtn,
                  {
                    backgroundColor:
                      overridePercent === 10 && manualTotalInput.trim() === ''
                        ? Colors.primary
                        : softBackground,
                    borderColor:
                      overridePercent === 10 && manualTotalInput.trim() === ''
                        ? Colors.primary
                        : borderColor,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.discountBtnText,
                    {
                      color:
                        overridePercent === 10 && manualTotalInput.trim() === ''
                          ? '#fff'
                          : Colors.text,
                    },
                  ]}
                >
                  10%
                </Text>
              </Pressable>

              <Pressable
                onPress={() => applyDiscount(20)}
                style={[
                  styles.discountBtn,
                  {
                    backgroundColor:
                      overridePercent === 20 && manualTotalInput.trim() === ''
                        ? Colors.primary
                        : softBackground,
                    borderColor:
                      overridePercent === 20 && manualTotalInput.trim() === ''
                        ? Colors.primary
                        : borderColor,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.discountBtnText,
                    {
                      color:
                        overridePercent === 20 && manualTotalInput.trim() === ''
                          ? '#fff'
                          : Colors.text,
                    },
                  ]}
                >
                  20%
                </Text>
              </Pressable>
            </View>

            <View style={styles.inputWrap}>
              <Text style={[styles.inputLabel, { color: Colors.text }]}>
                Vendos shumën
              </Text>
              <TextInput
                value={manualTotalInput}
                onChangeText={(text) => {
                  setManualTotalInput(text);
                  if (text.trim() !== '') {
                    setOverridePercent(null);
                  }
                }}
                keyboardType="numeric"
                placeholder="Shkruaj totalin manualisht"
                placeholderTextColor={Colors.muted}
                style={[
                  styles.input,
                  {
                    color: Colors.text,
                    borderColor,
                    backgroundColor: softBackground,
                  },
                ]}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={clearOverride}
                style={[
                  styles.modalSecondaryBtn,
                  {
                    backgroundColor: softBackground,
                    borderColor,
                  },
                ]}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: Colors.text }]}>
                  Pastro
                </Text>
              </Pressable>

              <Pressable
                onPress={closeOverrideModal}
                style={[
                  styles.modalPrimaryBtn,
                  {
                    backgroundColor: Colors.primary,
                    borderColor: Colors.primary,
                  },
                ]}
              >
                <Text style={styles.modalPrimaryBtnText}>U krye</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 36,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  clientName: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 4,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 14,
  },
  treatmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  treatmentLeft: {
    flex: 1,
    paddingRight: 12,
  },
  treatmentName: {
    fontSize: 15,
    fontWeight: '700',
  },
  treatmentPrice: {
    fontSize: 13,
    marginTop: 4,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qtyBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 22,
  },
  qtyValue: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
  },
  totalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editTotalBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editTotalBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  totalAmount: {
    fontSize: 30,
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 8,
  },
  overrideText: {
    fontSize: 13,
    marginBottom: 8,
  },
  pointsPreview: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  clearOverrideBtn: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  clearOverrideText: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryList: {
    marginTop: 4,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  paymentMethods: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  methodBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  methodText: {
    fontSize: 14,
    fontWeight: '700',
  },
  inputWrap: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  paymentSummary: {
    gap: 10,
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  paymentValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 110,
    fontSize: 15,
  },
  saveBtn: {
    marginTop: 8,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  backBtn: {
    marginTop: 12,
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 8,
    marginBottom: 16,
  },
  discountButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  discountBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  discountBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalSecondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalPrimaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalPrimaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
