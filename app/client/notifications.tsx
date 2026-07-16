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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState, PremiumCard, ScreenHeader, useClientColors } from '../../components/ClientUI';
import { supabase } from '../../context/supabase';
import { formatDateTime } from '../../utils/format';

type NotificationHistoryItem = {
  id: number;
  title: string;
  message: string;
  audience: 'all' | 'direct' | 'staff' | null;
  created_at: string;
};

export default function ClientNotificationsScreen() {
  const Colors = useClientColors();
  const [items, setItems] = useState<NotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setErrorMessage(null);
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: { mode: 'list_history' },
    });

    if (error || data?.error) {
      setErrorMessage(data?.error || error?.message || 'Historiku nuk u ngarkua.');
      setLoading(false);
      return;
    }

    setItems((data?.history ?? []) as NotificationHistoryItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
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

      <ScreenHeader
        eyebrow="Njoftimet"
        title="Historiku i njoftimeve"
        subtitle="Shikoni mesazhet dhe njoftimet e fundit nga Fresh Look."
      />

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : errorMessage ? (
        <PremiumCard elevated>
          <EmptyState icon="cloud-offline-outline" title="Historiku nuk u ngarkua" message={errorMessage} />
          <Pressable onPress={() => void loadNotifications()} style={[styles.retryButton, { backgroundColor: Colors.primary }]}>
            <Text style={[styles.retryText, { color: Colors.onPrimary }]}>Provo përsëri</Text>
          </Pressable>
        </PremiumCard>
      ) : items.length === 0 ? (
        <PremiumCard elevated>
          <EmptyState
            icon="notifications-outline"
            title="Nuk ka njoftime ende"
            message="Njoftimet nga Fresh Look do të shfaqen këtu sapo të dërgohen."
          />
        </PremiumCard>
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <PremiumCard key={item.id} elevated style={styles.notificationCard}>
              <View style={styles.notificationRow}>
                <View style={[styles.iconTile, { backgroundColor: Colors.primarySoft }]}>
                  <Ionicons
                    name={item.audience === 'direct' ? 'person-outline' : 'megaphone-outline'}
                    size={20}
                    color={Colors.primary}
                  />
                </View>
                <View style={styles.notificationCopy}>
                  <Text style={[styles.notificationTitle, { color: Colors.text }]}>{item.title}</Text>
                  <Text style={[styles.notificationMessage, { color: Colors.muted }]}>{item.message}</Text>
                  <Text style={[styles.notificationMeta, { color: Colors.primary }]}>
                    {formatDateTime(item.created_at)}
                  </Text>
                </View>
              </View>
            </PremiumCard>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 118 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backText: { fontSize: 15, fontWeight: '800' },
  loader: { marginTop: 40 },
  list: { gap: 13 },
  notificationCard: { padding: 16 },
  notificationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  iconTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  notificationCopy: { flex: 1, minWidth: 0 },
  notificationTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  notificationMessage: { fontSize: 14, lineHeight: 21, marginTop: 5 },
  notificationMeta: { fontSize: 12, fontWeight: '800', marginTop: 10 },
  retryButton: { minHeight: 46, marginTop: 4, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontSize: 14, fontWeight: '800' },
});
