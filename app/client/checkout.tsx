import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { PremiumCard, useClientColors } from '../../components/ClientUI';
import { ShopHeader } from '../../components/ShopHeader';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { supabase } from '../../context/supabase';

type PaymentMethod = 'cash' | 'card';
type DeliveryCountry = 'kosova' | 'shqiperia' | 'maqedonia' | 'mali_i_zi';

const deliveryCountries: Array<{ value: DeliveryCountry; label: string }> = [
  { value: 'kosova', label: 'Kosova' },
  { value: 'shqiperia', label: 'Shqiperia' },
  { value: 'maqedonia', label: 'Maqedonia' },
  { value: 'mali_i_zi', label: 'Mali i zi' },
];

const citiesByCountry: Record<DeliveryCountry, string[]> = {
  kosova: [
    'Artanë',
    'Deçan',
    'Drenas',
    'Dragash',
    'Ferizaj',
    'Fushë Kosovë',
    'Gjakovë',
    'Gjilan',
    'Graçanicë',
    'Hani i Elezit',
    'Istog',
    'Junik',
    'Kaçanik',
    'Kamenicë',
    'Klinë',
    'Kllokot',
    'Leposaviq',
    'Lipjan',
    'Malishevë',
    'Mamushë',
    'Mitrovicë',
    'Mitrovicë e Veriut',
    'Obiliq',
    'Partesh',
    'Pejë',
    'Podujevë',
    'Prishtinë',
    'Prizren',
    'Rahovec',
    'Ranillug',
    'Skenderaj',
    'Shtime',
    'Shtërpcë',
    'Suharekë',
    'Viti',
    'Vushtrri',
    'Zubin Potok',
    'Zveçan',
  ],
  shqiperia: ['Tirane', 'Durres', 'Shkoder', 'Vlore', 'Elbasan', 'Fier', 'Korce', 'Berat', 'Lushnje', 'Kukes'],
  maqedonia: ['Shkup', 'Tetove', 'Gostivar', 'Kumanove', 'Struge', 'Oher', 'Diber', 'Kercove', 'Manastir'],
  mali_i_zi: ['Podgorice', 'Ulqin', 'Tivar', 'Budva', 'Herceg Novi', 'Rozhaje', 'Plave', 'Guci', 'Bijelo Polje'],
};

const getEffectiveProductPrice = (item: { price: number; is_on_sale?: boolean; sale_price?: number | null }) =>
  item.is_on_sale && item.sale_price != null ? item.sale_price : item.price;

