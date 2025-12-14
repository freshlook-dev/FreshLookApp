import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

export default function TabsLayout() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  /* 🔔 LOAD UNREAD NOTIFICATIONS COUNT */
  useEffect(() => {
    if (!user) return;

    const loadUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      setUnreadCount(count ?? 0);
    };

    loadUnread();

    const channel = supabase
      .channel('notifications-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        loadUnread
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  /* 🔄 REFRESH HANDLER */
  const handleRefresh = () => {
    if (!user) return;

    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .then(({ count }) => setUnreadCount(count ?? 0));
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Tabs
        screenOptions={{
          headerShown: true,
          headerTitleAlign: 'center',

          /* 🔄 REFRESH ICON (ALL TABS) */
          headerRight: () => (
            <Pressable onPress={handleRefresh} style={{ paddingRight: 14 }}>
              <Ionicons name="refresh" size={22} color="#2B2B2B" />
            </Pressable>
          ),

          tabBarActiveTintColor: '#C9A24D',
          tabBarInactiveTintColor: '#9A9A9A',

          /* ✅ SAFE AREA FRIENDLY TAB BAR */
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 0.5,
            borderTopColor: '#EEE',
            paddingBottom: 8,
            height: 64,
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
