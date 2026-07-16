import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../context/supabase';
import { useTheme } from '../context/ThemeContext';
import { DarkColors, LightColors } from '../constants/colors';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  useEffect(() => {
    let active = true;

    const createSessionFromUrl = async (url: string | null) => {
      if (!url || Platform.OS === 'web') return;

      const [beforeHash, fragment = ''] = url.split('#');
      const query = beforeHash.includes('?') ? beforeHash.split('?')[1] : '';
      const params = new URLSearchParams([query, fragment].filter(Boolean).join('&'));
      const errorDescription = params.get('error_description');
      if (errorDescription) {
        if (active) setMessage(errorDescription);
        return;
      }

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (!accessToken || !refreshToken) return;

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!active) return;
      if (error) {
        setMessage(error.message);
        return;
      }
      setMessage('');
    };

    const handleLinkError = (error: unknown) => {
      if (!active) return;
      setMessage(
        error instanceof Error
          ? error.message
          : 'The password reset link could not be opened.'
      );
    };

    void Linking.getInitialURL()
      .then(createSessionFromUrl)
      .catch(handleLinkError);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void createSessionFromUrl(url).catch(handleLinkError);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const canSubmit = useMemo(() => {
    return password.length >= 8 && password === confirmPassword && !loading;
  }, [confirmPassword, loading, password]);

  const handleUpdate = async () => {
    if (!canSubmit) return;

    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Password updated.');
    await supabase.auth.signOut({ scope: 'local' });
    router.replace('/(auth)/login');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: Colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
          <Text style={[styles.title, { color: Colors.text }]}>New Password</Text>
          <Text style={[styles.subtitle, { color: Colors.muted }]}>
            Choose a password with at least 8 characters.
          </Text>
          <TextInput
            placeholder="New password"
            placeholderTextColor={Colors.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={[styles.input, { color: Colors.text, borderColor: Colors.border }]}
          />
          <TextInput
            placeholder="Confirm password"
            placeholderTextColor={Colors.muted}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={[styles.input, { color: Colors.text, borderColor: Colors.border }]}
          />
          {!!message && (
            <Text style={[styles.message, { color: message.includes('updated') ? Colors.success : Colors.danger }]}>
              {message}
            </Text>
          )}
          <Pressable
            style={[
              styles.button,
              { backgroundColor: Colors.primary, opacity: canSubmit ? 1 : 0.55 },
            ]}
            onPress={handleUpdate}
            disabled={!canSubmit}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update Password</Text>}
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
    fontWeight: '900',
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
  message: {
    fontSize: 14,
    fontWeight: '700',
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
    fontWeight: '900',
  },
});
