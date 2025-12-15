import { useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthContext';

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);

  /* 🔄 REFRESH ACTION */
  const handleRefresh = async () => {
    if (!user || refreshing) return;

    setRefreshing(true);
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
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'center',

        tabBarActiveTintColor: '#C9A24D',
        tabBarInactiveTintColor: '#9A9A9A',

        // 🔥 PERFECT TAB BAR POSITION (iOS + Android)
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1.0,
          borderTopColor: '#EEE',
          height: 70 + insets.bottom,
          paddingBottom: Math.max(insets.bottom - 6, 8),
        },

        tabBarLabelStyle: {
          fontSize: 11,
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

      {/* 🕒 HISTORY SCREEN */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historia',
          headerRight: () => <RefreshButton />,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'time' : 'time-outline'}
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

      {/* 🔒 HIDDEN SCREENS */}

      <Tabs.Screen
        name="edit"
        options={{
          href: null,
          title: 'Edit Appointment',
        }}
      />

      <Tabs.Screen
        name="change-password"
        options={{
          href: null,
          title: 'Change Password',
        }}
      />

      <Tabs.Screen
        name="manage-users"
        options={{
          href: null,
          title: 'Manage Users',
        }}
      />
    </Tabs>
  );
}
