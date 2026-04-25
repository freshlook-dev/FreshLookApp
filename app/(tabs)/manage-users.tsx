'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

type Role = 'owner' | 'manager' | 'staff';

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  is_active: boolean | null;
};

export default function ManageUsersScreen() {
  const { user } = useAuth();

  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const [myRole, setMyRole] = useState<Role | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [showModal, setShowModal] = useState(false);

  /* ---------------- INIT ---------------- */

  useEffect(() => {
    if (!user) return;

    loadUsers();
  }, [user]);

  const loadUsers = async () => {
    if (!user) return;

    setLoading(true);

    const { data: me } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!me || me.role !== 'owner') {
      router.replace('/(tabs)/profile');
      return;
    }

    setMyRole(me.role);

    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .order('full_name');

    setUsers(data ?? []);
    setLoading(false);
  };

  useAutoRefresh(loadUsers, {
    enabled: !!user,
    tables: ['profiles'],
    channelName: 'manage-users',
  });

  /* ---------------- ROLE CHANGE ---------------- */

  const requestChangeRole = (u: UserRow, newRole: Role) => {
    const message = `Ndrysho rolin e ${u.full_name ?? u.email} në ${newRole.toUpperCase()}?`;

    if (Platform.OS === 'web') {
      if (window.confirm(message)) confirmChange(u, newRole);
    } else {
      Alert.alert('Konfirmo', message, [
        { text: 'Anulo', style: 'cancel' },
        { text: 'Po', onPress: () => confirmChange(u, newRole) },
      ]);
    }
  };

  const confirmChange = async (u: UserRow, newRole: Role) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', u.id);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    await supabase.from('audit_logs').insert({
      actor_id: user!.id,
      action: 'CHANGE_ROLE',
      target_id: u.id,
      metadata: {
        from: u.role,
        to: newRole,
      },
    });

    setUsers((prev) =>
      prev.map((x) =>
        x.id === u.id ? { ...x, role: newRole } : x
      )
    );

    setShowModal(false);
    setSelectedUser(null);
  };

  const requestToggleActive = (u: UserRow) => {
    const isActive = u.is_active !== false;
    const nextActive = !isActive;

    if (u.id === user?.id && !nextActive) {
      Alert.alert('Nuk lejohet', 'Nuk mund ta deaktivizosh llogarine tende.');
      return;
    }

    const label = u.full_name ?? u.email;
    const message = nextActive
      ? `Aktivizo aksesin per ${label}?`
      : `Deaktivizo aksesin per ${label}? Ky perdorues nuk do te mund te hyje ne app.`;

    if (Platform.OS === 'web') {
      if (window.confirm(message)) confirmToggleActive(u, nextActive);
      return;
    }

    Alert.alert('Konfirmo', message, [
      { text: 'Anulo', style: 'cancel' },
      {
        text: nextActive ? 'Aktivizo' : 'Deaktivizo',
        style: nextActive ? 'default' : 'destructive',
        onPress: () => confirmToggleActive(u, nextActive),
      },
    ]);
  };

  const confirmToggleActive = async (u: UserRow, nextActive: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: nextActive })
      .eq('id', u.id);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    await supabase.from('audit_logs').insert({
      actor_id: user!.id,
      action: nextActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      target_id: u.id,
      metadata: {
        user: {
          email: u.email,
          full_name: u.full_name,
        },
        changed: {
          is_active: {
            old: u.is_active !== false,
            new: nextActive,
          },
        },
      },
    });

    setUsers((prev) =>
      prev.map((x) =>
        x.id === u.id ? { ...x, is_active: nextActive } : x
      )
    );
    setSelectedUser((prev) =>
      prev && prev.id === u.id ? { ...prev, is_active: nextActive } : prev
    );
  };

  /* ---------------- UI ---------------- */

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (myRole !== 'owner') return null;

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Text style={[styles.title, { color: Colors.text }]}>
        Menaxhimi i përdoruesve
      </Text>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: Colors.card }]}>
            <View style={styles.userInfo}>
              <Text style={[styles.name, { color: Colors.text }]}>
                {item.full_name ?? item.email}
              </Text>
              <Text style={[styles.meta, { color: Colors.muted }]}>
                {item.role.toUpperCase()} ·{' '}
                {item.is_active === false ? 'Jo aktiv' : 'Aktiv'}
              </Text>
            </View>

            <Pressable
              onPress={() => {
                setSelectedUser(item);
                setShowModal(true);
              }}
              style={styles.changeBtn}
            >
              <Text style={styles.changeBtnText}>Veprime</Text>
            </Pressable>
          </View>
        )}
      />

      {/* ================= MODAL ================= */}

      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: Colors.card }]}>
            {selectedUser && (
              <>
                <Text style={[styles.modalName, { color: Colors.text }]}>
                  {selectedUser.full_name ?? selectedUser.email}
                </Text>

                <Text style={{ color: Colors.muted, marginBottom: 16 }}>
                  Roli aktual: {selectedUser.role.toUpperCase()} ·{' '}
                  {selectedUser.is_active === false ? 'Jo aktiv' : 'Aktiv'}
                </Text>

                {(['staff', 'manager', 'owner'] as Role[]).map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => requestChangeRole(selectedUser, r)}
                    style={[
                      styles.roleOption,
                      r === selectedUser.role && {
                        borderColor: Colors.primary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleText,
                        { color: Colors.text },
                      ]}
                    >
                      {r.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}

                <Pressable
                  onPress={() => requestToggleActive(selectedUser)}
                  style={[
                    styles.dangerOption,
                    {
                      backgroundColor:
                        selectedUser.is_active === false ? '#2ECC71' : '#D64545',
                    },
                  ]}
                >
                  <Text style={styles.dangerOptionText}>
                    {selectedUser.is_active === false
                      ? 'Aktivizo aksesin'
                      : 'Deaktivizo aksesin'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setShowModal(false);
                    setSelectedUser(null);
                  }}
                  style={styles.cancelBtn}
                >
                  <Text style={{ color: '#fff', fontWeight: '800' }}>
                    Mbyll
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
    paddingRight: 12,
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  changeBtn: {
    backgroundColor: '#C9A24D',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  changeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* MODAL */

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '85%',
    borderRadius: 20,
    padding: 20,
  },
  modalName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  roleOption: {
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginBottom: 10,
    alignItems: 'center',
  },
  roleText: {
    fontSize: 15,
    fontWeight: '700',
  },
  dangerOption: {
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
    marginBottom: 10,
    alignItems: 'center',
  },
  dangerOptionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  cancelBtn: {
    marginTop: 10,
    backgroundColor: '#D64545',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
});
