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

type Role = 'owner' | 'manager' | 'staff';

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
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

    const init = async () => {
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
        .select('id, email, full_name, role')
        .order('full_name');

      setUsers(data ?? []);
      setLoading(false);
    };

    init();
  }, [user]);

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
            <Text style={[styles.name, { color: Colors.text }]}>
              {item.full_name ?? item.email}
            </Text>

            <Pressable
              onPress={() => {
                setSelectedUser(item);
                setShowModal(true);
              }}
              style={styles.changeBtn}
            >
              <Text style={styles.changeBtnText}>Ndrysho rolin</Text>
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
                  Roli aktual: {selectedUser.role.toUpperCase()}
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
  cancelBtn: {
    marginTop: 10,
    backgroundColor: '#D64545',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
});
