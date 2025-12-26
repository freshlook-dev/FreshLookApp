'use client';

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { supabase } from '../../context/supabase';
import { router } from 'expo-router';

/* ✅ ADDED (theme only) */
import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  /* ✅ THEME */
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const handleLogin = async () => {
    if (!email || !password) return;

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      router.replace('/');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: Colors.background },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={[styles.title, { color: Colors.text }]}>
            Welcome Back
          </Text>
          <Text style={[styles.subtitle, { color: Colors.muted }]}>
            Sign in to continue to Fresh Look
          </Text>
        </View>

        {/* Form */}
        <View style={[styles.card, { backgroundColor: Colors.card }]}>
          <TextInput
            placeholder="Email address"
            placeholderTextColor={Colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={[
              styles.input,
              {
                backgroundColor: Colors.background,
                color: Colors.text,
                borderColor: Colors.primary,
              },
            ]}
          />

          <TextInput
            placeholder="Password"
            placeholderTextColor={Colors.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={[
              styles.input,
              {
                backgroundColor: Colors.background,
                color: Colors.text,
                borderColor: Colors.primary,
              },
            ]}
          />

          {/* 🔐 FORGOT PASSWORD */}
          <Pressable
            onPress={() => router.push('../(auth)/forgot-password')}
            style={{ marginBottom: 10 }}
          >
            <Text style={styles.forgot}>Forgot password?</Text>
          </Pressable>

          <Pressable
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Signing in…' : 'Log In'}
            </Text>
          </Pressable>
        </View>

        {/* Footer */}
        <Pressable onPress={() => router.replace('/(auth)/signup')}>
          <Text style={styles.link}>Create new account</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },

  header: {
    alignItems: 'center',
    marginBottom: 32,
  },

  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
  },

  subtitle: {
    marginTop: 6,
    fontSize: 14,
  },

  card: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    marginBottom: 14,
  },

  forgot: {
    textAlign: 'right',
    color: '#C9A24D',
    fontWeight: '600',
    fontSize: 13,
  },

  button: {
    backgroundColor: '#C9A24D',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },

  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },

  link: {
    marginTop: 24,
    textAlign: 'center',
    color: '#C9A24D',
    fontWeight: '600',
  },
});
