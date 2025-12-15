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
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

type Role = 'owner' | 'manager' | 'staff';

type UserRow = {
  id: string;
  email: string;
  role: Role;
};

export default function ManageUsersScreen() {
  const { user } = useAuth();

  const [myRole, setMyRole] = useState<Role | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  /* ---------------- LOAD OWNER ROLE ---------------- */

  useEffect(() => {
    if (!user) return;

    const init = async () => {
      setLoading(true);

      // 1️⃣ Load MY role
      const { data: me, error: meError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (meError || !me) {
        Alert.alert('Error', 'Failed to load your role');
        setLoading(false);
        return;
      }

      // ❌ Not owner → kick out
      if (me.role !== 'owner') {
        router.replace('/(tabs)/profile');
        return;
      }

      setMyRole(me.role);

      // 2️⃣ Load all OTHER users
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role')
        .neq('id', user.id)
        .order('email');

      if (error) {
        Alert.alert('Error', error.message);
        setLoading(false);
        return;
      }

      setUsers(data ?? []);
      setLoading(false);
    };

    init();
  }, [user]);

  /* ---------------- CHANGE ROLE ---------------- */

  const confirmChange = (u: UserRow) => {
    const newRole: Role =
      u.role === 'staff' ? 'manager' : 'staff';

    const message = `Change ${u.email} to ${newRole.toUpperCase()}?`;

    if (Platform.OS === 'web') {
      const ok = window.confirm(message);
      if (ok) updateRole(u.id, newRole);
    } else {
      Alert.alert(
        'Confirm role change',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: () => updateRole(u.id, newRole),
          },
        ]
      );
    }
  };

  const updateRole = async (userId: string, role: Role) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    // Reload list
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, role } : u
      )
    );
  };

  /* ---------------- UI ---------------- */

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (myRole !== 'owner') {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Users</Text>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.email}>{item.email}</Text>

            <Pressable onPress={() => confirmChange(item)}>
              <Text style={styles.roleBtn}>
                {item.role.toUpperCase()} → CHANGE
              </Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F4',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
    color: '#2B2B2B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  email: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2B2B2B',
  },
  roleBtn: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#C9A24D',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
