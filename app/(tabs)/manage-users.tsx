'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';

type Role = 'owner' | 'manager' | 'staff';

type UserProfile = {
  id: string;
  email: string;
  role: Role;
};

export default function ManageUsersScreen() {
  const { user } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadUsers();
  }, [user]);

  const loadUsers = async () => {
    setLoading(true);

    const { data } = await supabase
      .from('profiles')
      .select('id, email, role')
      .neq('id', user!.id)
      .order('email');

    setUsers(data ?? []);
    setLoading(false);
  };

  const changeRole = (target: UserProfile) => {
    const newRole: Role =
      target.role === 'staff' ? 'manager' : 'staff';

    Alert.alert(
      'Change role',
      `Change ${target.email} to ${newRole.toUpperCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            await supabase
              .from('profiles')
              .update({ role: newRole })
              .eq('id', target.id);

            loadUsers();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
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

            <Pressable onPress={() => changeRole(item)}>
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
