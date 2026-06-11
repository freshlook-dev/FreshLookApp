'use client';

import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { LightColors, DarkColors } from '../constants/colors';
import { Radius, Spacing } from '../constants/theme';

type CardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export function Card({ children, style }: CardProps) {
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: Colors.card, borderColor: Colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
});
