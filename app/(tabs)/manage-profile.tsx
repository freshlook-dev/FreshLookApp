import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { DarkColors, LightColors } from '../../constants/colors';
import { deleteCurrentAccount } from '../../utils/deleteAccount';

type Role = 'owner' | 'manager' | 'staff' | 'client';

const roleLabel = (role?: Role | null) => {
  if (role === 'owner') return 'Pronar';
  if (role === 'manager') return 'Menaxher';
  if (role === 'staff') return 'Staf';
  return 'Klient';
};

export default function ManageProfileScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;
  const [deleting, setDeleting] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const canDelete = !!profile?.email && deleteEmail.trim() === profile.email;

  const deleteAccount = async () => {
    if (deleting) return;

    try {
      setDeleting(true);
      await deleteCurrentAccount();
      setDeleteModalVisible(false);
      router.replace('/(auth)/login');
    } catch (error: any) {
      Alert.alert(
        'Llogaria nuk u fshi',
        error?.message ?? 'Ju lutemi provoni përsëri më vonë.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteModal = () => {
    setDeleteEmail('');
    setDeleteModalVisible(true);
  };

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.container}
    >
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={[styles.backText, { color: Colors.primary }]}>Kthehu</Text>
      </Pressable>

      <Text style={[styles.title, { color: Colors.text }]}>Menaxho profilin</Text>
      <Text style={[styles.subtitle, { color: Colors.muted }]}>
        Rishiko të dhënat e llogarisë dhe veprimet e rëndësishme në një vend të sigurt.
      </Text>

      <View style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <Text style={[styles.label, { color: Colors.muted }]}>Emri</Text>
        <Text style={[styles.value, { color: Colors.text }]}>
          {profile?.full_name || 'Nuk është vendosur'}
        </Text>

        <Text style={[styles.label, { color: Colors.muted }]}>Email</Text>
        <Text style={[styles.value, { color: Colors.text }]}>{profile?.email}</Text>

        <Text style={[styles.label, { color: Colors.muted }]}>Roli</Text>
        <Text style={[styles.value, { color: Colors.text }]}>
          {roleLabel(profile?.role as Role)}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <ManageRow
          title="Ndrysho fjalëkalimin"
          subtitle="Përditëso fjalëkalimin kur të duhet më shumë siguri."
          colors={Colors}
          onPress={() => router.push('../(tabs)/change-password')}
        />
      </View>

      <View style={[styles.tipCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <Text style={[styles.tipTitle, { color: Colors.text }]}>Këshillë sigurie</Text>
        <Text style={[styles.tipText, { color: Colors.muted }]}>
          Mbajeni fjalëkalimin privat dhe dilni nga llogaria nëse pajisja përdoret edhe nga dikush tjetër.
        </Text>
      </View>

      <View style={[styles.dangerCard, { borderColor: Colors.danger }]}>
        <Text style={[styles.dangerTitle, { color: Colors.danger }]}>Zona e kujdesit</Text>
        <Text style={[styles.dangerText, { color: Colors.muted }]}>
          Fshirja e llogarisë është veprim i përhershëm. Prandaj është vendosur këtu, larg ekranit kryesor.
        </Text>
        <Pressable
          onPress={openDeleteModal}
          disabled={deleting}
          style={[
            styles.deleteButton,
            { backgroundColor: Colors.danger, opacity: deleting ? 0.65 : 1 },
          ]}
        >
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteText}>Fshi llogarinë</Text>
          )}
        </Pressable>
      </View>

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
                  borderColor: canDelete ? Colors.danger : Colors.border,
                  backgroundColor: Colors.background,
                  color: Colors.text,
                },
              ]}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setDeleteModalVisible(false)}
                style={[styles.modalButton, { backgroundColor: Colors.background }]}
              >
                <Text style={[styles.modalCancelText, { color: Colors.text }]}>Anulo</Text>
              </Pressable>
              <Pressable
                onPress={() => void deleteAccount()}
                disabled={!canDelete || deleting}
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: Colors.danger,
                    opacity: canDelete && !deleting ? 1 : 0.45,
                  },
                ]}
              >
                {deleting ? (
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

type ManageRowProps = {
  title: string;
  subtitle: string;
  colors: typeof LightColors;
  onPress: () => void;
};

function ManageRow({ title, subtitle, colors, onPress }: ManageRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.background : 'transparent' },
      ]}
    >
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowSubtitle, { color: colors.muted }]}>{subtitle}</Text>
      </View>
      <Text style={[styles.arrow, { color: colors.muted }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 120,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 8,
  },
  backText: {
    fontSize: 15,
    fontWeight: '800',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 8,
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 10,
    paddingHorizontal: 8,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 8,
    marginTop: 3,
    marginBottom: 7,
  },
  row: {
    minHeight: 68,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  rowSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  arrow: {
    fontSize: 25,
    fontWeight: '300',
  },
  tipCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 5,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 19,
  },
  dangerCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  dangerText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 14,
  },
  deleteButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
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
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  emailHint: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  emailInput: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '800',
  },
  modalDeleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
