import { Slot, Redirect, router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { DarkColors, LightColors } from '../../constants/colors';

const CLIENT_TABS = [
  { href: '/client', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { href: '/client/appointments', label: 'Visits', icon: 'calendar-outline', activeIcon: 'calendar' },
  { href: '/client/rewards', label: 'Rewards', icon: 'gift-outline', activeIcon: 'gift' },
  { href: '/client/profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
] as const;

export default function ClientLayout() {
  const { user, profile, loading } = useAuth();
  const { theme } = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;
  if (profile?.role && profile.role !== 'client') {
    return <Redirect href="/(tabs)" />;
  }

  const bottomInset =
    Platform.OS === 'web' ? 'env(safe-area-inset-bottom)' : insets.bottom;

  return (
    <View style={[styles.shell, { backgroundColor: Colors.background }]}>
      <View style={styles.content}>
        <Slot />
      </View>

      <View
        style={[
          styles.nav,
          {
            backgroundColor: Colors.elevated,
            borderColor: Colors.border,
            paddingBottom:
              Platform.OS === 'web'
                ? (`max(12px, ${bottomInset})` as any)
                : Math.max(insets.bottom, 12),
          },
        ]}
      >
        {CLIENT_TABS.map((item) => {
          const active =
            item.href === '/client'
              ? pathname === '/client'
              : pathname.startsWith(item.href);

          return (
            <Pressable
              key={item.href}
              style={styles.navItem}
              onPress={() => router.replace(item.href as any)}
            >
              <View style={[styles.iconBubble, { backgroundColor: active ? Colors.primarySoft : 'transparent' }]}>
                <Ionicons
                  name={active ? item.activeIcon : item.icon}
                  size={21}
                  color={active ? Colors.primary : Colors.muted}
                />
              </View>
              <Text
                style={[
                  styles.navLabel,
                  { color: active ? Colors.primary : Colors.muted },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nav: {
    borderWidth: 1,
    borderRadius: 26,
    flexDirection: 'row',
    paddingTop: 7,
    paddingHorizontal: 7,
    marginHorizontal: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 61,
    gap: 3,
  },
  iconBubble: {
    width: 40,
    height: 31,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
