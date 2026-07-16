import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { OwnerAdminShell, AdminCard } from '../components/owner-admin/OwnerAdminShell';
import { useTheme } from '../context/ThemeContext';
import { DarkColors, LightColors } from '../constants/colors';
import { supabase } from '../context/supabase';

type Summary = { revenue: number; appointments: number; customers: number; products: number; pending: number; lowStock: number };
const tools = [
  ['calendar', 'Terminet', 'Regjistro dhe menaxho terminet', '/(tabs)/manage-appointments'],
  ['receipt', 'Porositë', 'Statusi dhe detajet e porosive online', '/owner-orders'],
  ['cube', 'Stoku', 'Online, Prishtinë dhe Fushë Kosovë', '/owner-stock'],
  ['bag-handle', 'Produktet', 'Katalogu, çmimet dhe fotografitë', '/owner-products'],
  ['sparkles', 'Shërbimet', 'Trajtimet dhe renditja e tyre', '/(tabs)/manage-services'],
  ['pricetag', 'Kodet promo', 'Zbritjet për porositë online', '/owner-promos'],
  ['people', 'Klientët', 'Historiku, pikët dhe shënimet', '/owner-customers'],
  ['people-circle', 'Përdoruesit', 'Rolet dhe qasja e stafit', '/(tabs)/manage-users'],
  ['bar-chart', 'Financat', 'Pagesat dhe raportet', '/owner-stats'],
  ['shield-checkmark', 'Auditimi', 'Ndryshimet e rëndësishme', '/(tabs)/audit-log'],
] as const;

export default function OwnerAdminScreen() {
  const { theme } = useTheme(); const C = theme === 'dark' ? DarkColors : LightColors;
  const [summary, setSummary] = useState<Summary | null>(null); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [orders, appointments, customers, products] = await Promise.all([
      supabase.from('orders').select('total,status'),
      supabase.from('appointments').select('id,status').eq('appointment_date', today),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
      supabase.from('products').select('id,stock_online'),
    ]);
    const orderRows = orders.data ?? []; const productRows = products.data ?? [];
    setSummary({
      revenue: orderRows.filter((o: any) => !['cancelled', 'canceled'].includes(o.status)).reduce((n: number, o: any) => n + Number(o.total || 0), 0),
      appointments: appointments.data?.length ?? 0, customers: customers.count ?? 0, products: productRows.length,
      pending: orderRows.filter((o: any) => o.status === 'pending').length,
      lowStock: productRows.filter((p: any) => Number(p.stock_online || 0) <= 5).length,
    });
  }, []);
  useEffect(() => { void load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  return <OwnerAdminShell title="Paneli i pronarit" subtitle="Administrimi i aplikacionit dhe dyqanit online">
    <ScrollView horizontal showsHorizontalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} contentContainerStyle={styles.metrics}>
      {!summary ? <ActivityIndicator color={C.primary} /> : <>
        <Metric label="Të ardhura online" value={`${summary.revenue.toFixed(2)} €`} color={C} />
        <Metric label="Terminet sot" value={String(summary.appointments)} color={C} />
        <Metric label="Klientë" value={String(summary.customers)} color={C} />
        <Metric label="Produkte" value={String(summary.products)} color={C} />
      </>}
    </ScrollView>
    {summary && (summary.pending > 0 || summary.lowStock > 0) ? <AdminCard>
      <Text style={[styles.attentionTitle, { color: C.text }]}>Kërkon vëmendje</Text>
      {summary.pending > 0 && <Text style={{ color: C.muted }}>{summary.pending} porosi në pritje</Text>}
      {summary.lowStock > 0 && <Text style={{ color: C.muted }}>{summary.lowStock} produkte me 5 ose më pak copë online</Text>}
    </AdminCard> : null}
    <View style={styles.grid}>{tools.map(([icon, title, subtitle, route]) => <Pressable key={route} onPress={() => router.push(route as any)} style={({ pressed }) => [styles.tool, { backgroundColor: C.card, borderColor: C.border, opacity: pressed ? .75 : 1 }]}>
      <View style={[styles.icon, { backgroundColor: C.primarySoft }]}><Ionicons name={icon as any} size={23} color={C.primary} /></View>
      <Text style={[styles.toolTitle, { color: C.text }]}>{title}</Text><Text style={[styles.toolSub, { color: C.muted }]}>{subtitle}</Text>
    </Pressable>)}</View>
  </OwnerAdminShell>;
}
function Metric({ label, value, color }: { label: string; value: string; color: typeof LightColors }) { return <View style={[styles.metric, { backgroundColor: color.card, borderColor: color.border }]}><Text style={[styles.metricValue, { color: color.text }]}>{value}</Text><Text style={[styles.metricLabel, { color: color.muted }]}>{label}</Text></View>; }
const styles = StyleSheet.create({
  metrics: { gap: 10, paddingBottom: 14 }, metric: { width: 150, borderWidth: 1, borderRadius: 16, padding: 14 }, metricValue: { fontSize: 20, fontWeight: '900' }, metricLabel: { fontSize: 12, marginTop: 5 },
  attentionTitle: { fontSize: 15, fontWeight: '900', marginBottom: 7 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tool: { width: '48.5%', minHeight: 155, borderWidth: 1, borderRadius: 18, padding: 14 }, icon: { width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  toolTitle: { fontSize: 16, fontWeight: '900' }, toolSub: { fontSize: 12, lineHeight: 17, marginTop: 5 },
});
