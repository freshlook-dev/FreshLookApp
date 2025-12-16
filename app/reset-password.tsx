'use client';

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '../context/supabase';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Required so Supabase reads token from URL
    supabase.auth.getSession();
  }, []);

  const handleUpdate = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert('Success', 'Password updated successfully');
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set new password</Text>

      <TextInput
        style={styles.input}
        placeholder="New password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm new password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <Pressable style={styles.button} onPress={handleUpdate}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Update password</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#FAF8F4',
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    marginBottom: 20,
    color: '#2B2B2B',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E6D3A3',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    color: '#2B2B2B',
  },
  button: {
    backgroundColor: '#C9A24D',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
