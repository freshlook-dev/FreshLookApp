import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';

import { EmptyState, PremiumCard, useClientColors } from '../../components/ClientUI';
import { ShopHeader } from '../../components/ShopHeader';
import { useCart } from '../../context/CartContext';
import { supabase } from '../../context/supabase';
import { getCatalogImageUrl } from '../../utils/imageUrl';

type PromoCodeRecord = {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  expires_at: string | null;
};

export default function ClientCartScreen() {
  const Colors = useClientColors();
  const {
    cart,
    removeFromCart,
    increaseQty,
    decreaseQty,
    clearCart,
    promo,
    applyPromo,
    removePromo,
    subtotal,
    discount,
    total,
  } = useCart();
  const [promoCode, setPromoCode] = useState('');
  const [promoMessage, setPromoMessage] = useState('');
  const hasOutOfStockItems = cart.some((item) => item.is_out_of_stock);

  const handleApplyPromo = async () => {
    setPromoMessage('');
    if (!promoCode.trim()) return;

    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', promoCode.trim().toUpperCase())
      .eq('is_active', true)
      .single();

    const promoRecord = data as PromoCodeRecord | null;

    if (error || !promoRecord) {
      setPromoMessage('Kodi nuk është i vlefshëm.');
      return;
    }

    const expiryTimestamp = promoRecord.expires_at == null
      ? null
      : Date.parse(promoRecord.expires_at);
    const invalidDiscount =
      (promoRecord.discount_type !== 'percentage' && promoRecord.discount_type !== 'fixed') ||
      !Number.isFinite(promoRecord.discount_value) ||
      promoRecord.discount_value < 0 ||
      (promoRecord.discount_type === 'percentage' && promoRecord.discount_value > 100);

    if (invalidDiscount) {
      setPromoMessage('Kodi nuk është i vlefshëm.');
      return;
    }

    if (expiryTimestamp != null && (!Number.isFinite(expiryTimestamp) || expiryTimestamp <= Date.now())) {
      setPromoMessage('Kodi ka skaduar.');
      return;
    }

    applyPromo({
      code: promoRecord.code,
      discount_type: promoRecord.discount_type,
      discount_value: promoRecord.discount_value,
    });
    setPromoMessage('Kodi u aplikua.');
  };

  const goToCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Shporta është bosh', 'Shtoni një produkt për të vazhduar.');
      return;
    }
    if (hasOutOfStockItems) {
      Alert.alert('Hiqni produktet që nuk janë në stok', 'Disa produkte nuk janë më në stok.');
      return;
    }
    router.push('/client/checkout');
  };

  return (
    <ScrollView style={{ backgroundColor: Colors.background }} contentContainerStyle={styles.content}>
      <ShopHeader title="Shporta" />

      {cart.length === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="Shporta është bosh"
          message="Produktet që shtoni do të shfaqen këtu."
        />
      ) : (
        <>
          {hasOutOfStockItems && (
            <View style={[styles.warning, { borderColor: Colors.danger }]}>
              <Text style={[styles.warningText, { color: Colors.danger }]}>
                Disa produkte nuk janë më në stok. Hiqini para porosisë.
              </Text>
            </View>
          )}

          <View style={styles.items}>
            {cart.map((item) => {
              const price = item.is_on_sale && item.sale_price != null ? item.sale_price : item.price;
              const hasReachedStockLimit =
                !item.is_out_of_stock &&
                typeof item.stock_quantity === 'number' &&
                item.quantity >= item.stock_quantity;

              return (
                <View key={item.id} style={[styles.itemCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
                  <View style={[styles.imageWrap, { backgroundColor: Colors.surface }]}>
                    {item.image ? (
                      <CartProductImage url={item.image} fallbackColor={Colors.muted} />
                    ) : (
                      <Ionicons name="image-outline" size={26} color={Colors.muted} />
                    )}
                  </View>
                  <View style={styles.itemCopy}>
                    <Text style={[styles.itemName, { color: Colors.text }]} numberOfLines={2}>{item.name}</Text>
                    <Text style={[styles.itemPrice, { color: Colors.muted }]}>
                      {price.toFixed(2)}€ x {item.quantity}
                    </Text>
                    {item.is_out_of_stock && (
                      <Text style={[styles.outOfStock, { color: Colors.danger }]}>Nuk ka në stok</Text>
                    )}
                    <View style={styles.qtyRow}>
                      <Pressable style={[styles.qtyBtn, { borderColor: Colors.border }]} onPress={() => decreaseQty(item.id)}>
                        <Text style={[styles.qtyText, { color: Colors.text }]}>-</Text>
                      </Pressable>
                      <Text style={[styles.quantity, { color: Colors.text }]}>{item.quantity}</Text>
                      <Pressable
                        style={[styles.qtyBtn, { borderColor: Colors.border, opacity: hasReachedStockLimit || item.is_out_of_stock ? 0.45 : 1 }]}
                        onPress={() => increaseQty(item.id)}
                        disabled={hasReachedStockLimit || item.is_out_of_stock}
                      >
                        <Text style={[styles.qtyText, { color: Colors.text }]}>+</Text>
                      </Pressable>
                      <Pressable onPress={() => removeFromCart(item.id)} style={styles.removeBtn}>
                        <Text style={[styles.removeText, { color: Colors.danger }]}>Hiq</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <PremiumCard style={styles.promoCard}>
            <Text style={[styles.cardTitle, { color: Colors.text }]}>Kodi promocional</Text>
            <View style={styles.promoRow}>
              <TextInput
                value={promoCode}
                onChangeText={setPromoCode}
                autoCapitalize="characters"
                placeholder="Shkruani kodin"
                placeholderTextColor={Colors.muted}
                style={[styles.promoInput, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]}
              />
              <Pressable style={[styles.applyBtn, { backgroundColor: Colors.primary }]} onPress={handleApplyPromo}>
                <Text style={styles.applyText}>Apliko</Text>
              </Pressable>
            </View>
            {!!promoMessage && <Text style={[styles.promoMessage, { color: Colors.muted }]}>{promoMessage}</Text>}
            {promo && (
              <View style={styles.appliedRow}>
                <Text style={[styles.appliedText, { color: Colors.primary }]}>
                  Aplikuar: {promo.code}
                </Text>
                <Pressable onPress={removePromo}>
                  <Text style={[styles.removeText, { color: Colors.danger }]}>Hiq</Text>
                </Pressable>
              </View>
            )}
          </PremiumCard>

          <PremiumCard style={styles.summaryCard}>
            <SummaryRow label="Nëntotali" value={`${subtotal.toFixed(2)}€`} />
            {promo && <SummaryRow label="Zbritja" value={`-${discount.toFixed(2)}€`} positive />}
            <View style={[styles.divider, { backgroundColor: Colors.border }]} />
            <SummaryRow label="Totali" value={`${total.toFixed(2)}€`} bold />
          </PremiumCard>

          <View style={styles.actions}>
            <Pressable style={[styles.clearBtn, { borderColor: Colors.border }]} onPress={clearCart}>
              <Text style={[styles.clearText, { color: Colors.text }]}>Pastro shportën</Text>
            </Pressable>
            <Pressable
              style={[styles.checkoutBtn, { backgroundColor: hasOutOfStockItems ? Colors.border : Colors.primary }]}
              onPress={goToCheckout}
              disabled={hasOutOfStockItems}
            >
              <Text style={styles.checkoutText}>Vazhdo te porosia</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function CartProductImage({ url, fallbackColor }: { url: string; fallbackColor: string }) {
  const optimizedUrl = getCatalogImageUrl(url, 180);
  const [sourceUrl, setSourceUrl] = useState(optimizedUrl);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <Ionicons name="image-outline" size={26} color={fallbackColor} />;
  }

  return (
    <ExpoImage
      source={sourceUrl!}
      style={styles.itemImage}
      contentFit="contain"
      cachePolicy="memory-disk"
      recyclingKey={sourceUrl!}
      transition={180}
      onError={() => {
        if (sourceUrl !== url) setSourceUrl(url);
        else setFailed(true);
      }}
    />
  );
}

function SummaryRow({ label, value, bold = false, positive = false }: { label: string; value: string; bold?: boolean; positive?: boolean }) {
  const Colors = useClientColors();
  return (
    <View style={styles.summaryRow}>
      <Text style={[bold ? styles.summaryBold : styles.summaryLabel, { color: Colors.text }]}>{label}</Text>
      <Text style={[bold ? styles.summaryTotal : styles.summaryValue, { color: positive ? '#2EAD66' : bold ? Colors.primary : Colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 140 },
  warning: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 14 },
  warningText: { fontSize: 13, fontWeight: '700' },
  items: { gap: 12, marginBottom: 16 },
  itemCard: { borderWidth: 1, borderRadius: 18, padding: 12, flexDirection: 'row', gap: 12 },
  imageWrap: { width: 76, height: 76, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  itemImage: { width: '100%', height: '100%' },
  itemCopy: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '800' },
  itemPrice: { fontSize: 12, marginTop: 4 },
  outOfStock: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  qtyBtn: { width: 30, height: 30, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 18, fontWeight: '800' },
  quantity: { minWidth: 18, textAlign: 'center', fontWeight: '800' },
  removeBtn: { marginLeft: 8 },
  removeText: { fontSize: 12, fontWeight: '900' },
  promoCard: { marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
  promoRow: { flexDirection: 'row', gap: 8 },
  promoInput: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12 },
  applyBtn: { minHeight: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  applyText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  promoMessage: { fontSize: 12, marginTop: 8 },
  appliedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  appliedText: { fontSize: 13, fontWeight: '800' },
  summaryCard: { gap: 8, marginBottom: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  summaryBold: { fontSize: 16, fontWeight: '900' },
  summaryTotal: { fontSize: 18, fontWeight: '900' },
  divider: { height: 1, marginVertical: 4 },
  actions: { flexDirection: 'row', gap: 10 },
  clearBtn: { flex: 1, minHeight: 52, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 13, fontWeight: '900' },
  checkoutBtn: { flex: 1, minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  checkoutText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
