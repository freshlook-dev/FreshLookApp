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
      Alert.alert('Mungojnë të dhëna', 'Plotësoni të gjitha fushat e fjalëkalimit.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Fjalëkalimi është i shkurtër', 'Përdorni të paktën 8 karaktere.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Fjalëkalimet nuk përputhen', 'Konfirmoni të njëjtin fjalëkalim të ri.');
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: currentPassword,
    });

    if (signInError) {
      setLoading(false);
      Alert.alert('Fjalëkalimi nuk është i saktë', 'Fjalëkalimi aktual është i gabuar.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      Alert.alert('Fjalëkalimi nuk u përditësua', error.message);
      return;
    }

    Alert.alert('Fjalëkalimi u ndryshua', 'Fjalëkalimi juaj u përditësua me sukses.', [
      { text: 'Në rregull', onPress: () => router.replace('/client/profile') },
    ]);
  };

  return (
    <ScrollView style={{ backgroundColor: Colors.background }} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.replace('/client/profile')}>
        <Ionicons name="chevron-back" size={22} color={Colors.text} />
        <Text style={[styles.backText, { color: Colors.text }]}>Kthehu mbrapa</Text>
      </Pressable>
      <ScreenHeader title="Ndrysho fjalëkalimin" subtitle="Konfirmoni fjalëkalimin aktual, pastaj zgjidhni një të ri." />
      <PremiumCard style={styles.card}>
        {[
          ['Fjalëkalimi aktual', currentPassword, setCurrentPassword],
          ['Fjalëkalimi i ri', newPassword, setNewPassword],
          ['Konfirmo fjalëkalimin e ri', confirmPassword, setConfirmPassword],
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
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Përditëso fjalëkalimin</Text>}
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
