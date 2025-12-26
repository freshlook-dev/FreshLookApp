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
import { supabase } from '../../context/supabase';

/* ✅ THEME */
import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);

  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const handleSignUp = async () => {
    if (!email || !password || !fullName || !accessCode) {
      Alert.alert('Error', 'All fields are required');
      return;
    }

    setLoading(true);

    try {
      /* 1️⃣ VALIDATE ACCESS CODE */
      const { data: codeData, error: codeError } = await supabase
        .from('access_codes')
        .select('*')
        .eq('code', accessCode.trim())
        .eq('used', false)
        .maybeSingle();

      if (codeError || !codeData) {
        setLoading(false);
        Alert.alert('Invalid code', 'Access code is invalid or already used');
        return;
      }

      /* 2️⃣ CREATE AUTH USER */
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email,
          password,
        });

      if (signUpError || !signUpData.user) {
        setLoading(false);
        Alert.alert('Signup failed', signUpError?.message || 'Unknown error');
        return;
      }

      const userId = signUpData.user.id;

      /* 3️⃣ UPSERT PROFILE */
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: email.toLowerCase().trim(),
          full_name: fullName.trim(),
          role: codeData.role,
        });

      if (profileError) {
        setLoading(false);
        Alert.alert('Profile error', profileError.message);
        return;
      }

      /* 4️⃣ MARK ACCESS CODE AS USED */
      const { error: codeUpdateError } = await supabase
        .from('access_codes')
        .update({ used: true })
        .eq('id', codeData.id);

      if (codeUpdateError) {
        setLoading(false);
        Alert.alert('Access code error', codeUpdateError.message);
        return;
      }

      /* 5️⃣ AUDIT LOG */
      await supabase.from('audit_logs').insert({
        actor_id: userId,
        action: 'USE_ACCESS_CODE',
        target_id: codeData.id,
      });

      Alert.alert('Success', 'Account created successfully');
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
        contentContainerStyle={[
          styles.container,
          { backgroundColor: Colors.background },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
            Join Fresh Look internal platform
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: Colors.card }]}>
          <TextInput
            placeholder="Full Name"
            placeholderTextColor={Colors.muted}
            value={fullName}
            onChangeText={setFullName}
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

          <TextInput
            placeholder="5-digit Access Code"
            placeholderTextColor={Colors.muted}
            keyboardType="number-pad"
            maxLength={5}
            value={accessCode}
            onChangeText={setAccessCode}
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
});
