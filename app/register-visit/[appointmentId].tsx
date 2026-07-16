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
import { Href, useLocalSearchParams, router } from 'expo-router';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';
import { notifyStaffAppointmentChange } from '../../utils/appointmentStaffNotifications';
import { formatDate } from '../../utils/format';
import { getOrderedCatalogIds } from '../../utils/catalog';

type PaymentMethod = 'cash' | 'bank' | 'mixed';

type Treatment = {
  id: string;
  name: string;
  price: number;
  duration?: number;
  isActiveCatalog?: boolean;
};

type ServiceRow = Treatment & {
  is_on_sale: boolean | null;
  sale_price: number | null;
};

type RouteParams = {
  appointmentId: string;
  returnTo?: string;
};

const SAFE_RETURN_ROUTES = new Set([
  '/(tabs)/upcoming',
  '/(tabs)/history',
  '/owner-stats',
]);

const safeReturnRoute = (value: unknown, fallback: Href): Href =>
  typeof value === 'string' && SAFE_RETURN_ROUTES.has(value)
    ? (value as Href)
    : fallback;

const orderTreatments = (items: Treatment[], orderedIds: string[]) => {
  const positions = new Map(orderedIds.map((id, index) => [id, index]));
  return [...items].sort((a, b) =>
    (positions.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
    (positions.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  );
};

const normalizeTreatmentName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const findTreatmentsByService = (treatments: Treatment[], service: string) => {
  const normalizedService = normalizeTreatmentName(service);
  if (!normalizedService) return [];

  const exactMatch = treatments.find(
    (treatment) => normalizeTreatmentName(treatment.name) === normalizedService
  );
  if (exactMatch) return [exactMatch];

  const treatmentsByName = new Map(
    treatments.map((treatment) => [normalizeTreatmentName(treatment.name), treatment])
  );
  const namedMatches = service
    .split(',')
    .map(normalizeTreatmentName)
    .map((name) => treatmentsByName.get(name))
    .filter((treatment): treatment is Treatment => treatment != null);

  if (namedMatches.length > 0) {
    return [...new Map(namedMatches.map((treatment) => [treatment.id, treatment])).values()];
  }

  const legacyMatch = treatments.find((treatment) => {
    const normalizedTreatment = normalizeTreatmentName(treatment.name);
    return (
      normalizedTreatment === normalizedService ||
      normalizedTreatment.includes(normalizedService) ||
      normalizedService.includes(normalizedTreatment)
    );
  });

  return legacyMatch ? [legacyMatch] : [];
};

const parseAmountInput = (value: string) => Number(value.replace(',', '.'));

const toOptionalFiniteNumber = (value: unknown) => {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toQuantityMap = (selectedTreatments: any) => {
  if (!Array.isArray(selectedTreatments)) return {};

  return selectedTreatments.reduce<Record<string, number>>((acc, treatment) => {
    const id = String(treatment?.id ?? '');
    const qty = treatment?.qty == null ? 1 : Number(treatment.qty);

    if (id && Number.isFinite(qty) && qty > 0) {
      acc[id] = qty;
    }

    return acc;
  }, {});
};

export default function RegisterVisitScreen() {
  const { appointmentId, returnTo } = useLocalSearchParams<RouteParams>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.10)' : '#E5E7EB';
  const softBackground = theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#F8FAFC';
  const modalOverlay = 'rgba(0,0,0,0.45)';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [treatments, setTreatments] = useState<Treatment[]>([]);

  const [clientName, setClientName] = useState('');
  const [clientUserId, setClientUserId] = useState<string | null>(null);
  const [previousTotalAmount, setPreviousTotalAmount] = useState<number | null>(
    null
  );
  const [reEditingVisit, setReEditingVisit] = useState(false);
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

    const [{ data, error }, { data: serviceRows, error: servicesError }, { data: orderData }] = await Promise.all([
      supabase
        .from('appointments')
        .select(
          'client_name, service, appointment_date, appointment_time, visit_notes, user_id, total_amount, payment_method, paid_bank, selected_treatments'
        )
        .eq('id', appointmentId)
        .single(),
      supabase
        .from('services')
        .select('id, name, price, duration, is_on_sale, sale_price')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }),
      supabase.from('content').select('value').eq('key', 'service_order').maybeSingle(),
    ]);

    if (error) {
      Alert.alert('Gabim', error.message);
      setLoading(false);
      return;
    }

    if (servicesError) {
      Alert.alert('Shërbimet nuk u ngarkuan', servicesError.message);
      setLoading(false);
      return;
    }

    const activeTreatments = ((serviceRows as ServiceRow[] | null) ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      price: item.is_on_sale && item.sale_price != null ? Number(item.sale_price) : Number(item.price),
      duration: toOptionalFiniteNumber(item.duration),
      isActiveCatalog: true,
    }));
    const savedItems: Treatment[] = Array.isArray(data?.selected_treatments)
      ? data.selected_treatments
          .filter((item: any) => item?.id && item?.name && Number.isFinite(Number(item?.price)))
          .map((item: any) => ({
            id: String(item.id),
            name: String(item.name),
            price: Number(item.price),
            duration: toOptionalFiniteNumber(item.duration),
            isActiveCatalog: false,
          }))
      : [];
    const isReEditingVisit = ['cash', 'bank', 'mixed'].includes(data?.payment_method);
    const savedItemsById = new Map(savedItems.map((item) => [item.id, item]));
    const pricedActiveTreatments = isReEditingVisit
      ? activeTreatments.map((item) => {
          const savedItem = savedItemsById.get(item.id);
          return savedItem
            ? {
                ...savedItem,
                duration: savedItem.duration ?? item.duration,
                isActiveCatalog: true,
              }
            : item;
        })
      : activeTreatments;
    const activeIds = new Set(pricedActiveTreatments.map((item) => item.id));
    const availableTreatments = orderTreatments(
      [...pricedActiveTreatments, ...savedItems.filter((item) => !activeIds.has(item.id))],
      getOrderedCatalogIds(orderData?.value)
    );
    setTreatments(availableTreatments);

    setClientName(data?.client_name ?? '');
    setClientUserId(data?.user_id ?? null);
    const savedTotal = Number(data?.total_amount);
    const hasSavedTotal = data?.total_amount != null && Number.isFinite(savedTotal);
    setPreviousTotalAmount(
      isReEditingVisit && hasSavedTotal ? savedTotal : null
    );
    setReEditingVisit(isReEditingVisit);
    const loadedServiceName = data?.service ?? '';
    setServiceName(loadedServiceName);
    setAppointmentDate(data?.appointment_date ?? '');
    setAppointmentTime(data?.appointment_time ?? '');
    setNotes(data?.visit_notes ?? '');
    const savedQuantities = toQuantityMap(data?.selected_treatments);
    const bookedTreatments = findTreatmentsByService(availableTreatments, loadedServiceName);
    const initialQuantities = Object.keys(savedQuantities).length > 0
      ? savedQuantities
      : Object.fromEntries(bookedTreatments.map((treatment) => [treatment.id, 1]));
    setQuantities(initialQuantities);

    setOverridePercent(null);
    setManualTotalInput('');
    if (isReEditingVisit && hasSavedTotal) {
      const savedBaseTotal = availableTreatments.reduce(
        (sum, treatment) => sum + treatment.price * (initialQuantities[treatment.id] ?? 0),
        0
      );
      const tenPercentTotal = Number((savedBaseTotal * 0.9).toFixed(2));
      const twentyPercentTotal = Number((savedBaseTotal * 0.8).toFixed(2));

      if (Math.abs(savedTotal - tenPercentTotal) < 0.01) {
        setOverridePercent(10);
      } else if (Math.abs(savedTotal - twentyPercentTotal) < 0.01) {
        setOverridePercent(20);
      } else if (Math.abs(savedTotal - savedBaseTotal) >= 0.01) {
        setManualTotalInput(String(savedTotal));
      }
    }

    if (['cash', 'bank', 'mixed'].includes(data?.payment_method)) {
      setPaymentMethod(data.payment_method as PaymentMethod);
    }

    if (data?.payment_method === 'mixed') {
      const savedPaidBank = Number(data?.paid_bank);
      setPaidBank(Number.isFinite(savedPaidBank) ? String(savedPaidBank) : '');
    } else {
      setPaidBank('');
    }

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
    return treatments.filter((item) => (quantities[item.id] || 0) > 0).map(
      (item) => {
        const qty = quantities[item.id] || 0;
        const total = qty * item.price;

        return {
          id: item.id,
          name: item.name,
          price: item.price,
          duration: item.duration,
          isActiveCatalog: item.isActiveCatalog === true,
          qty,
          total,
        };
      }
    );
  }, [quantities, treatments]);

  const baseTotalAmount = useMemo(() => {
    return selectedTreatments.reduce((sum, item) => sum + item.total, 0);
  }, [selectedTreatments]);

  const manualTotalValue = parseAmountInput(manualTotalInput);
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

  const paidBankValueRaw = parseAmountInput(paidBank);
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
    const nextRoute = safeReturnRoute(returnTo, '/(tabs)/history');

    if (Platform.OS === 'web') {
      window.alert('Vizita u regjistrua me sukses.');
      router.replace(nextRoute);
      return;
    }

    Alert.alert('Sukses ✅', 'Vizita u regjistrua me sukses.', [
      { text: 'OK', onPress: () => router.replace(nextRoute) },
    ]);
  };

  const doSave = async () => {
    if (!user?.id) {
      Alert.alert('Gabim', 'Përdoruesi nuk u gjet.');
      return;
    }

    setSaving(true);

    if (!reEditingVisit) {
      if (selectedTreatments.some((treatment) => !treatment.isActiveCatalog)) {
        setSaving(false);
        Alert.alert(
          'Trajtimi nuk është më aktiv',
          'Hiqeni trajtimin joaktiv dhe zgjidhni një trajtim nga katalogu aktual para regjistrimit.'
        );
        return;
      }

      const activeSelectionIds = selectedTreatments
        .filter((treatment) => treatment.isActiveCatalog)
        .map((treatment) => treatment.id);

      if (activeSelectionIds.length > 0) {
        const { data: currentRows, error: catalogError } = await supabase
          .from('services')
          .select('id, name, price, duration, is_active, is_on_sale, sale_price')
          .in('id', activeSelectionIds);

        if (catalogError) {
          Alert.alert('Shërbimet nuk u verifikuan', catalogError.message);
          setSaving(false);
          return;
        }

        const currentById = new Map(
          ((currentRows as (ServiceRow & { is_active: boolean | null })[] | null) ?? [])
            .map((row) => [row.id, row])
        );
        const catalogChanged = selectedTreatments
          .filter((treatment) => treatment.isActiveCatalog)
          .some((treatment) => {
            const current = currentById.get(treatment.id);
            if (!current || current.is_active !== true || current.name !== treatment.name) {
              return true;
            }

            const currentPrice = current.is_on_sale && current.sale_price != null
              ? Number(current.sale_price)
              : Number(current.price);
            return !Number.isFinite(currentPrice) ||
              Math.abs(currentPrice - treatment.price) >= 0.01 ||
              toOptionalFiniteNumber(current.duration) !== treatment.duration;
          });

        if (catalogChanged) {
          await loadAppointment();
          setSaving(false);
          Alert.alert(
            'Trajtimet u përditësuan',
            'Çmimi ose disponueshmëria ndryshoi. Kontrolloni totalin dhe ruajeni përsëri.'
          );
          return;
        }
      }
    }

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
        duration: t.duration,
        qty: t.qty,
        total: t.total,
      })),
      total_amount: totalAmount,
    };

    const { data: visitResult, error } = await supabase.rpc('register_visit_atomic', {
      p_appointment_id: appointmentId,
      p_payment_method: payload.payment_method,
      p_paid_cash: payload.paid_cash,
      p_paid_bank: payload.paid_bank,
      p_visit_notes: notes.trim(),
      p_selected_treatments: payload.selected_treatments,
      p_total_amount: payload.total_amount,
    });

    if (error || !visitResult) {
      Alert.alert(
        'Gabim',
        error?.message ?? 'Termini nuk u perditesua. Mund te jete arkivuar ose ndryshuar.'
      );
      setSaving(false);
      return;
    }

    const result = visitResult as {
      client_user_id?: string | null;
      points_delta?: number | null;
      new_points?: number | null;
    };
    const updatedClientUserId = result.client_user_id ?? clientUserId;
    const actualPointsDelta = Number(result.points_delta ?? 0);
    const newPointsBalance = Number(result.new_points ?? 0);

    if (updatedClientUserId && actualPointsDelta > 0 && Number.isFinite(newPointsBalance)) {
      void supabase.functions
        .invoke('send-push-notification', {
            body: {
              mode: 'points_earned',
              recipient_id: updatedClientUserId,
              points_added: actualPointsDelta,
              new_balance: newPointsBalance,
            },
          })
        .then((notificationResult: { error: { message: string } | null }) => {
          if (notificationResult.error) {
            console.warn('Fresh Points notification failed', notificationResult.error.message);
          }
        });
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
          client_user_id: updatedClientUserId,
          earned: freshPointsEarned,
          previous: previousFreshPoints,
          delta: actualPointsDelta,
          error: null,
        },
      },
    });

    void notifyStaffAppointmentChange('status_changed', {
      id: appointmentId,
      client_name: clientName,
      service: serviceName,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      status: 'arrived',
    });

    setSaving(false);
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

          {treatments.map((item, index) => {
            const qty = quantities[item.id] || 0;
            const isLast = index === treatments.length - 1;

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
          onPress={() =>
            router.replace(safeReturnRoute(returnTo, '/(tabs)/upcoming'))
          }
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
