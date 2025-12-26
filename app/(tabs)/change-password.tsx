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

import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

export default function ChangePasswordScreen() {
  const { user } = useAuth();

  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

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

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        Platform.OS === 'web'
          ? window.alert(error.message)
          : Alert.alert('Error', error.message);
        return;
      }

      if (Platform.OS === 'web') {
        window.alert('Password changed successfully');
        router.replace('/(tabs)/profile');
      } else {
        Alert.alert('Success', 'Password changed successfully', [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)/profile'),
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: Colors.background },
      ]}
    >
      <Text style={[styles.title, { color: Colors.text }]}>
        Change Password
      </Text>

      <TextInput
        placeholder="Old password"
        placeholderTextColor={Colors.muted}
        secureTextEntry
        value={oldPassword}
        onChangeText={setOldPassword}
        style={[
          styles.input,
          {
            backgroundColor: Colors.card,
            borderColor: Colors.primary,
            color: Colors.text,
          },
        ]}
      />

      <TextInput
        placeholder="New password"
        placeholderTextColor={Colors.muted}
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
        style={[
          styles.input,
          {
            backgroundColor: Colors.card,
            borderColor: Colors.primary,
            color: Colors.text,
          },
        ]}
      />

      <TextInput
        placeholder="Confirm new password"
        placeholderTextColor={Colors.muted}
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        style={[
          styles.input,
          {
            backgroundColor: Colors.card,
            borderColor: Colors.primary,
            color: Colors.text,
          },
        ]}
      />

      <Pressable
        onPress={handleChangePassword}
        disabled={loading}
        style={[
          styles.button,
          { backgroundColor: Colors.primary },
          loading && { opacity: 0.7 },
        ]}
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
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  button: {
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
