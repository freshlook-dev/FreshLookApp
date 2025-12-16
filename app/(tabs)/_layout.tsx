import { Image } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthContext';

/* 🖼 HEADER LOGO */
const HeaderLogo = () => (
  <Image
    source={require('../../assets/images/logo.png')}
    style={{
      width: 80,
      height: 80,
      marginLeft: 25,
    }}
    resizeMode="contain"
  />
);

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();

  // ✅ Redirects AFTER hooks
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'center',

        /* 🖼 LOGO ON LEFT */
        headerLeft: () => <HeaderLogo />,

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

      {/* 🕒 HISTORY SCREEN */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historia',
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

      <Tabs.Screen
        name="audit-log"
        options={{
          href: null,
          title: 'Audit Logs',
        }}
      />

      <Tabs.Screen
        name="archived"
        options={{
          href: null,
          title: 'Arkiva',
        }}
      />
    </Tabs>
  );
}
