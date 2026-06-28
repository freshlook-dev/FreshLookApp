import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
import { deleteCurrentAccount } from '../../utils/deleteAccount';

export default function ClientSettingsScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const Colors = useClientColors();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const canDeleteAccount = !!profile?.email && deleteEmail.trim() === profile.email;

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile?.full_name, profile?.phone]);

  const saveProfile = async () => {
    if (!user?.id || !fullName.trim() || !phone.trim()) {
      Alert.alert('Mungojnë të dhëna', 'Emri dhe numri i telefonit janë të detyrueshëm.');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() })
      .eq('id', user.id);
    setSaving(false);

    if (error) {
      Alert.alert('Nuk u ruajt', error.message);
      return;
    }

    await refreshProfile();
    Alert.alert('U ruajt', 'Të dhënat e llogarisë u përditësuan.');
  };

  const changePhoto = async () => {
    if (!user?.id || uploading) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Kërkohet leje', 'Lejoni qasjen te fotot për të zgjedhur një foto profili.');
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
      Alert.alert('Fotoja nuk u ngarkua', error?.message ?? 'Ju lutemi provoni përsëri.');
    } finally {
      setUploading(false);
    }
  };

  const deleteAccount = async () => {
    if (deletingAccount) return;

    try {
      setDeletingAccount(true);
      await deleteCurrentAccount();
      setDeleteModalVisible(false);
      router.replace('/(auth)/login');
    } catch (error: any) {
      Alert.alert('Llogaria nuk u fshi', error?.message ?? 'Ju lutemi provoni përsëri më vonë.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const openDeleteModal = () => {
    setDeleteEmail('');
    setDeleteModalVisible(true);
  };

  return (
    <ScrollView style={{ backgroundColor: Colors.background }} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.replace('/client/profile')}>
        <Ionicons name="chevron-back" size={22} color={Colors.text} />
        <Text style={[styles.backText, { color: Colors.text }]}>Kthehu mbrapa</Text>
      </Pressable>

      <ScreenHeader title="Cilësimet" subtitle="Menaxhoni llogarinë dhe preferencat e aplikacionit." />

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
          <Text style={styles.photoButtonText}>{uploading ? 'Duke u ngarkuar...' : 'Ndrysho foton'}</Text>
        </Pressable>
      </PremiumCard>

      <Text style={[styles.label, { color: Colors.primary }]}>Të dhënat e llogarisë</Text>
      <PremiumCard style={styles.card}>
        <TextInput
          style={[styles.input, { borderColor: Colors.border, color: Colors.text, backgroundColor: Colors.surface }]}
          placeholder="Emri dhe mbiemri"
          placeholderTextColor={Colors.muted}
          value={fullName}
          onChangeText={setFullName}
        />
        <TextInput
          style={[styles.input, { borderColor: Colors.border, color: Colors.text, backgroundColor: Colors.surface }]}
          placeholder="Numri i telefonit"
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
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Ruaj ndryshimet</Text>}
        </Pressable>
      </PremiumCard>

      <Text style={[styles.label, { color: Colors.primary }]}>Siguria dhe preferencat</Text>
      <PremiumCard style={styles.card}>
        <Pressable style={styles.settingRow} onPress={() => router.push('/client/change-password')}>
          <Ionicons name="lock-closed-outline" size={21} color={Colors.primary} />
          <Text style={[styles.settingText, { color: Colors.text }]}>Ndrysho fjalëkalimin</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
        </Pressable>
        <View style={[styles.divider, { backgroundColor: Colors.border }]} />
        <View style={styles.settingRow}>
          <Ionicons name={theme === 'dark' ? 'moon-outline' : 'sunny-outline'} size={21} color={Colors.primary} />
          <Text style={[styles.settingText, { color: Colors.text }]}>Pamje e errët</Text>
          <Switch value={theme === 'dark'} onValueChange={toggleTheme} />
        </View>
      </PremiumCard>

      <Pressable
        style={[styles.deleteAccount, { borderColor: Colors.danger, opacity: deletingAccount ? 0.65 : 1 }]}
        onPress={openDeleteModal}
        disabled={deletingAccount}
      >
        {deletingAccount ? (
          <ActivityIndicator color={Colors.danger} />
        ) : (
          <>
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            <Text style={[styles.signOutText, { color: Colors.danger }]}>Fshi llogarinë</Text>
          </>
        )}
      </Pressable>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
            <Text style={[styles.modalTitle, { color: Colors.danger }]}>Fshi llogarinë?</Text>
            <Text style={[styles.modalText, { color: Colors.muted }]}>
              Për ta konfirmuar, shkruani email-in tuaj saktësisht si më poshtë.
            </Text>
            <Text style={[styles.emailHint, { color: Colors.text }]}>{profile?.email}</Text>
            <TextInput
              value={deleteEmail}
              onChangeText={setDeleteEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="Shkruani email-in"
              placeholderTextColor={Colors.muted}
              style={[
                styles.emailInput,
                {
                  borderColor: canDeleteAccount ? Colors.danger : Colors.border,
                  backgroundColor: Colors.surface,
                  color: Colors.text,
                },
              ]}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setDeleteModalVisible(false)}
                style={[styles.modalButton, { backgroundColor: Colors.surface }]}
              >
                <Text style={[styles.modalCancelText, { color: Colors.text }]}>Anulo</Text>
              </Pressable>
              <Pressable
                onPress={() => void deleteAccount()}
                disabled={!canDeleteAccount || deletingAccount}
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: Colors.danger,
                    opacity: canDeleteAccount && !deletingAccount ? 1 : 0.45,
                  },
                ]}
              >
                {deletingAccount ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalDeleteText}>Fshi</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  deleteAccount: { borderWidth: 1, borderRadius: 16, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 12 },
  signOutText: { fontSize: 15, fontWeight: '800' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 430,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  modalText: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  emailHint: { fontSize: 14, fontWeight: '800', marginBottom: 10 },
  emailInput: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 14,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '800' },
  modalDeleteText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
