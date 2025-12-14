import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

export default function TabsLayout() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  /* 🔔 LOAD UNREAD NOTIFICATIONS COUNT */
  useEffect(() => {
    if (!user) return;

    const loadUnread = async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (!error) {
        setUnreadCount(count ?? 0);
      }
    };

    loadUnread();

    // 🔄 Realtime updates
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

  return (
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
  );
}
