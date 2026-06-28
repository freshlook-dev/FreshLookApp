'use client';

import { useEffect } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function Index() {
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (!profile?.role) return;

        if (profile?.role === 'client') {
          router.replace('/client' as any);
          return;
        }

        router.replace('/(tabs)');
      } else {
        router.replace('/treatments');
      }
    }
  }, [user, profile?.role, loading]);

  return <Text>Duke u ngarkuar...</Text>;
}
