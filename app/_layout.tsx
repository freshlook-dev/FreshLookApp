import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { SafeAreaView, StyleSheet } from 'react-native';

export default function RootLayout() {
  return (
    <AuthProvider>
      <SafeAreaView style={styles.safe}>
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaView>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAF8F4', // keep app background consistent
    paddingHorizontal: 16,      // ✅ THIS fixes the corner issue
  },
});
