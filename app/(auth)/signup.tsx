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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../context/supabase';

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
        .eq('code', accessCode.trim())
        .eq('used', false)
        .maybeSingle();

      if (codeError || !codeData) {
        Alert.alert('Invalid code', 'Access code is invalid or already used');
        return;
      }

      // 2️⃣ Create auth user (AUTO LOGIN)
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email,
          password,
        });

      if (signUpError || !signUpData.user) {
        Alert.alert('Signup failed', signUpError?.message || 'Unknown error');
        return;
      }

      const userId = signUpData.user.id;

      // 3️⃣ Force profile write (bulletproof)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            full_name: fullName.trim(),
            role: codeData.role,
          },
          { onConflict: 'id' }
        );

      if (profileError) {
        Alert.alert('Profile error', profileError.message);
        return;
      }

      // 4️⃣ Mark access code as used
      await supabase
        .from('access_codes')
        .update({
          used: true,
          used_at: new Date().toISOString(),
        })
        .eq('id', codeData.id);

      // 5️⃣ Optional audit log
      await supabase.from('audit_logs').insert({
        actor_id: userId,
        action: 'USE_ACCESS_CODE',
        target_id: codeData.id,
      });

      Alert.alert('Success', 'Account created successfully');

      // ✅ CORRECT REDIRECT
      router.replace('/(tabs)');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join Fresh Look internal platform
          </Text>
        </View>

        <View style={styles.card}>
          <TextInput
            placeholder="Full Name"
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
          />

          <TextInput
            placeholder="Email address"
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
            style={[styles.button, loading && { opacity: 0.7 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#FAF8F4',
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
    fontWeight: '800',
    color: '#2B2B2B',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#7A7A7A',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E6D3A3',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#FAF8F4',
  },
  button: {
    backgroundColor: '#C9A24D',
    paddingVertical: 16,
    borderRadius: 14,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
