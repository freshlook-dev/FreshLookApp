import { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { DarkColors, LightColors } from '../constants/colors';
import { useTheme } from '../context/ThemeContext';

type IconName = keyof typeof Ionicons.glyphMap;

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  const Colors = useClientColors();

  return (
    <View style={styles.header}>
      {!!eyebrow && (
        <Text style={[styles.eyebrow, { color: Colors.primary }]}>{eyebrow}</Text>
      )}
      <Text style={[styles.title, { color: Colors.text }]}>{title}</Text>
      {!!subtitle && (
        <Text style={[styles.subtitle, { color: Colors.muted }]}>{subtitle}</Text>
      )}
    </View>
  );
}

export function PremiumCard({
  children,
  style,
  elevated = false,
}: {
  children: ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
}) {
  const Colors = useClientColors();

  return (
    <View
      style={[
        styles.card,
        elevated && styles.cardShadow,
        {
          backgroundColor: elevated ? Colors.elevated : Colors.card,
          borderColor: Colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function IconTile({ icon }: { icon: IconName }) {
  const Colors = useClientColors();

  return (
    <View style={[styles.iconTile, { backgroundColor: Colors.primarySoft }]}>
      <Ionicons name={icon} size={21} color={Colors.primary} />
    </View>
  );
}

export function StatusBadge({ label }: { label: string }) {
  const Colors = useClientColors();

  return (
    <View style={[styles.badge, { backgroundColor: Colors.primarySoft }]}>
      <View style={[styles.badgeDot, { backgroundColor: Colors.primary }]} />
      <Text style={[styles.badgeText, { color: Colors.primary }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon: IconName;
  title: string;
  message: string;
}) {
  const Colors = useClientColors();

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: Colors.primarySoft }]}>
        <Ionicons name={icon} size={25} color={Colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: Colors.text }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: Colors.muted }]}>{message}</Text>
    </View>
  );
}

export function useClientColors() {
  const { theme } = useTheme();
  return theme === 'dark' ? DarkColors : LightColors;
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  title: {
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '800',
    letterSpacing: -1.1,
  },
  subtitle: {
    maxWidth: 480,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    gap: 7,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 18,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 300,
  },
});
