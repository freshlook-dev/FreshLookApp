import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

function AppLayout() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <>
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

      <StatusBar style={isDark ? 'light' : 'dark'} translucent />

      <SafeAreaView
        style={[
          styles.safe,
          {
            backgroundColor: isDark ? '#0F0F10' : '#FAF8F4',
          },
        ]}
        edges={Platform.OS === 'web' ? ['top', 'left', 'right'] : ['top']}
      >
        <View style={Platform.OS === 'web' ? styles.webInner : styles.nativeInner}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </SafeAreaView>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  webInner: {
    flex: 1,
    paddingHorizontal: 16,
  },
  nativeInner: {
    flex: 1,
    paddingHorizontal: 0,
  },
});