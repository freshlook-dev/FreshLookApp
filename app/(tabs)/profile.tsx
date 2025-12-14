'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Pressable,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../context/supabase';

type Role = 'owner' | 'manager' | 'staff';

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
};

export default function ProfileTab() {
  const { user, loading: authLoading, logout } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Access code generator
  const [selectedRole, setSelectedRole] =
    useState<'staff' | 'manager'>('staff');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [creatingCode, setCreatingCode] = useState(false);

  // Broadcast notification
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [sendingNotice, setSendingNotice] = useState(false);

  /* ✅ LOAD PROFILE ONLY WHEN USER EXISTS */
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    loadProfile();
  }, [user, authLoading]);

  const loadProfile = async () => {
    setLoading(true);

    const { data: me } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', user!.id)
      .single();

    if (!me) {
      setLoading(false);
      return;
    }

    setProfile(me);

    if (me.role === 'owner') {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .order('email');

      setUsers(data ?? []);
    } else {
      setUsers([]);
    }

    setLoading(false);
  };

  const changeUserRole = async (targetUserId: string, newRole: Role) => {
    Alert.alert(
      'Confirm role change',
      `Set this user as ${newRole.toUpperCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('profiles')
              .update({ role: newRole })
              .eq('id', targetUserId);

            loadProfile();
          },
        },
      ]
    );
  };

  const generateFiveDigitCode = () =>
    Math.floor(10000 + Math.random() * 90000).toString();

  const createAccessCode = async () => {
    setCreatingCode(true);
    setGeneratedCode(null);

    const code = generateFiveDigitCode();

    const { data, error } = await supabase
      .from('access_codes')
      .insert({
        code,
        role: selectedRole,
        created_by: profile!.id,
      })
      .select()
      .single();

    if (!error && data) {
      setGeneratedCode(code);
    }

    setCreatingCode(false);
  };

  const sendBroadcastNotification = async () => {
    if (!noticeTitle.trim() || !noticeMessage.trim()) {
      Alert.alert('Error', 'Title and message are required');
      return;
    }

    setSendingNotice(true);

    await supabase.rpc('owner_broadcast_notification', {
      p_title: noticeTitle.trim(),
      p_message: noticeMessage.trim(),
    });

    setNoticeTitle('');
    setNoticeMessage('');
    setSendingNotice(false);

    Alert.alert('Sent', 'Notification sent to all users ✅');
  };

  /* ✅ FINAL LOGOUT — NOTHING ELSE */
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  if (authLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#C9A24D" />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text>Profile not found</Text>
      </View>
    );
  }

  const isOwner = profile.role === 'owner';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>My Profile</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{profile.email}</Text>

        <Text style={[styles.label, { marginTop: 12 }]}>Full name</Text>
        <Text style={styles.value}>
          {profile.full_name || 'Not set'}
        </Text>

        <Text style={[styles.label, { marginTop: 12 }]}>Role</Text>
        <Text style={styles.value}>{profile.role.toUpperCase()}</Text>
      </View>

      {isOwner && (
        <>
          <Text style={styles.sectionTitle}>Users</Text>

          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.userEmail}>{item.email}</Text>

                {item.id === profile.id ? (
                  <Text style={styles.selfLabel}>
                    {item.role.toUpperCase()} (You)
                  </Text>
                ) : (
                  <Pressable
                    onPress={() =>
                      changeUserRole(
                        item.id,
                        item.role === 'staff'
                          ? 'manager'
                          : 'staff'
                      )
                    }
                  >
                    <Text style={styles.roleButton}>
                      {item.role.toUpperCase()} → CHANGE
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          />
        </>
      )}

      <Pressable onPress={handleLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </ScrollView>
  );
}

/* STYLES UNCHANGED */
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#FAF8F4',
    padding: 20,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2B2B2B',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginVertical: 14,
    color: '#2B2B2B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  label: { fontSize: 12, color: '#7A7A7A' },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2B2B2B',
    marginTop: 4,
  },
  userEmail: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2B2B2B',
  },
  selfLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#C9A24D',
    fontWeight: '600',
  },
  roleButton: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#C9A24D',
  },
  logoutButton: {
    marginTop: 30,
    backgroundColor: '#D64545',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { marginTop: 10, color: '#7A7A7A' },
});
