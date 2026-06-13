import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { router } from 'expo-router';

import { PremiumCard, ScreenHeader, useClientColors } from '../../components/ClientUI';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../context/supabase';

export default function ClientSettingsScreen() {
  const { user, profile, refreshProfile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const Colors = useClientColors();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile?.full_name, profile?.phone]);

  const saveProfile = async () => {
    if (!user?.id || !fullName.trim() || !phone.trim()) {
      Alert.alert('Missing information', 'Name and phone number are required.');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() })
      .eq('id', user.id);
    setSaving(false);

    if (error) {
      Alert.alert('Unable to save', error.message);
      return;
    }

    await refreshProfile();
    Alert.alert('Saved', 'Your account information was updated.');
  };

  const changePhoto = async () => {
    if (!user?.id || uploading) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo library access to choose a profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (result.canceled || !result.assets[0]) return;

    try {
      setUploading(true);
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 512, height: 512 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      const bytes = await fetch(manipulated.uri).then((response) => response.arrayBuffer());
      const filePath = `${user.id}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, bytes, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

      if (profileError) throw profileError;
      await refreshProfile();
    } catch (error: any) {
      Alert.alert('Photo upload failed', error?.message ?? 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: Colors.background }} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color={Colors.text} />
        <Text style={[styles.backText, { color: Colors.text }]}>Profile</Text>
      </Pressable>

      <ScreenHeader title="Settings" subtitle="Manage your account and app preferences." />

      <PremiumCard elevated style={styles.photoCard}>
        <Image
          source={
            profile?.avatar_url
              ? { uri: profile.avatar_url }
              : require('../../assets/images/avatar-placeholder.png')
          }
          style={styles.avatar}
        />
        <Pressable style={[styles.photoButton, { backgroundColor: Colors.primary }]} onPress={changePhoto}>
          {uploading ? <ActivityIndicator color="#fff" /> : <Ionicons name="camera-outline" size={18} color="#fff" />}
          <Text style={styles.photoButtonText}>{uploading ? 'Uploading...' : 'Change photo'}</Text>
        </Pressable>
      </PremiumCard>

      <Text style={[styles.label, { color: Colors.primary }]}>Account information</Text>
      <PremiumCard style={styles.card}>
        <TextInput
          style={[styles.input, { borderColor: Colors.border, color: Colors.text, backgroundColor: Colors.surface }]}
          placeholder="Full name"
          placeholderTextColor={Colors.muted}
          value={fullName}
          onChangeText={setFullName}
        />
        <TextInput
          style={[styles.input, { borderColor: Colors.border, color: Colors.text, backgroundColor: Colors.surface }]}
          placeholder="Phone number"
          placeholderTextColor={Colors.muted}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <View style={[styles.readOnly, { borderColor: Colors.border }]}>
          <Text style={[styles.readOnlyLabel, { color: Colors.muted }]}>Email</Text>
          <Text style={[styles.readOnlyValue, { color: Colors.text }]}>{profile?.email}</Text>
        </View>
        <Pressable style={[styles.primaryButton, { backgroundColor: Colors.primary }]} onPress={saveProfile} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save changes</Text>}
        </Pressable>
      </PremiumCard>

      <Text style={[styles.label, { color: Colors.primary }]}>Security and preferences</Text>
      <PremiumCard style={styles.card}>
        <Pressable style={styles.settingRow} onPress={() => router.push('/client/change-password')}>
          <Ionicons name="lock-closed-outline" size={21} color={Colors.primary} />
          <Text style={[styles.settingText, { color: Colors.text }]}>Change password</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
        </Pressable>
        <View style={[styles.divider, { backgroundColor: Colors.border }]} />
        <View style={styles.settingRow}>
          <Ionicons name={theme === 'dark' ? 'moon-outline' : 'sunny-outline'} size={21} color={Colors.primary} />
          <Text style={[styles.settingText, { color: Colors.text }]}>Dark mode</Text>
          <Switch value={theme === 'dark'} onValueChange={toggleTheme} />
        </View>
      </PremiumCard>

      <Pressable style={[styles.signOut, { borderColor: Colors.danger }]} onPress={logout}>
        <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        <Text style={[styles.signOutText, { color: Colors.danger }]}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 120 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backText: { fontSize: 15, fontWeight: '700' },
  photoCard: { alignItems: 'center', gap: 14, marginBottom: 24 },
  avatar: { width: 112, height: 112, borderRadius: 56 },
  photoButton: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 14 },
  photoButtonText: { color: '#fff', fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
  card: { gap: 12, marginBottom: 24 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15 },
  readOnly: { borderWidth: 1, borderRadius: 14, padding: 14 },
  readOnlyLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  readOnlyValue: { fontSize: 15, fontWeight: '600' },
  primaryButton: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  settingRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingText: { flex: 1, fontSize: 15, fontWeight: '700' },
  divider: { height: 1 },
  signOut: { borderWidth: 1, borderRadius: 16, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  signOutText: { fontSize: 15, fontWeight: '800' },
});
