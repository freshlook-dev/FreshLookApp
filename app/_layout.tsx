import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { SafeAreaView, StyleSheet } from 'react-native';

import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

function AppLayout() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <>
      {/* ===== PWA / iOS HOME SCREEN ICON CONFIG ===== */}
      <Head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Fresh Look" />
      </Head>

      <SafeAreaView
        style={[
          styles.safe,
          { backgroundColor: isDark ? '#0F0F10' : '#FAF8F4' },
        ]}
      >
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaView>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: 16,
  },
});
