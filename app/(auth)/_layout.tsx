import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

export default function AuthLayout() {
  const { user, loading } = useAuth();

  if (loading) return null;

  // If logged in, never show auth screens
  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  // Otherwise render auth stack
  return <Stack screenOptions={{ headerShown: false }} />;
}
