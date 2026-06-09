import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DarkColors, LightColors } from '../constants/colors';

export default function Index() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/(tabs)' : '/(auth)/login');
  }, [loading, user]);

  return (
    <View style={[styles.center, { backgroundColor: Colors.background }]}>
      <ActivityIndicator color={Colors.primary} />
      <Text style={[styles.text, { color: Colors.muted }]}>Loading FreshLook...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  text: {
    fontSize: 14,
  },
});
