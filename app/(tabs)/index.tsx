'use client';

import { View, Text, Pressable } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../context/supabase';

export default function HomeTab() {
  const { user } = useAuth();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 20 }}>
        Welcome {user?.email}
      </Text>

      <Pressable
        onPress={() => supabase.auth.signOut()}
        style={{ marginTop: 20 }}
      >
        <Text style={{ color: 'red', fontWeight: '600' }}>
          Logout
        </Text>
      </Pressable>
    </View>
  );
}
