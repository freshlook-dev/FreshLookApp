import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../context/supabase';
import { useTheme } from '../../context/ThemeContext';
import { DarkColors, LightColors } from '../../constants/colors';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const handleReset = async () => {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || loading) return;

    setLoading(true);
    setMessage('');

    const redirectTo =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? `${window.location.origin}/reset-password`
        : Linking.createURL('/reset-password');

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo,
    });

    setLoading(false);
    setMessage(error ? error.message : 'Password reset link sent.');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: Colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
          <Text style={[styles.title, { color: Colors.text }]}>Reset Password</Text>
          <Text style={[styles.subtitle, { color: Colors.muted }]}>
            Enter your email and FreshLook will send you a reset link.
          </Text>
          <TextInput
            placeholder="Email address"
            placeholderTextColor={Colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            style={[styles.input, { color: Colors.text, borderColor: Colors.border }]}
          />
          {!!message && (
            <Text style={[styles.message, { color: message.includes('sent') ? Colors.success : Colors.danger }]}>
              {message}
            </Text>
          )}
          <Pressable
            style={[styles.button, { backgroundColor: Colors.primary }]}
            onPress={handleReset}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Link</Text>}
          </Pressable>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.link, { color: Colors.primary }]}>Back to login</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },
  button: {
    minHeight: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  link: {
    textAlign: 'center',
    fontWeight: '700',
    paddingVertical: 8,
  },
  message: {
    fontSize: 14,
    fontWeight: '700',
  },
});
