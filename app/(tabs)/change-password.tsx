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
        ? window.alert('Të gjitha fushat duhet të plotësohen')
        : Alert.alert('Error', 'Të gjitha fushat duhet të plotësohen');
      return;
    }

    if (newPassword.length < 6) {
      Platform.OS === 'web'
        ? window.alert('Fjalëkalimi duhet të ketë të paktën 6 shkronja ose numra')
        : Alert.alert('Error', 'Fjalëkalimi duhet të ketë të paktën 6 shkronja ose numra');
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
          ? window.alert('Fjalëkalimi i vjetër është shkruar gabim')
          : Alert.alert('Error', 'Fjalëkalimi i vjetër është shkruar gabim');
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
        window.alert('Fjalëkalimi u ndryshua me sukses!');
        router.replace('/(tabs)/profile');
      } else {
        Alert.alert('Sukses', 'Fjalëkalimi u ndryshua me sukses!', [
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
        Ndrysho Fjalëkalimin
      </Text>

      <TextInput
        placeholder="Fjalëkalimi i vjetër"
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
        placeholder="Fjalëkalimi i ri"
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
        placeholder="Konfirmo Fjalëkalimin e ri"
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
          <Text style={styles.buttonText}>Përditëso Fjalëkalimin</Text>
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
