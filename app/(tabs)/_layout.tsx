import { Image, Pressable, Animated, Easing, Platform } from 'react-native';
import {
  Tabs,
  Redirect,
  useRouter,
  usePathname,
} from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, useState } from 'react';

import { useAuth } from '../../context/AuthContext';

/* ✅ THEME */
import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

/* 🖼 HEADER LOGO */
const HeaderLogo = () => (
  <Image
    source={require('../../assets/images/LOGO_HORIZONTAL.png')}
    style={{
      width: 118,
      height: 34,
      marginLeft: 18,
    }}
    resizeMode="contain"
  />
);

export default function TabsLayout() {
  const { user, profile, loading } = useAuth();
  const insets = useSafeAreaInsets();

  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const router = useRouter();
  const pathname = usePathname();

  const [refreshing, setRefreshing] = useState(false);

  /* 🔄 ANIMATION */
  const rotateAnim = useRef(new Animated.Value(0)).current;

  /* 🔄 SAFE REFRESH */
  const hardRefresh = () => {
    if (loading || refreshing) return;

    setRefreshing(true);
    rotateAnim.setValue(0);

    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('freshlook-refresh'));
        setRefreshing(false);
        return;
      }

      router.replace(pathname as any);
      setRefreshing(false);
    });
  };

  // ✅ Redirects AFTER hooks
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (profile?.role === 'client') {
    return <Redirect href={'/client' as any} />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'center',
        headerStatusBarHeight: 0,

        /* 🖼 LOGO ON LEFT */
        headerLeft: () => <HeaderLogo />,

        /* 🔄 REFRESH BUTTON */
        headerRight: () => {
          const spin = rotateAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          });

          return (
            <Pressable
              onPress={hardRefresh}
              style={{ marginRight: 16, padding: 8 }}
            >
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons
                  name="refresh"
                  size={22}
                  color={Colors.text}
                />
              </Animated.View>
            </Pressable>
          );
        },

        /* ✅ HEADER THEME */
        headerStyle: {
          backgroundColor: Colors.card,
        },
        headerShadowVisible: false,
        headerTintColor: Colors.text,
        headerTitleStyle: {
          color: Colors.text,
          fontWeight: '800',
          fontSize: 15,
        },

        /* ✅ TAB BAR THEME */
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.muted,

        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: 62 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.05,
          shadowRadius: 16,
          elevation: 8,
        },

        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          marginBottom: 0,
        },

        tabBarItemStyle: {
          paddingTop: 2,
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
        name="notifications"
        options={{
          href: null,
          title: 'Send Notifications',
        }}
      />

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
        name="manage-appointments"
        options={{
          href: null,
          title: 'Menaxho terminet',
        }}
      />

      <Tabs.Screen
        name="scan-discount"
        options={{
          href: null,
          title: 'Skano QR Discount',
        }}
      />

      <Tabs.Screen
        name="qr-redemptions"
        options={{
          href: null,
          title: 'QR Discounts',
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
          title: 'Archived Appointments',
        }}
      />

      <Tabs.Screen
        name="stats"
        options={{
          href: null,
          title: 'Staff Statistics',
        }}
      />
    </Tabs>
  );
}
