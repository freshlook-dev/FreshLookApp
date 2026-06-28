import { Slot, Redirect, router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { CartProvider, useCart } from '../../context/CartContext';
import { useTheme } from '../../context/ThemeContext';
import { DarkColors, LightColors } from '../../constants/colors';

const CLIENT_TABS = [
  { href: '/client', label: 'Kryefaqja', icon: 'home-outline', activeIcon: 'home' },
  { href: '/client/shop', label: 'Produktet', icon: 'bag-outline', activeIcon: 'bag' },
  { href: '/client/appointments', label: 'Vizitat', icon: 'calendar-outline', activeIcon: 'calendar' },
  { href: '/client/rewards', label: 'Shpërblimet', icon: 'gift-outline', activeIcon: 'gift' },
  { href: '/client/profile', label: 'Profili', icon: 'person-outline', activeIcon: 'person' },
] as const;

const avatarPlaceholder = require('../../assets/images/avatar-placeholder.png');

type ClientTabButtonProps = {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
  colors: typeof LightColors;
  avatarUrl?: string | null;
  onPress: () => void;
  badgeCount?: number;
};

function ClientTabButton({
  active,
  icon,
  activeIcon,
  label,
  colors,
  avatarUrl,
  onPress,
  badgeCount = 0,
}: ClientTabButtonProps) {
  const scale = useRef(new Animated.Value(active ? 1 : 0.92)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1 : 0.92,
      damping: 14,
      stiffness: 170,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);

  const animatePress = (value: number) => {
    Animated.spring(pressScale, {
      toValue: value,
      damping: 16,
      stiffness: 260,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      style={styles.navItem}
      onPress={onPress}
      onPressIn={() => animatePress(0.94)}
      onPressOut={() => animatePress(1)}
    >
      <Animated.View
        style={[
          styles.iconBubble,
          {
            backgroundColor: active ? colors.primarySoft : 'transparent',
            transform: [{ scale: Animated.multiply(scale, pressScale) }],
          },
        ]}
      >
        {avatarUrl ? (
          <View
            style={[
              styles.avatarTabRing,
              { borderColor: active ? colors.primary : 'transparent' },
            ]}
          >
            <Image source={{ uri: avatarUrl }} style={styles.avatarTabImage} />
          </View>
        ) : icon === 'person-outline' ? (
          <Image
            source={avatarPlaceholder}
            style={[
              styles.avatarTabImage,
              { borderColor: active ? colors.primary : colors.border },
            ]}
          />
        ) : (
          <Ionicons
            name={active ? activeIcon : icon}
            size={25}
            color={active ? colors.primary : colors.text}
          />
        )}
        {badgeCount > 0 && (
          <View style={[styles.cartBadge, { backgroundColor: colors.danger }]}>
            <Text style={styles.cartBadgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
          </View>
        )}
      </Animated.View>
      <Text
        numberOfLines={1}
        style={[styles.navLabel, { color: active ? colors.primary : colors.muted }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ClientLayoutContent() {
  const { user, profile, loading } = useAuth();
  const { itemCount } = useCart();
  const { theme } = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const Colors = theme === 'dark' ? DarkColors : LightColors;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    contentOpacity.setValue(0.86);
    contentTranslate.setValue(8);

    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslate, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [contentOpacity, contentTranslate, pathname]);

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
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslate }],
          },
        ]}
      >
        <Slot />
      </Animated.View>

      <View
        style={[
          styles.nav,
          {
            backgroundColor:
              theme === 'dark' ? Colors.elevated : 'rgba(255,252,247,0.96)',
            borderColor: Colors.border,
            paddingBottom:
              Platform.OS === 'web'
                ? (`max(7px, ${bottomInset})` as any)
                : 7,
          },
        ]}
      >
        {CLIENT_TABS.map((item) => {
          const active =
            item.href === '/client'
              ? pathname === '/client'
              : pathname.startsWith(item.href);

          return (
            <ClientTabButton
              key={item.href}
              active={active}
              icon={item.icon}
              activeIcon={item.activeIcon}
              label={item.label}
              colors={Colors}
              avatarUrl={item.href === '/client/profile' ? profile?.avatar_url : null}
              badgeCount={item.href === '/client/shop' ? itemCount : 0}
              onPress={() => router.replace(item.href as any)}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function ClientLayout() {
  return (
    <CartProvider>
      <ClientLayoutContent />
    </CartProvider>
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
    borderRadius: 34,
    flexDirection: 'row',
    paddingTop: 7,
    paddingHorizontal: 8,
    marginHorizontal: 28,
    marginBottom: 12,
    minHeight: 76,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 26,
    elevation: 18,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
    gap: 3,
  },
  iconBubble: {
    width: 54,
    height: 40,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTabRing: {
    width: 33,
    height: 33,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTabImage: {
    width: 29,
    height: 29,
    borderRadius: 15,
    borderWidth: 1,
  },
  navLabel: {
    maxWidth: 62,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 8,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
});
