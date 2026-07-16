import { ReactNode, useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { DarkColors, LightColors } from '../../constants/colors';

export function useOwnerAdmin() {
  const { profile, loading } = useAuth();
  const allowed = !loading && profile?.role === 'owner' && profile.is_active !== false;
  useEffect(() => {
    if (!loading && !allowed) router.replace('/(tabs)/profile');
  }, [allowed, loading]);
  return { allowed, loading };
}

export function OwnerAdminShell({ title, subtitle, children, scroll = true }: {
  title: string; subtitle?: string; children: ReactNode; scroll?: boolean;
}) {
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;
  const { allowed, loading } = useOwnerAdmin();
  if (loading || !allowed) return <View style={[styles.center, { backgroundColor: Colors.background }]}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  const header = <View style={styles.header}>
    <Pressable accessibilityLabel="Kthehu" onPress={() => router.back()} style={[styles.back, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
      <Ionicons name="chevron-back" size={22} color={Colors.text} />
    </Pressable>
    <View style={styles.headerText}><Text style={[styles.title, { color: Colors.text }]}>{title}</Text>{subtitle ? <Text style={[styles.subtitle, { color: Colors.muted }]}>{subtitle}</Text> : null}</View>
  </View>;
  if (!scroll) return <View style={[styles.root, { backgroundColor: Colors.background }]}>{header}{children}</View>;
  return <ScrollView style={[styles.root, { backgroundColor: Colors.background }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{header}{children}</ScrollView>;
}

export function AdminCard({ children }: { children: ReactNode }) {
  const { theme } = useTheme(); const C = theme === 'dark' ? DarkColors : LightColors;
  return <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>{children}</View>;
}

export function AdminButton({ label, onPress, secondary, danger, disabled }: { label: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean }) {
  const { theme } = useTheme(); const C = theme === 'dark' ? DarkColors : LightColors;
  const backgroundColor = danger ? C.danger : secondary ? C.surface : C.primary;
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor, opacity: disabled ? .5 : pressed ? .78 : 1 }]}><Text style={[styles.buttonText, { color: secondary ? C.text : C.onPrimary }]}>{label}</Text></Pressable>;
}

export const adminStyles = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { fontSize: 16, fontWeight: '800' },
  muted: { fontSize: 13, lineHeight: 19 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 15 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  empty: { textAlign: 'center', paddingVertical: 28, fontSize: 14 },
});

const styles = StyleSheet.create({
  root: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 80 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  back: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 }, title: { fontSize: 24, fontWeight: '900' }, subtitle: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  card: { borderRadius: 18, borderWidth: 1, padding: 15, marginBottom: 12 },
  button: { minHeight: 42, borderRadius: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 13, fontWeight: '800' },
});
