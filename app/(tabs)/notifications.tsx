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

/* ---------------- TYPES ---------------- */

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  author: {
    full_name: string | null;
  }[]; // ✅ ARRAY (important)
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  author_name: string;
};

/* ---------------- COMPONENT ---------------- */

export default function NotificationsTab() {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadNotifications();
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id,
        title,
        message,
        created_at,
        author:profiles (
          full_name
        )
      `)
      .eq('type', 'custom')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load notifications:', error.message);
      setLoading(false);
      return;
    }

    if (data) {
      const mapped: NotificationItem[] = (data as NotificationRow[]).map(
        (n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          created_at: n.created_at,
          author_name: n.author?.[0]?.full_name ?? 'Owner', // ✅ FIX
        })
      );

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
        <ActivityIndicator size="large" color="#C9A24D" />
        <Text style={styles.loadingText}>Loading announcements…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Announcements</Text>

      {notifications.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No announcements yet</Text>
          <Text style={styles.emptyText}>
            When the owner sends a notification, it will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.message}>{item.message}</Text>

              <View style={styles.meta}>
                <Text style={styles.author}>{item.author_name}</Text>
                <Text style={styles.time}>
                  {formatDateTime(item.created_at)}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F4',
    padding: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2B2B2B',
    marginBottom: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF8F4',
  },
  loadingText: {
    marginTop: 10,
    color: '#7A7A7A',
  },
  emptyBox: {
    marginTop: 60,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2B2B2B',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: '#7A7A7A',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2B2B2B',
  },
  message: {
    fontSize: 14,
    marginTop: 6,
    color: '#2B2B2B',
    lineHeight: 20,
  },
  meta: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  author: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C9A24D',
  },
  time: {
    fontSize: 12,
    color: '#7A7A7A',
  },
});
