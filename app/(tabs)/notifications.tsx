'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

import { Colors, Spacing } from '../../constants/theme';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  author_name: string;
};

export default function NotificationsTab() {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadNotifications();
  }, [user]);

  const loadNotifications = async () => {
    setLoading(true);

    /**
     * We:
     * - get notifications for logged-in user
     * - only type = 'custom'
     * - join profiles to get author full name
     */
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id,
        title,
        message,
        created_at,
        author:profiles!notifications_user_id_fkey(full_name)
      `)
      .eq('type', 'custom')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mapped = data.map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        created_at: n.created_at,
        author_name: n.author?.full_name ?? 'Owner',
      }));

      setNotifications(mapped);
    }

    setLoading(false);
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} • ${d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: Spacing.sm }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionTitle>Announcements</SectionTitle>

      {notifications.length === 0 ? (
        <Text style={styles.empty}>No announcements yet</Text>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.message}>{item.message}</Text>

              <View style={styles.meta}>
                <Text style={styles.author}>{item.author_name}</Text>
                <Text style={styles.time}>{formatDateTime(item.created_at)}</Text>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.lg,
    color: Colors.textSecondary,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  message: {
    fontSize: 14,
    marginTop: Spacing.xs,
    color: Colors.textPrimary,
  },
  meta: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  author: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  time: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
