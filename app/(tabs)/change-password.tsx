'use client';

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

export default function ChangePasswordScreen() {
  const { user } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Platform.OS === 'web'
        ? window.alert('All fields are required')
        : Alert.alert('Error', 'All fields are required');
      return;
    }

    if (newPassword.length < 6) {
      Platform.OS === 'web'
        ? window.alert('Password must be at least 6 characters')
        : Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Platform.OS === 'web'
        ? window.alert('Passwords do not match')
        : Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      setLoading(true);

      // 🔐 Re-authenticate
      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email: user!.email!,
          password: oldPassword,
        });

      if (signInError) {
        Platform.OS === 'web'
          ? window.alert('Old password is incorrect')
          : Alert.alert('Error', 'Old password is incorrect');
        return;
      }

      // 🔁 Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        Platform.OS === 'web'
          ? window.alert(error.message)
          : Alert.alert('Error', error.message);
        return;
      }

      // ✅ SUCCESS CONFIRMATION + REDIRECT
      if (Platform.OS === 'web') {
        window.alert('Password changed successfully');
        router.replace('/(tabs)/profile');
      } else {
        Alert.alert(
          'Success',
          'Password changed successfully',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/(tabs)/profile'),
            },
          ]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Change Password</Text>

      <TextInput
        placeholder="Old password"
        secureTextEntry
        value={oldPassword}
        onChangeText={setOldPassword}
        style={styles.input}
      />

      <TextInput
        placeholder="New password"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
        style={styles.input}
      />

      <TextInput
        placeholder="Confirm new password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        style={styles.input}
      />

      <Pressable
        onPress={handleChangePassword}
        disabled={loading}
        style={styles.button}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>Update Password</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F4',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
    color: '#2B2B2B',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E6D3A3',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 12,
    backgroundColor: '#FFF',
  },
  button: {
    backgroundColor: '#C9A24D',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
