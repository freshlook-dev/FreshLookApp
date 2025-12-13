'use client';

import { useEffect } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [user, loading]);

  return <Text>Loading...</Text>;
}
