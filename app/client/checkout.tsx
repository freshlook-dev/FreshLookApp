import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

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
  kosova: ['Prishtine', 'Fushe Kosove', 'Prizren', 'Peje', 'Gjakove', 'Gjilan', 'Ferizaj', 'Mitrovice', 'Podujeve', 'Vushtrri', 'Suhareke', 'Rahovec'],
  shqiperia: ['Tirane', 'Durres', 'Shkoder', 'Vlore', 'Elbasan', 'Fier', 'Korce', 'Berat', 'Lushnje', 'Kukes'],
  maqedonia: ['Shkup', 'Tetove', 'Gostivar', 'Kumanove', 'Struge', 'Oher', 'Diber', 'Kercove', 'Manastir'],
  mali_i_zi: ['Podgorice', 'Ulqin', 'Tivar', 'Budva', 'Herceg Novi', 'Rozhaje', 'Plave', 'Guci', 'Bijelo Polje'],
};

export default function ClientCheckoutScreen() {
  const Colors = useClientColors();
  const { user, profile } = useAuth();
  const { cart, subtotal, total, discount, promo, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
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

  const updateForm = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const placeOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Shporta është bosh', 'Shtoni produkte para porosisë.');
      return;
    }
    if (hasOutOfStockItems) {
      Alert.alert('Hiqni produktet pa stok', 'Disa produkte nuk janë më në stok.');
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

    const items = cart.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.is_on_sale && item.sale_price ? item.sale_price : item.price,
    }));

    setLoading(true);
    const { data, error } = await supabase.rpc('place_order_with_inventory', {
      order_payload: {
        user_id: user?.id || null,
        full_name: form.full_name.trim(),
        phone: fullPhone,
        address: fullAddress,
        instructions: form.instructions.trim(),
        payment_method: form.payment_method,
        subtotal,
        discount,
        total,
        promo_code: promo?.code || null,
      },
      order_items: items,
    });
    setLoading(false);

    if (error) {
      Alert.alert('Porosia nuk u krye', error.message);
      return;
    }

    clearCart();
    router.replace({
      pathname: '/client/order-success',
      params: { orderId: String(data || ''), total: total.toFixed(2) },
    });
  };

  return (
    <ScrollView style={{ backgroundColor: Colors.background }} contentContainerStyle={styles.content}>
      <ShopHeader title="Porosia" />

      {hasOutOfStockItems && (
        <View style={[styles.warning, { borderColor: Colors.danger }]}>
          <Text style={[styles.warningText, { color: Colors.danger }]}>
            Disa produkte janë pa stok. Kthehuni te shporta dhe hiqini para porosisë.
          </Text>
        </View>
      )}

      <PremiumCard style={styles.card}>
        <Text style={[styles.sectionTitle, { color: Colors.text }]}>Të dhënat e dorëzimit</Text>
        <TextInput
          value={form.full_name}
          onChangeText={(value) => updateForm('full_name', value)}
          placeholder="Emri dhe mbiemri"
          placeholderTextColor={Colors.muted}
          style={[styles.input, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        />
        <TextInput
          value={form.phone}
          onChangeText={(value) => updateForm('phone', value.replace(/\D/g, ''))}
          placeholder="Telefoni"
          placeholderTextColor={Colors.muted}
          keyboardType="phone-pad"
          style={[styles.input, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        />

        <Text style={[styles.label, { color: Colors.muted }]}>Shteti</Text>
        <View style={styles.chipWrap}>
          {deliveryCountries.map((country) => (
            <Pressable
              key={country.value}
              onPress={() => {
                updateForm('country', country.value);
                updateForm('city', '');
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: form.country === country.value ? Colors.primary : Colors.surface,
                  borderColor: form.country === country.value ? Colors.primary : Colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: form.country === country.value ? '#fff' : Colors.text }]}>
                {country.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: Colors.muted }]}>Qyteti</Text>
        <View style={styles.chipWrap}>
          {citiesByCountry[form.country].map((city) => (
            <Pressable
              key={city}
              onPress={() => updateForm('city', city)}
              style={[
                styles.cityChip,
                {
                  backgroundColor: form.city === city ? Colors.primary : Colors.surface,
                  borderColor: form.city === city ? Colors.primary : Colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: form.city === city ? '#fff' : Colors.text }]}>{city}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={form.street_address}
          onChangeText={(value) => updateForm('street_address', value)}
          placeholder="Adresa"
          placeholderTextColor={Colors.muted}
          style={[styles.input, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        />
        <TextInput
          value={form.instructions}
          onChangeText={(value) => updateForm('instructions', value)}
          placeholder="Udhëzime shtesë"
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
          const price = item.is_on_sale && item.sale_price ? item.sale_price : item.price;
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
  input: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 15 },
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
});
