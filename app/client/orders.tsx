import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState, PremiumCard, ScreenHeader, useClientColors } from '../../components/ClientUI';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../context/supabase';
import { formatDateTime } from '../../utils/format';

type OrderItem = { name: string; quantity: number; price: number };
type Order = {
  id: string;
  display_order_id: string | null;
  created_at: string;
  status: string;
  total: number;
  subtotal: number;
  discount: number;
  address: string | null;
  instructions: string | null;
  full_name: string;
  phone: string;
  items: OrderItem[] | null;
};

const statusLabels: Record<string, string> = {
  pending: 'Në pritje',
  processing: 'Duke u përgatitur',
  ready: 'Gati',
  shipped: 'Në dërgesë',
  delivered: 'Dorëzuar',
  completed: 'Përfunduar',
  cancelled: 'Anuluar',
  canceled: 'Anuluar',
};

export default function ClientOrdersScreen() {
  const Colors = useClientColors();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', address: '', instructions: '' });
  const [now, setNow] = useState(Date.now());

  const loadOrders = useCallback(async () => {
    if (!user?.id) return;
    setErrorMessage(null);
    const { data, error } = await supabase
      .from('orders')
      .select('id, display_order_id, created_at, status, total, subtotal, discount, address, instructions, full_name, phone, items')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) setErrorMessage(error.message);
    else setOrders((data ?? []) as Order[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadOrders();
    if (!user?.id) return;

    const channel = supabase
      .channel(`client-orders-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        () => void loadOrders()
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [loadOrders, user?.id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const canManageOrder = (order: Order) =>
    now <= new Date(order.created_at).getTime() + 3 * 60 * 60 * 1000 &&
    ['pending', 'processing'].includes(order.status);

  const openEdit = (order: Order) => {
    setEditingOrder(order);
    setEditForm({
      full_name: order.full_name || '',
      phone: order.phone || '',
      address: order.address || '',
      instructions: order.instructions || '',
    });
  };

  const saveEdit = async () => {
    if (!editingOrder) return;
    setBusyId(editingOrder.id);
    const { data, error } = await supabase.functions.invoke('manage-client-order', {
      body: { action: 'update_details', order_id: editingOrder.id, ...editForm },
    });
    setBusyId(null);
    if (error || data?.error) {
      Alert.alert('Ndryshimi dështoi', data?.error || error?.message || 'Provoni përsëri.');
      return;
    }
    setEditingOrder(null);
    await loadOrders();
  };

  const cancelOrder = (order: Order) => {
    Alert.alert('Anulo porosinë?', 'Ky veprim nuk mund të kthehet prapa.', [
      { text: 'Jo', style: 'cancel' },
      {
        text: 'Anulo porosinë',
        style: 'destructive',
        onPress: async () => {
          setBusyId(order.id);
          const { data, error } = await supabase.functions.invoke('manage-client-order', {
            body: { action: 'cancel', order_id: order.id },
          });
          setBusyId(null);
          if (error || data?.error) Alert.alert('Anulimi dështoi', data?.error || error?.message || 'Provoni përsëri.');
          else await loadOrders();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.content}
      alwaysBounceVertical
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
    >
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color={Colors.text} />
        <Text style={[styles.backText, { color: Colors.text }]}>Kryefaqja</Text>
      </Pressable>

      <ScreenHeader
        eyebrow="Blerjet"
        title="Porositë e mia"
        subtitle="Ndiqni porositë, statusin e dërgesës dhe detajet e produkteve."
      />

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : errorMessage ? (
        <PremiumCard elevated>
          <EmptyState icon="cloud-offline-outline" title="Porositë nuk u ngarkuan" message={errorMessage} />
          <Pressable onPress={() => void loadOrders()} style={[styles.retryButton, { backgroundColor: Colors.primary }]}>
            <Text style={[styles.retryText, { color: Colors.onPrimary }]}>Provo përsëri</Text>
          </Pressable>
        </PremiumCard>
      ) : orders.length === 0 ? (
        <PremiumCard elevated>
          <EmptyState icon="receipt-outline" title="Nuk keni porosi ende" message="Porositë tuaja do të shfaqen këtu pasi të përfundoni një blerje." />
        </PremiumCard>
      ) : (
        <View style={styles.list}>
          {orders.map((order) => {
            const isOpen = expanded === order.id;
            const isCanceled = ['cancelled', 'canceled'].includes(order.status);
            const label = statusLabels[order.status] ?? order.status;
            const canManage = canManageOrder(order);
            const editWindowExpired = now > new Date(order.created_at).getTime() + 3 * 60 * 60 * 1000;
            return (
              <PremiumCard key={order.id} elevated style={styles.orderCard}>
                <Pressable onPress={() => setExpanded(isOpen ? null : order.id)}>
                  <View style={styles.orderTop}>
                    <View style={styles.orderHeading}>
                      <Text style={[styles.orderId, { color: Colors.text }]}> 
                        Porosia {order.display_order_id || `#${order.id.slice(0, 8)}`}
                      </Text>
                      <Text style={[styles.orderDate, { color: Colors.muted }]}>{formatDateTime(order.created_at)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: isCanceled ? `${Colors.danger}18` : Colors.primarySoft }]}>
                      <Text style={[styles.statusText, { color: isCanceled ? Colors.danger : Colors.primary }]}>{label}</Text>
                    </View>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: Colors.muted }]}>Totali</Text>
                    <View style={styles.totalAction}>
                      <Text style={[styles.totalValue, { color: Colors.primary }]}>{Number(order.total ?? 0).toFixed(2)} €</Text>
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.muted} />
                    </View>
                  </View>
                </Pressable>

                {isOpen && (
                  <View style={[styles.details, { borderTopColor: Colors.border }]}>
                    {(order.items ?? []).map((item, index) => (
                      <View key={`${item.name}-${index}`} style={styles.itemRow}>
                        <Text style={[styles.itemName, { color: Colors.text }]}>{item.name} × {item.quantity}</Text>
                        <Text style={[styles.itemPrice, { color: Colors.text }]}>{(Number(item.price) * Number(item.quantity)).toFixed(2)} €</Text>
                      </View>
                    ))}
                    {Number(order.discount ?? 0) > 0 && (
                      <View style={styles.itemRow}>
                        <Text style={[styles.itemName, { color: Colors.muted }]}>Zbritja</Text>
                        <Text style={[styles.itemPrice, { color: Colors.primary }]}>-{Number(order.discount).toFixed(2)} €</Text>
                      </View>
                    )}
                    {!!order.address && <Text style={[styles.meta, { color: Colors.muted }]}><Text style={styles.metaStrong}>Adresa: </Text>{order.address}</Text>}
                    {!!order.instructions && <Text style={[styles.meta, { color: Colors.muted }]}><Text style={styles.metaStrong}>Udhëzime: </Text>{order.instructions}</Text>}
                    {editWindowExpired && (
                      <View style={[styles.expiredNotice, { backgroundColor: Colors.surface, borderColor: Colors.border }]}> 
                        <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
                        <Text style={[styles.expiredNoticeText, { color: Colors.muted }]}> 
                          3 orë kanë kaluar. Për të ndryshuar ose anuluar porosinë, kontaktoni me dikë nga stafi i Fresh Look.
                        </Text>
                      </View>
                    )}
                    {canManage && (
                      <View style={styles.manageActions}>
                        <Pressable disabled={busyId === order.id} onPress={() => openEdit(order)} style={[styles.editButton, { borderColor: Colors.primary }]}>
                          <Ionicons name="create-outline" size={17} color={Colors.primary} />
                          <Text style={[styles.editButtonText, { color: Colors.primary }]}>Ndrysho</Text>
                        </Pressable>
                        <Pressable disabled={busyId === order.id} onPress={() => cancelOrder(order)} style={[styles.cancelButton, { borderColor: Colors.danger }]}>
                          {busyId === order.id ? <ActivityIndicator size="small" color={Colors.danger} /> : <Ionicons name="close-circle-outline" size={17} color={Colors.danger} />}
                          <Text style={[styles.editButtonText, { color: Colors.danger }]}>Anulo</Text>
                        </Pressable>
                      </View>
                    )}
                    {canManage && <Text style={[styles.deadlineHint, { color: Colors.muted }]}>Ndryshimet lejohen deri në 3 orë pas krijimit.</Text>}
                  </View>
                )}
              </PremiumCard>
            );
          })}
        </View>
      )}

      <Modal visible={!!editingOrder} transparent animationType="fade" onRequestClose={() => setEditingOrder(null)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={[styles.modalCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: Colors.text }]}>Ndrysho porosinë</Text>
              <Pressable onPress={() => setEditingOrder(null)}><Ionicons name="close" size={24} color={Colors.text} /></Pressable>
            </View>
            <TextInput value={editForm.full_name} onChangeText={(value) => setEditForm((prev) => ({ ...prev, full_name: value }))} placeholder="Emri dhe mbiemri" placeholderTextColor={Colors.muted} style={[styles.input, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]} />
            <TextInput value={editForm.phone} onChangeText={(value) => setEditForm((prev) => ({ ...prev, phone: value }))} placeholder="Telefoni" placeholderTextColor={Colors.muted} keyboardType="phone-pad" style={[styles.input, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]} />
            <TextInput value={editForm.address} onChangeText={(value) => setEditForm((prev) => ({ ...prev, address: value }))} placeholder="Adresa" placeholderTextColor={Colors.muted} multiline style={[styles.input, styles.multiInput, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]} />
            <TextInput value={editForm.instructions} onChangeText={(value) => setEditForm((prev) => ({ ...prev, instructions: value }))} placeholder="Udhëzime shtesë" placeholderTextColor={Colors.muted} multiline style={[styles.input, styles.multiInput, { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface }]} />
            <Pressable disabled={busyId === editingOrder?.id} onPress={() => void saveEdit()} style={[styles.saveButton, { backgroundColor: Colors.primary }]}>
              {busyId === editingOrder?.id ? <ActivityIndicator color={Colors.onPrimary} /> : <Text style={[styles.saveText, { color: Colors.onPrimary }]}>Ruaj ndryshimet</Text>}
            </Pressable>
          </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 120 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backText: { fontSize: 15, fontWeight: '800' },
  loader: { marginTop: 40 },
  list: { gap: 13 },
  orderCard: { padding: 17 },
  orderTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  orderHeading: { flex: 1 },
  orderId: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  orderDate: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  totalLabel: { fontSize: 13, fontWeight: '700' },
  totalAction: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  totalValue: { fontSize: 18, fontWeight: '900' },
  expiredNotice: { marginTop: 13, borderWidth: 1, borderRadius: 13, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  expiredNoticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  details: { borderTopWidth: 1, marginTop: 15, paddingTop: 14, gap: 9 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  itemName: { flex: 1, fontSize: 13, lineHeight: 19 },
  itemPrice: { fontSize: 13, fontWeight: '800' },
  meta: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  metaStrong: { fontWeight: '900' },
  retryButton: { minHeight: 46, marginTop: 5, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontSize: 14, fontWeight: '800' },
  manageActions: { flexDirection: 'row', gap: 9, marginTop: 10 },
  editButton: { flex: 1, minHeight: 43, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  cancelButton: { flex: 1, minHeight: 43, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  editButtonText: { fontSize: 13, fontWeight: '900' },
  deadlineHint: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,10,0.6)', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 500, alignSelf: 'center', borderWidth: 1, borderRadius: 24, padding: 20, gap: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  modalTitle: { fontSize: 22, fontWeight: '900' },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 14 },
  multiInput: { minHeight: 72, paddingTop: 13, textAlignVertical: 'top' },
  saveButton: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  saveText: { fontSize: 14, fontWeight: '900' },
});