async function postJsonWithTimeout(url: string, body: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

export default function ClientCheckoutScreen() {
  const Colors = useClientColors();
  const { user, profile } = useAuth();
  const { cart, subtotal, total, discount, promo, clearCart, refreshCart, refreshPromo } = useCart();
  const [loading, setLoading] = useState(false);
  const [openSelect, setOpenSelect] = useState<'country' | 'city' | null>(null);
  const [selectSearch, setSelectSearch] = useState('');
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone?.replace(/\D/g, '') || '383',
    country: 'kosova' as DeliveryCountry,
    city: '',
    street_address: '',
    instructions: '',
    payment_method: 'cash' as PaymentMethod,
  });

  const hasOutOfStockItems = cart.some((item) => item.is_out_of_stock);
  const selectOptions = (
    openSelect === 'country'
      ? deliveryCountries.map((country) => ({ label: country.label, value: country.value }))
      : citiesByCountry[form.country].map((city) => ({ label: city, value: city }))
  ).filter((option) => option.label.toLocaleLowerCase('sq').includes(selectSearch.trim().toLocaleLowerCase('sq')));

  const updateForm = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const placeOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Shporta është bosh', 'Shtoni produkte para porosisë.');
      return;
    }
    if (hasOutOfStockItems) {
      Alert.alert('Hiqni produktet që nuk janë në stok', 'Disa produkte nuk janë më në stok.');
      return;
    }

    const phoneDigits = form.phone.replace(/\D/g, '');
    if (!form.full_name.trim() || phoneDigits.length <= 3 || !form.city || !form.street_address.trim()) {
      Alert.alert('Mungojnë të dhëna', 'Plotësoni emrin, telefonin, qytetin dhe adresën.');
      return;
    }

    const selectedCountry = deliveryCountries.find((country) => country.value === form.country);
    const fullPhone = `+${phoneDigits}`;
    const fullAddress = [
      `Shteti: ${selectedCountry?.label || form.country}`,
      `Qyteti: ${form.city}`,
      `Adresa: ${form.street_address.trim()}`,
    ].join(', ');

    setLoading(true);

    let latestCart: Awaited<ReturnType<typeof refreshCart>>;
    let latestPromo: Awaited<ReturnType<typeof refreshPromo>>;
    try {
      [latestCart, latestPromo] = await Promise.all([refreshCart(), refreshPromo()]);
    } catch (refreshError) {
      setLoading(false);
      Alert.alert(
        'Porosia nuk u krye',
        refreshError instanceof Error ? refreshError.message : 'Gabim'
      );
      return;
    }

    if (latestCart.length === 0) {
      setLoading(false);
      Alert.alert('Shporta është bosh', 'Shtoni produkte para porosisë.');
      return;
    }
    if (latestCart.some((item) => item.is_out_of_stock)) {
      setLoading(false);
      Alert.alert('Hiqni produktet që nuk janë në stok', 'Disa produkte nuk janë më në stok.');
      return;
    }

    const latestSubtotal = latestCart.reduce(
      (sum, item) => sum + getEffectiveProductPrice(item) * item.quantity,
      0
    );
    const calculatedDiscount = latestPromo
      ? latestPromo.discount_type === 'percentage'
        ? (latestSubtotal * latestPromo.discount_value) / 100
        : latestPromo.discount_value
      : 0;
    const latestDiscount = Math.min(calculatedDiscount, latestSubtotal);
    const latestTotal = Math.max(latestSubtotal - latestDiscount, 0);
    const items = latestCart.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: getEffectiveProductPrice(item),
    }));

    const { data, error } = await supabase.rpc('place_order_with_inventory', {
      order_payload: {
        user_id: user?.id || null,
        full_name: form.full_name.trim(),
        phone: fullPhone,
        address: fullAddress,
        instructions: form.instructions.trim(),
        payment_method: form.payment_method,
        subtotal: latestSubtotal,
        discount: latestDiscount,
        total: latestTotal,
        promo_code: latestPromo?.code || null,
      },
      order_items: items,
    });

    if (error) {
      setLoading(false);
      Alert.alert('Porosia nuk u krye', error.message);
      return;
    }

    const orderId = String(data || '');
    // The inventory transaction already committed. Clear immediately so a
    // slow optional email request cannot leave a cart that can be resubmitted.
    clearCart();
    const clientEmail = user?.email || profile?.email || '';
    const adminMessage = [
      `Kodi i porosisë: ${orderId}`,
      `Klienti: ${form.full_name.trim()}`,
      `Telefoni: ${fullPhone}`,
      `Adresa: ${fullAddress}`,
      form.instructions.trim() ? `Udhëzime: ${form.instructions.trim()}` : '',
      '',
      ...items.map((item) => `${item.name} x ${item.quantity} — ${(item.price * item.quantity).toFixed(2)} €`),
      '',
      `Nëntotali: ${latestSubtotal.toFixed(2)} €`,
      latestDiscount > 0 ? `Zbritja: -${latestDiscount.toFixed(2)} €` : '',
      `Totali: ${latestTotal.toFixed(2)} €`,
      'Pagesa: Para në dorë',
    ].filter(Boolean).join('\n');

    const [clientEmailResult, adminEmailResult] = await Promise.allSettled([
      postJsonWithTimeout(
        'https://www.freshlook-ks.com/api/send-order-confirmation',
        {
          email: clientEmail,
          orderId,
          fullName: form.full_name.trim(),
          phone: fullPhone,
          address: fullAddress,
          paymentMethod: 'Para në dorëzim',
          total: latestTotal,
          items,
        }
      ),
      postJsonWithTimeout(
        'https://www.freshlook-ks.com/api/contact',
        {
          name: `Porosi nga aplikacioni — ${form.full_name.trim()}`,
          phone: fullPhone,
          message: adminMessage,
        }
      ),
    ]);

    const clientEmailSent = clientEmailResult.status === 'fulfilled';
    const adminEmailSent = adminEmailResult.status === 'fulfilled';

    router.replace({
      pathname: '/client/order-success',
      params: {
        orderId,
        total: latestTotal.toFixed(2),
        emailStatus: clientEmailSent && adminEmailSent ? 'sent' : clientEmailSent || adminEmailSent ? 'partial' : 'failed',
      },
    });
  };

  return (
    <ScrollView style={{ backgroundColor: Colors.background }} contentContainerStyle={styles.content}>
      <ShopHeader title="Porosia" />

      {hasOutOfStockItems && (
        <View style={[styles.warning, { borderColor: Colors.danger }]}>
          <Text style={[styles.warningText, { color: Colors.danger }]}>
            Disa produkte nuk janë në stok. Kthehuni te shporta dhe hiqini para porosisë.
          </Text>
        </View>
      )}

      <PremiumCard style={styles.card}>
        <Text style={[styles.sectionTitle, { color: Colors.text }]}>Të dhënat e dorëzimit</Text>
        <Text style={[styles.fieldLabel, { color: Colors.text }]}>Emri dhe Mbiemri</Text>
        <TextInput
          value={form.full_name}
          onChangeText={(value) => updateForm('full_name', value)}
          placeholder="Shkruani emrin dhe mbiemrin"
          placeholderTextColor={Colors.muted}
          style={[styles.input, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        />
        <Text style={[styles.fieldLabel, { color: Colors.text }]}>Nr. Tel</Text>
        <TextInput
          value={form.phone}
          onChangeText={(value) => updateForm('phone', value.replace(/\D/g, ''))}
          placeholder="Numri i telefonit"
          placeholderTextColor={Colors.muted}
          keyboardType="phone-pad"
          style={[styles.input, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        />

        <Text style={[styles.fieldLabel, { color: Colors.text }]}>Shteti</Text>
        <Pressable
          onPress={() => {
            setSelectSearch('');
            setOpenSelect('country');
          }}
          style={[styles.selectField, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
        >
          <Text style={[styles.selectText, { color: Colors.text }]}>
            {deliveryCountries.find((country) => country.value === form.country)?.label}
          </Text>
          <Ionicons name="chevron-down" size={19} color={Colors.primary} />
        </Pressable>

        <Text style={[styles.fieldLabel, { color: Colors.text }]}>Qyteti</Text>
        <Pressable
          onPress={() => {
            setSelectSearch('');
            setOpenSelect('city');
          }}
          style={[styles.selectField, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
        >
          <Text style={[styles.selectText, { color: form.city ? Colors.text : Colors.muted }]}>
            {form.city || 'Zgjidhni qytetin'}
          </Text>
          <Ionicons name="chevron-down" size={19} color={Colors.primary} />
        </Pressable>

        <Text style={[styles.fieldLabel, { color: Colors.text }]}>Rruga</Text>
        <TextInput
          value={form.street_address}
          onChangeText={(value) => updateForm('street_address', value)}
          placeholder="Shkruani rrugën dhe numrin"
          placeholderTextColor={Colors.muted}
          style={[styles.input, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        />
        <Text style={[styles.fieldLabel, { color: Colors.text }]}>Udhëzime shtesë</Text>
        <TextInput
          value={form.instructions}
          onChangeText={(value) => updateForm('instructions', value)}
          placeholder="Shkruani udhëzime për dorëzimin (opsionale)"
          placeholderTextColor={Colors.muted}
          multiline
          style={[styles.input, styles.textArea, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        />

        <Text style={[styles.label, { color: Colors.muted }]}>Pagesa</Text>
        <View style={styles.chipWrap}>
          <Pressable
            onPress={() => updateForm('payment_method', 'cash')}
            style={[
              styles.chip,
              {
                backgroundColor: form.payment_method === 'cash' ? Colors.primary : Colors.surface,
                borderColor: form.payment_method === 'cash' ? Colors.primary : Colors.border,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: form.payment_method === 'cash' ? '#fff' : Colors.text }]}>
              Para në dorë
            </Text>
          </Pressable>
          <View style={[styles.chip, { backgroundColor: Colors.surface, borderColor: Colors.border, opacity: 0.55 }]}>
            <Text style={[styles.chipText, { color: Colors.muted }]}>Kartelë së shpejti</Text>
          </View>
        </View>
      </PremiumCard>

      <PremiumCard style={styles.card}>
        <Text style={[styles.sectionTitle, { color: Colors.text }]}>Përmbledhja e porosisë</Text>
        {cart.map((item) => {
          const price = getEffectiveProductPrice(item);
          return (
            <View key={item.id} style={styles.summaryLine}>
              <Text style={[styles.summaryItem, { color: Colors.text }]}>{item.name} x {item.quantity}</Text>
              <Text style={[styles.summaryValue, { color: Colors.text }]}>{(item.quantity * price).toFixed(2)}€</Text>
            </View>
          );
        })}
        <View style={[styles.divider, { backgroundColor: Colors.border }]} />
        <SummaryRow label="Nëntotali" value={`${subtotal.toFixed(2)}€`} />
        {promo && <SummaryRow label={`Zbritja (${promo.code})`} value={`-${discount.toFixed(2)}€`} positive />}
        <SummaryRow label="Totali" value={`${total.toFixed(2)}€`} bold />
        <SummaryRow label="Fresh Points pas dorëzimit" value={`+${Math.floor(total)} pikë`} positive />

        <Pressable
          onPress={placeOrder}
          disabled={loading || cart.length === 0 || hasOutOfStockItems}
          style={[
            styles.placeButton,
            {
              backgroundColor: loading || cart.length === 0 || hasOutOfStockItems ? Colors.border : Colors.primary,
            },
          ]}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.placeText}>Kryej porosinë</Text>}
        </Pressable>
      </PremiumCard>

      <Modal visible={openSelect !== null} transparent animationType="fade" onRequestClose={() => setOpenSelect(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpenSelect(null)}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.selectModal, { backgroundColor: Colors.card, borderColor: Colors.border }]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalEyebrow, { color: Colors.primary }]}>ZGJIDHNI</Text>
                <Text style={[styles.modalTitle, { color: Colors.text }]}>
                  {openSelect === 'country' ? 'Shtetin' : 'Qytetin'}
                </Text>
              </View>
              <Pressable onPress={() => setOpenSelect(null)} style={[styles.modalClose, { backgroundColor: Colors.surface }]}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </Pressable>
            </View>

            <View style={[styles.searchWrap, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <Ionicons name="search-outline" size={19} color={Colors.muted} />
              <TextInput
                value={selectSearch}
                onChangeText={setSelectSearch}
                placeholder={openSelect === 'country' ? 'Kërko shtetin' : 'Kërko qytetin'}
                placeholderTextColor={Colors.muted}
                autoCorrect={false}
                style={[styles.searchInput, { color: Colors.text }]}
              />
              {!!selectSearch && (
                <Pressable onPress={() => setSelectSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={19} color={Colors.muted} />
                </Pressable>
              )}
            </View>

            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {selectOptions.map((option) => {
                  const selected = openSelect === 'country' ? form.country === option.value : form.city === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        if (openSelect === 'country') {
                          updateForm('country', option.value as DeliveryCountry);
                          updateForm('city', '');
                        } else {
                          updateForm('city', option.value);
                        }
                        setOpenSelect(null);
                      }}
                      style={[
                        styles.optionRow,
                        {
                          backgroundColor: selected ? Colors.primarySoft : Colors.surface,
                          borderColor: selected ? Colors.primary : Colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.optionText, { color: selected ? Colors.primary : Colors.text }]}>{option.label}</Text>
                      {selected && <Ionicons name="checkmark-circle" size={21} color={Colors.primary} />}
                    </Pressable>
                  );
                })}
              {selectOptions.length === 0 && (
                <Text style={[styles.noResults, { color: Colors.muted }]}>Nuk u gjet asnjë rezultat.</Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function SummaryRow({ label, value, bold = false, positive = false }: { label: string; value: string; bold?: boolean; positive?: boolean }) {
  const Colors = useClientColors();
  return (
    <View style={styles.summaryLine}>
      <Text style={[bold ? styles.totalLabel : styles.summaryItem, { color: Colors.text }]}>{label}</Text>
      <Text style={[bold ? styles.totalValue : styles.summaryValue, { color: positive ? '#2EAD66' : bold ? Colors.primary : Colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 140 },
  warning: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 14 },
  warningText: { fontSize: 13, fontWeight: '700' },
  card: { gap: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '900', marginBottom: 2 },
  fieldLabel: { fontSize: 13, fontWeight: '800', marginBottom: -5 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 15 },
  selectField: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { flex: 1, fontSize: 15 },
  textArea: { minHeight: 86, paddingTop: 13, textAlignVertical: 'top' },
  label: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginTop: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 42, borderWidth: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  cityChip: { minHeight: 38, borderWidth: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  chipText: { fontSize: 12, fontWeight: '900' },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryItem: { flex: 1, fontSize: 13 },
  summaryValue: { fontSize: 13, fontWeight: '800' },
  totalLabel: { flex: 1, fontSize: 16, fontWeight: '900' },
  totalValue: { fontSize: 18, fontWeight: '900' },
  divider: { height: 1, marginVertical: 4 },
  placeButton: { minHeight: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  placeText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,10,0.6)', justifyContent: 'center', padding: 20 },
  selectModal: { width: '100%', maxWidth: 480, maxHeight: '76%', alignSelf: 'center', borderWidth: 1, borderRadius: 24, padding: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  modalEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  modalTitle: { marginTop: 3, fontSize: 23, fontWeight: '900' },
  modalClose: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 10 },
  optionsScroll: { flexGrow: 0 },
  optionRow: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, marginBottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { fontSize: 14, fontWeight: '800' },
  noResults: { paddingVertical: 24, textAlign: 'center', fontSize: 14, fontWeight: '700' },
});
