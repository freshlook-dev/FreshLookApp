import { useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  /* 🔔 LOAD UNREAD NOTIFICATIONS COUNT */
  const loadUnread = async () => {
    if (!user) return;

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (!error) {
      setUnreadCount(count ?? 0);
    }
  };

  useEffect(() => {
    if (!user) return;

    loadUnread();

    const channel = supabase
      .channel('notifications-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => loadUnread()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  /* 🔄 REFRESH ACTION */
  const handleRefresh = async () => {
    if (!user || refreshing) return;

    setRefreshing(true);
    await loadUnread();

    Alert.alert('Updated', 'The latest data has been refreshed successfully.');
    setRefreshing(false);
  };

  const RefreshButton = () => (
    <Pressable onPress={handleRefresh} style={{ marginRight: 14 }}>
      <Ionicons
        name={refreshing ? 'refresh-circle' : 'refresh'}
        size={24}
        color="#2B2B2B"
      />
    </Pressable>
  );

  // ✅ Redirects AFTER hooks
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <SafeAreaView style={styles.safe}>
      <Tabs
        screenOptions={{
          headerShown: true,
          headerTitleAlign: 'center',

          tabBarActiveTintColor: '#C9A24D',
          tabBarInactiveTintColor: '#9A9A9A',

          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 0.5,
            borderTopColor: '#EEE',
            paddingBottom: 8,
          },

          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            marginBottom: 4,
          },

          tabBarItemStyle: {
            paddingTop: 6,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Kryefaqja',
            headerRight: () => <RefreshButton />,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={size}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="upcoming"
          options={{
            title: 'Në ardhje',
            headerRight: () => <RefreshButton />,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'list' : 'list-outline'}
                size={size}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Kalendari',
            headerRight: () => <RefreshButton />,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'calendar' : 'calendar-outline'}
                size={size}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="create"
          options={{
            title: 'Termin i ri',
            headerRight: () => <RefreshButton />,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'add-circle' : 'add-circle-outline'}
                size={size + 6}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Njoftime',
            headerRight: () => <RefreshButton />,
            tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
            tabBarBadgeStyle: {
              backgroundColor: '#C0392B',
              color: '#FFFFFF',
              fontWeight: '700',
            },
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'megaphone' : 'megaphone-outline'}
                size={size}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profili',
            headerRight: () => <RefreshButton />,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={size}
                color={color}
              />
            ),
          }}
        />

        {/* Hidden edit screen */}
        <Tabs.Screen
          name="edit"
          options={{
            href: null,
            title: 'Edit Appointment',
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAF8F4',
    paddingHorizontal: 16, // ✅ FIXES EDGE ISSUE
  },
});
