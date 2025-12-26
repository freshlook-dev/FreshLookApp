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

import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

type Role = 'owner' | 'manager' | 'staff';

type UserRow = {
  id: string;
  email: string;
  role: Role;
};

export default function ManageUsersScreen() {
  const { user } = useAuth();

  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const [myRole, setMyRole] = useState<Role | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  /* ---------------- LOAD OWNER ROLE ---------------- */

  useEffect(() => {
    if (!user) return;

    const init = async () => {
      setLoading(true);

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

      if (me.role !== 'owner') {
        router.replace('/(tabs)/profile');
        return;
      }

      setMyRole(me.role);

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
      if (ok) updateRole(u, newRole);
    } else {
      Alert.alert(
        'Confirm role change',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: () => updateRole(u, newRole),
          },
        ]
      );
    }
  };

  const updateRole = async (target: UserRow, newRole: Role) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', target.id);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    await supabase.from('audit_logs').insert({
      actor_id: user!.id,
      action: 'CHANGE_ROLE',
      target_id: target.id,
      details: {
        from: target.role,
        to: newRole,
      },
    });

    setUsers((prev) =>
      prev.map((u) =>
        u.id === target.id ? { ...u, role: newRole } : u
      )
    );
  };

  /* ---------------- UI ---------------- */

  if (loading) {
    return (
      <View
        style={[styles.center, { backgroundColor: Colors.background }]}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (myRole !== 'owner') {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: Colors.background },
      ]}
    >
      <Text style={[styles.title, { color: Colors.text }]}>
        Manage Users
      </Text>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              { backgroundColor: Colors.card },
            ]}
          >
            <Text style={[styles.email, { color: Colors.text }]}>
              {item.email}
            </Text>

            <Pressable onPress={() => confirmChange(item)}>
              <Text
                style={[
                  styles.roleBtn,
                  { color: Colors.primary },
                ]}
              >
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
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  email: {
    fontSize: 15,
    fontWeight: '600',
  },
  roleBtn: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
