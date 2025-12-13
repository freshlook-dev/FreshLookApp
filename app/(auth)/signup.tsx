'use client';

import { useState } from 'react';
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

import { supabase } from '../../context/supabase';
import { Colors, Spacing } from '../../constants/theme';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !fullName || !accessCode) {
      Alert.alert('Error', 'All fields are required');
      return;
    }

    setLoading(true);

    try {
      // 1️⃣ Validate access code
      const { data: codeData, error: codeError } = await supabase
        .from('access_codes')
        .select('*')
        .eq('code', accessCode)
        .eq('used', false)
        .single();

      if (codeError || !codeData) {
        Alert.alert('Invalid code', 'Access code is invalid or already used');
        setLoading(false);
        return;
      }

      // 2️⃣ Create auth user
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email,
          password,
        });

      if (signUpError || !signUpData.user) {
        Alert.alert('Signup failed', signUpError?.message || 'Unknown error');
        setLoading(false);
        return;
      }

      const userId = signUpData.user.id;

      // 3️⃣ Save profile data (role + full name)
      await supabase
        .from('profiles')
        .update({
          role: codeData.role,
          full_name: fullName,
        })
        .eq('id', userId);

      // 4️⃣ Mark access code as used
      await supabase
        .from('access_codes')
        .update({
          used: true,
          used_at: new Date().toISOString(),
        })
        .eq('id', codeData.id);

      // 5️⃣ Audit log
      await supabase.from('audit_logs').insert({
        actor_id: userId,
        action: 'USE_ACCESS_CODE',
        target_id: codeData.id,
      });

      Alert.alert(
        'Success',
        'Account created successfully. You can now log in.'
      );

      router.replace('/(auth)/login');
    } catch (e) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        placeholder="Full Name"
        value={fullName}
        onChangeText={setFullName}
        style={styles.input}
      />

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      <TextInput
        placeholder="5-digit Access Code"
        keyboardType="number-pad"
        maxLength={5}
        value={accessCode}
        onChangeText={setAccessCode}
        style={styles.input}
      />

      <Pressable
        onPress={handleSignUp}
        disabled={loading}
        style={styles.button}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign Up</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.replace('/(auth)/login')}>
        <Text style={styles.link}>Already have an account? Log in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: Spacing.lg,
    textAlign: 'center',
    color: Colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.textSecondary,
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    fontSize: 16,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    marginTop: Spacing.lg,
    textAlign: 'center',
    color: Colors.accent,
    fontWeight: '600',
  },
});
