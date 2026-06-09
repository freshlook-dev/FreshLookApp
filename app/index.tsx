'use client';

import { useEffect } from 'react';
import { Platform, Text } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function Index() {
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (Platform.OS === 'web' && profile?.role === 'client') {
          router.replace('/client' as any);
          return;
        }

        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [user, profile?.role, loading]);

  return <Text>Loading...</Text>;
}
