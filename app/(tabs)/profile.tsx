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
import { router } from 'expo-router';

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
  const { user, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Access code generator (Owner only)
  const [selectedRole, setSelectedRole] =
    useState<'staff' | 'manager'>('staff');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [creatingCode, setCreatingCode] = useState(false);

  // Owner broadcast notification
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [sendingNotice, setSendingNotice] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/(auth)/login');
      return;
    }
    if (user) loadProfile();
  }, [user, authLoading]);

  const loadProfile = async () => {
    setLoading(true);

    const { data: me, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', user!.id)
      .single();

    if (!me || error) {
      setLoading(false);
      return;
    }

    setProfile(me);

    if (me.role === 'owner') {
      const { data: allUsers } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .order('email');

      setUsers(allUsers ?? []);
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

            await supabase.from('audit_logs').insert({
              actor_id: profile!.id,
              action: 'CHANGE_ROLE',
              target_id: targetUserId,
            });

            loadProfile();
          },
        },
      ]
    );
  };

  const generateFiveDigitCode = () =>
    Math.floor(10000 + Math.random() * 90000).toString();

  const createAccessCode = async () => {
    try {
      setCreatingCode(true);
      setGeneratedCode(null);

      const code = generateFiveDigitCode();

      const { data, error } = await supabase
        .from('access_codes')
        .insert({ code, role: selectedRole, created_by: profile!.id })
        .select()
        .single();

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      await supabase.from('audit_logs').insert({
        actor_id: profile!.id,
        action: 'CREATE_ACCESS_CODE',
        target_id: data.id,
      });

      setGeneratedCode(code);
    } catch {
      Alert.alert('Error', 'Failed to generate access code');
    } finally {
      setCreatingCode(false);
    }
  };

  const sendBroadcastNotification = async () => {
    if (!noticeTitle.trim() || !noticeMessage.trim()) {
      Alert.alert('Error', 'Title and message are required');
      return;
    }

    try {
      setSendingNotice(true);

      const { error } = await supabase.rpc(
        'owner_broadcast_notification',
        {
          p_title: noticeTitle.trim(),
          p_message: noticeMessage.trim(),
        }
      );

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      await supabase.from('audit_logs').insert({
        actor_id: profile!.id,
        action: 'OWNER_BROADCAST_NOTIFICATION',
      });

      setNoticeTitle('');
      setNoticeMessage('');
      Alert.alert('Sent', 'Notification sent to all users ✅');
    } catch {
      Alert.alert('Error', 'Failed to send notification');
    } finally {
      setSendingNotice(false);
    }
  };

  const logout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
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
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>My Profile</Text>

      {/* BASIC INFO */}
      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{profile.email}</Text>

        <Text style={[styles.label, { marginTop: 12 }]}>
          Full name
        </Text>
        <Text style={styles.value}>
          {profile.full_name || 'Not set'}
        </Text>

        <Text style={[styles.label, { marginTop: 12 }]}>
          Role
        </Text>
        <Text
          style={[
            styles.value,
            isOwner ? styles.owner : styles.staff,
          ]}
        >
          {profile.role.toUpperCase()}
        </Text>
      </View>

      {/* OWNER ONLY */}
      {isOwner && (
        <>
          <Text style={styles.sectionTitle}>Users</Text>

          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const isSelf = item.id === profile.id;

              return (
                <View style={styles.card}>
                  <Text style={styles.userEmail}>
                    {item.email}
                  </Text>

                  {isSelf ? (
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
              );
            }}
          />

          <Text style={styles.sectionTitle}>
            Generate Access Code
          </Text>

          <View style={styles.card}>
            <View style={styles.roleRow}>
              {(['staff', 'manager'] as const).map(
                (role) => (
                  <Pressable
                    key={role}
                    onPress={() => setSelectedRole(role)}
                    style={[
                      styles.roleOption,
                      selectedRole === role &&
                        styles.roleOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleOptionText,
                        selectedRole === role &&
                          styles.roleOptionTextActive,
                      ]}
                    >
                      {role.toUpperCase()}
                    </Text>
                  </Pressable>
                )
              )}
            </View>

            <Pressable
              onPress={createAccessCode}
              disabled={creatingCode}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>
                {creatingCode
                  ? 'Generating…'
                  : 'Generate Code'}
              </Text>
            </Pressable>

            {generatedCode && (
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>
                  Access Code
                </Text>
                <Text style={styles.codeValue}>
                  {generatedCode}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>
            Send Notification
          </Text>

          <View style={styles.card}>
            <TextInput
              value={noticeTitle}
              onChangeText={setNoticeTitle}
              placeholder="Title"
              style={styles.input}
            />

            <TextInput
              value={noticeMessage}
              onChangeText={setNoticeMessage}
              placeholder="Message"
              style={[
                styles.input,
                { height: 100, textAlignVertical: 'top' },
              ]}
              multiline
            />

            <Pressable
              onPress={sendBroadcastNotification}
              disabled={sendingNotice}
              style={[
                styles.primaryButton,
                { marginTop: 12 },
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {sendingNotice
                  ? 'Sending…'
                  : 'Send to All Users'}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* LOGOUT */}
      <Pressable
        onPress={logout}
        style={styles.logoutButton}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ---------------- STYLES ---------------- */

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
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  label: {
    fontSize: 12,
    color: '#7A7A7A',
  },

  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2B2B2B',
    marginTop: 4,
  },

  owner: {
    color: '#C9A24D',
  },

  staff: {
    color: '#2B2B2B',
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

  roleRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },

  roleOption: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6D3A3',
    marginRight: 8,
    alignItems: 'center',
  },

  roleOptionActive: {
    backgroundColor: '#C9A24D',
  },

  roleOptionText: {
    fontSize: 14,
    color: '#2B2B2B',
    fontWeight: '600',
  },

  roleOptionTextActive: {
    color: '#FFFFFF',
  },

  primaryButton: {
    backgroundColor: '#C9A24D',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },

  codeBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#000',
    alignItems: 'center',
  },

  codeLabel: {
    color: '#AAA',
    fontSize: 12,
  },

  codeValue: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 4,
    marginTop: 6,
  },

  input: {
    borderWidth: 1,
    borderColor: '#E6D3A3',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 10,
    backgroundColor: '#FAF8F4',
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
    backgroundColor: '#FAF8F4',
  },

  loadingText: {
    marginTop: 10,
    color: '#7A7A7A',
  },
});
