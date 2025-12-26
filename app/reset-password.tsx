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
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../context/supabase';

/* ✅ ADDED (theme only) */
import { useTheme } from '../context/ThemeContext';
import { LightColors, DarkColors } from '../constants/colors';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false); // 🔑 recovery ready

  /* ✅ THEME */
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  useEffect(() => {
    // ✅ REQUIRED for mobile browsers (Safari, iOS, Android)
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setReady(true);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
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

    if (!ready) {
      Alert.alert(
        'Please wait',
        'Preparing secure session. Try again in a moment.'
      );
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
    <View
      style={[
        styles.container,
        { backgroundColor: Colors.background },
      ]}
    >
      <Text style={[styles.title, { color: Colors.text }]}>
        Set new password
      </Text>

      {/* New Password */}
      <View style={styles.passwordWrapper}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: Colors.card,
              color: Colors.text,
              borderColor: Colors.primary,
            },
          ]}
          placeholder="New password"
          placeholderTextColor={Colors.muted}
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <Pressable
          style={styles.eye}
          onPress={() => setShowPassword(!showPassword)}
        >
          <Ionicons
            name={showPassword ? 'eye-off' : 'eye'}
            size={22}
            color={Colors.muted}
          />
        </Pressable>
      </View>

      {/* Confirm Password */}
      <View style={styles.passwordWrapper}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: Colors.card,
              color: Colors.text,
              borderColor: Colors.primary,
            },
          ]}
          placeholder="Confirm new password"
          placeholderTextColor={Colors.muted}
          secureTextEntry={!showConfirmPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <Pressable
          style={styles.eye}
          onPress={() =>
            setShowConfirmPassword(!showConfirmPassword)
          }
        >
          <Ionicons
            name={showConfirmPassword ? 'eye-off' : 'eye'}
            size={22}
            color={Colors.muted}
          />
        </Pressable>
      </View>

      <Pressable
        style={[
          styles.button,
          (loading || !ready) && { opacity: 0.6 },
        ]}
        onPress={handleUpdate}
        disabled={loading || !ready}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            Update password
          </Text>
        )}
      </Pressable>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    marginBottom: 20,
  },
  passwordWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingRight: 44,
    borderRadius: 12,
    fontSize: 15,
  },
  eye: {
    position: 'absolute',
    right: 14,
    top: '50%',
    transform: [{ translateY: -11 }],
  },
  button: {
    backgroundColor: '#C9A24D',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
