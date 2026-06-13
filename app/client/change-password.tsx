import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { PremiumCard, ScreenHeader, useClientColors } from '../../components/ClientUI';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../context/supabase';

export default function ClientChangePasswordScreen() {
  const { user } = useAuth();
  const Colors = useClientColors();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const updatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Missing information', 'Complete all password fields.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Confirm the same new password.');
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: currentPassword,
    });

    if (signInError) {
      setLoading(false);
      Alert.alert('Incorrect password', 'Your current password is incorrect.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      Alert.alert('Unable to update password', error.message);
      return;
    }

    Alert.alert('Password updated', 'Your password was changed successfully.', [
      { text: 'OK', onPress: () => router.replace('/client/settings') },
    ]);
  };

  return (
    <ScrollView style={{ backgroundColor: Colors.background }} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color={Colors.text} />
        <Text style={[styles.backText, { color: Colors.text }]}>Settings</Text>
      </Pressable>
      <ScreenHeader title="Change password" subtitle="Confirm your current password, then choose a new one." />
      <PremiumCard style={styles.card}>
        {[
          ['Current password', currentPassword, setCurrentPassword],
          ['New password', newPassword, setNewPassword],
          ['Confirm new password', confirmPassword, setConfirmPassword],
        ].map(([placeholder, value, setter]) => (
          <TextInput
            key={placeholder as string}
            style={[styles.input, { borderColor: Colors.border, color: Colors.text, backgroundColor: Colors.surface }]}
            placeholder={placeholder as string}
            placeholderTextColor={Colors.muted}
            secureTextEntry
            value={value as string}
            onChangeText={setter as (value: string) => void}
          />
        ))}
        <Pressable style={[styles.button, { backgroundColor: Colors.primary }]} onPress={updatePassword} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update password</Text>}
        </Pressable>
      </PremiumCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22, paddingBottom: 100 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backText: { fontSize: 15, fontWeight: '700' },
  card: { gap: 13 },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15 },
  button: { minHeight: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
