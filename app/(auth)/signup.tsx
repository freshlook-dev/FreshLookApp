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
import { sendWelcomeEmail } from '../../utils/sendWelcomeEmail';

/* ✅ THEME */
import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);

  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const handleSignUp = async () => {
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanCode = accessCode.trim();

    if (!cleanEmail || !password || !cleanName || !cleanPhone) {
      Alert.alert('Error', 'Name, phone, email, and password are required');
      return;
    }

    setLoading(true);

    try {
      let codeData: { id: string } | null = null;

      if (cleanCode) {
        const { data, error: codeError } = await supabase
          .from('access_codes')
          .select('id')
          .eq('code', cleanCode)
          .eq('role', 'staff')
          .eq('used', false)
          .maybeSingle();

        if (codeError || !data) {
          Alert.alert('Invalid code', 'Access code is invalid or already used');
          return;
        }

        codeData = data;
      }

      const nextRole = codeData ? 'staff' : 'client';

      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
              phone: cleanPhone,
              role: nextRole,
            },
          },
        });

      if (signUpError || !signUpData.user) {
        setLoading(false);
        Alert.alert('Signup failed', signUpError?.message || 'Unknown error');
        return;
      }

      if (!signUpData.session) {
        Alert.alert(
          'Account created',
          'Automatic sign-in is unavailable. Please ask the owner to disable Confirm email in Supabase.'
        );
        router.replace('/(auth)/login');
        return;
      }

      if (codeData) {
        const { error: codeUpdateError } = await supabase
          .from('access_codes')
          .update({ used: true })
          .eq('id', codeData.id)
          .eq('used', false);

        if (codeUpdateError) {
          Alert.alert('Access code error', codeUpdateError.message);
          return;
        }

        await supabase.from('audit_logs').insert({
          actor_id: signUpData.user.id,
          action: 'USE_ACCESS_CODE',
          target_id: codeData.id,
        });
      }

      void sendWelcomeEmail(signUpData.session.access_token);
      Alert.alert('Success', `Account created successfully as ${nextRole}`);
      router.replace(nextRole === 'client' ? '/client' : '/(tabs)');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: Colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.title, { color: Colors.text }]}>
              Create Account
            </Text>
            <Text style={[styles.subtitle, { color: Colors.muted }]}>
              Create a client account or enter a staff access code
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: Colors.card }]}>
            <TextInput
              placeholder="Full Name"
              placeholderTextColor={Colors.muted}
              value={fullName}
              onChangeText={setFullName}
              returnKeyType="next"
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
              placeholder="Phone number"
              placeholderTextColor={Colors.muted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              returnKeyType="next"
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
              placeholder="Email address"
              placeholderTextColor={Colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
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
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
              returnKeyType="next"
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
              placeholder="5-digit Staff Access Code (optional)"
              placeholderTextColor={Colors.muted}
              keyboardType="number-pad"
              maxLength={5}
              value={accessCode}
              onChangeText={setAccessCode}
              returnKeyType="done"
              style={[
                styles.input,
                {
                  backgroundColor: Colors.background,
                  color: Colors.text,
                  borderColor: Colors.primary,
                },
              ]}
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

            <Pressable
              onPress={() => router.replace('/(auth)/login')}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Back to Login</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  inner: {
    width: '100%',
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
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
  },
  card: {
    borderRadius: 18,
    padding: 22,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    fontSize: 15,
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
  secondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#C9A24D',
    paddingVertical: 16,
    borderRadius: 14,
  },
  secondaryButtonText: {
    color: '#C9A24D',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
