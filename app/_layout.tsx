import { Stack } from 'expo-router';
import { SafeAreaView, StyleSheet } from 'react-native';

import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { LightColors, DarkColors } from '../constants/colors';

function AppLayout() {
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  return (
    <SafeAreaView
      style={[
        styles.safe,
        { backgroundColor: Colors.background },
      ]}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaView>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppLayout />
      </ThemeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: 16, // ✅ keeps your corner fix
  },
});
