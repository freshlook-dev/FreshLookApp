'use client';

import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { LightColors, DarkColors } from '../constants/colors';
import { Spacing } from '../constants/theme';

export function SectionTitle({ children }: { children: string }) {
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  return (
    <Text style={[styles.title, { color: Colors.text }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
});
