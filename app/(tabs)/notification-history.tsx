import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '../../components/Card';
import { DarkColors, LightColors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../context/supabase';
import { useTheme } from '../../context/ThemeContext';
import { formatDateTime } from '../../utils/format';

type NotificationHistoryItem = {
  id: number;
  title: string;
  message: string;
  audience: 'all' | 'direct' | 'staff' | null;
  recipient_count: number;
  created_at: string;
};

const STAFF_ROLES = ['owner', 'manager', 'staff'];

export default function StaffNotificationHistoryScreen() {
  const { profile, loading } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;
  const [items, setItems] = useState<NotificationHistoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canView = !!profile?.role && STAFF_ROLES.includes(profile.role);

  const loadHistory = useCallback(async () => {
    setErrorMessage(null);
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: { mode: 'list_history' },
    });

    if (error || data?.error) {
      setErrorMessage(data?.error || error?.message || 'Historiku nuk u ngarkua.');
      setLoadingItems(false);
      return;
    }

    setItems((data?.history ?? []) as NotificationHistoryItem[]);
    setLoadingItems(false);
  }, []);

  useEffect(() => {
    if (!loading && canView) void loadHistory();
  }, [loading, canView, loadHistory]);

  if (loading) return null;
  if (!canView) return <Redirect href="/(tabs)/profile" />;

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color={Colors.text} />
        <Text style={[styles.backText, { color: Colors.text }]}>Kryefaqja</Text>
      </Pressable>

      <Text style={[styles.title, { color: Colors.text }]}>Historiku i njoftimeve</Text>
      <Text style={[styles.subtitle, { color: Colors.muted }]}>
        Shikoni njoftimet e dërguara për klientët dhe ekipin.
      </Text>

      {loadingItems ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : errorMessage ? (
        <Card>
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: Colors.primarySoft }]}>
              <Ionicons name="cloud-offline-outline" size={25} color={Colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: Colors.text }]}>Historiku nuk u ngarkua</Text>
            <Text style={[styles.emptyMessage, { color: Colors.muted }]}>{errorMessage}</Text>
            <Pressable onPress={() => void loadHistory()} style={[styles.retryButton, { backgroundColor: Colors.primary }]}>
              <Text style={[styles.retryText, { color: Colors.onPrimary }]}>Provo përsëri</Text>
            </Pressable>
          </View>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: Colors.primarySoft }]}>
              <Ionicons name="notifications-outline" size={25} color={Colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: Colors.text }]}>Nuk ka njoftime ende</Text>
            <Text style={[styles.emptyMessage, { color: Colors.muted }]}>
              Njoftimet e dërguara do të shfaqen këtu.
            </Text>
          </View>
        </Card>
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <Card key={item.id} style={styles.notificationCard}>
              <View style={styles.notificationRow}>
                <View style={[styles.iconTile, { backgroundColor: Colors.primarySoft }]}>
                  <Ionicons
                    name={item.audience === 'direct' ? 'person-outline' : item.audience === 'staff' ? 'people-outline' : 'megaphone-outline'}
                    size={20}
                    color={Colors.primary}
                  />
                </View>
                <View style={styles.notificationCopy}>
                  <View style={styles.notificationTop}>
                    <Text style={[styles.notificationTitle, { color: Colors.text }]}>{item.title}</Text>
                    <View style={[styles.badge, { backgroundColor: Colors.primarySoft }]}>
                      <Text style={[styles.badgeText, { color: Colors.primary }]}>
                        {item.audience === 'direct' ? 'Direkt' : item.audience === 'staff' ? 'Vetëm stafi' : 'Të gjithë'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.notificationMessage, { color: Colors.muted }]}>{item.message}</Text>
                  <Text style={[styles.notificationMeta, { color: Colors.primary }]}>
                    {formatDateTime(item.created_at)} · {item.recipient_count} pajisje
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22, paddingBottom: 100 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  backText: { fontSize: 15, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 22 },
  loader: { marginTop: 40 },
  list: { gap: 2 },
  notificationCard: { padding: 16 },
  notificationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  iconTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  notificationCopy: { flex: 1, minWidth: 0 },
  notificationTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  notificationTitle: { flex: 1, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  notificationMessage: { fontSize: 14, lineHeight: 21, marginTop: 5 },
  notificationMeta: { fontSize: 12, fontWeight: '800', marginTop: 10 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptyMessage: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  retryButton: { minHeight: 42, marginTop: 16, paddingHorizontal: 18, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontSize: 13, fontWeight: '800' },
});
