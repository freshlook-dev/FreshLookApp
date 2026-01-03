import { Image, Pressable, Animated, Easing } from 'react-native';
import {
  Tabs,
  Redirect,
  useRouter,
  usePathname,
} from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef } from 'react';

import { useAuth } from '../../context/AuthContext';

/* ✅ THEME */
import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

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

  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const router = useRouter();
  const pathname = usePathname();

  /* 🔄 ANIMATION */
  const rotateAnim = useRef(new Animated.Value(0)).current;

  /* 🔄 TRUE HARD REFRESH */
  const hardRefresh = () => {
  if (loading) return;

  rotateAnim.setValue(0);

  Animated.timing(rotateAnim, {
    toValue: 1,
    duration: 600,
    easing: Easing.out(Easing.ease),
    useNativeDriver: true,
  }).start();

  // 👇 FORCE FULL REMOUNT (tabs-safe)
  router.replace('/_sitemap');
  setTimeout(() => {
    router.replace('/(tabs)');
  }, 1);
};


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

        /* 🔄 REFRESH BUTTON */
        headerRight: () => {
          const spin = rotateAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          });

          return (
            <Pressable onPress={hardRefresh} style={{ marginRight: 20 }}>
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
          backgroundColor: Colors.background,
        },
        headerTintColor: Colors.text,
        headerTitleStyle: {
          color: Colors.text,
          fontWeight: '700',
        },

        /* ✅ TAB BAR THEME */
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.muted,

        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopWidth: 1,
          borderTopColor: Colors.muted,
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
      <Tabs.Screen name="edit" options={{ href: null }} />
      <Tabs.Screen name="change-password" options={{ href: null }} />
      <Tabs.Screen name="manage-users" options={{ href: null }} />
      <Tabs.Screen name="audit-log" options={{ href: null }} />
      <Tabs.Screen name="archived" options={{ href: null }} />
      <Tabs.Screen name="stats" options={{ href: null }} />
    </Tabs>
  );
}
