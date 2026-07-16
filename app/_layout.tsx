import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { usePathname } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

function AppLayout() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const pathname = usePathname();
  const isClientWeb = Platform.OS === 'web' && pathname.startsWith('/client');
  const isClientRoute = pathname.startsWith('/client');

  return (
    <>
      {Platform.OS === 'web' && (
        <Head>
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1, viewport-fit=cover"
          />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/manifest.json" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta
            name="apple-mobile-web-app-status-bar-style"
            content="black-translucent"
          />
          <meta name="apple-mobile-web-app-title" content="Fresh Look" />
        </Head>
      )}

      <StatusBar style={isDark ? 'light' : 'dark'} translucent />

      <SafeAreaView
        style={[
          styles.safe,
          {
            backgroundColor: isDark ? '#1B1B1D' : '#FAF8F4',
          },
        ]}
        edges={
          Platform.OS === 'web'
            ? ['top', 'left', 'right', 'bottom']
            : ['top']
        }
      >
        <View
          style={
            isClientWeb
              ? styles.clientWebInner
              : Platform.OS === 'web'
              ? styles.webInner
              : styles.nativeInner
          }
        >
          <KeyboardAvoidingView
            style={styles.keyboardRoot}
            behavior={Platform.OS === 'ios' && !isClientRoute ? 'padding' : undefined}
          >
            <View style={styles.keyboardRoot}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
                <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
                <Stack.Screen name="client" options={{ gestureEnabled: false }} />
              </Stack>
            </View>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.keyboardRoot}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppLayout />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: { flex: 1 },
  safe: {
    flex: 1,
  },
  webInner: {
    flex: 1,
    paddingHorizontal: 16,
  },
  clientWebInner: {
    flex: 1,
    alignSelf: 'center',
    maxWidth: 720,
    width: '100%',
  },
  nativeInner: {
    flex: 1,
    paddingHorizontal: 0,
  },
});
