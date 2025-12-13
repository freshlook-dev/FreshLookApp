import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export default function TabsLayout() {
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

          // ✅ IMPORTANT FIX
          height: Platform.OS === 'ios' ? 78 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
        },

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      {/* HOME */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* UPCOMING */}
      <Tabs.Screen
        name="upcoming"
        options={{
          title: 'Upcoming',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'list' : 'list-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* CALENDAR */}
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* CREATE */}
      <Tabs.Screen
        name="create"
        options={{
          title: 'New',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'add-circle' : 'add-circle-outline'}
              size={size + 6}
              color={color}
            />
          ),
        }}
      />

      {/* NOTIFICATIONS */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Announcements',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'megaphone' : 'megaphone-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* PROFILE */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* HIDDEN EDIT */}
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
