import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

function AppShell() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <>
      <Head>
        <title>FreshLook Client</title>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="FreshLook" />
        <meta name="theme-color" content="#C9A24D" />
      </Head>

      <StatusBar style={isDark ? 'light' : 'dark'} translucent />

      <SafeAreaView
        style={[
          styles.safe,
          { backgroundColor: isDark ? '#0F0F10' : '#FAF8F4' },
        ]}
        edges={Platform.OS === 'web' ? ['top', 'left', 'right'] : ['top']}
      >
        <View style={Platform.OS === 'web' ? styles.webInner : styles.inner}>
          <KeyboardAvoidingView
            style={styles.keyboardRoot}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.keyboardRoot}>
              <Stack screenOptions={{ headerShown: false }} />
            </View>
          </KeyboardAvoidingView>
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
          <AppShell />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: { flex: 1 },
  safe: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
  webInner: {
    flex: 1,
    alignSelf: 'center',
    maxWidth: 720,
    width: '100%',
  },
});
