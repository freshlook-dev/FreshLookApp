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
} from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../context/supabase';

import { Colors, Spacing } from '../../constants/theme';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';

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
  const [selectedRole, setSelectedRole] = useState<'staff' | 'manager'>('staff');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    Alert.alert('Confirm role change', `Set this user as ${newRole.toUpperCase()}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('profiles').update({ role: newRole }).eq('id', targetUserId);

          await supabase.from('audit_logs').insert({
            actor_id: profile!.id,
            action: 'CHANGE_ROLE',
            target_id: targetUserId,
          });

          loadProfile();
        },
      },
    ]);
  };

  // ✅ 5-digit numeric code generator
  const generateFiveDigitCode = () => Math.floor(10000 + Math.random() * 90000).toString();

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

      const { error } = await supabase.rpc('owner_broadcast_notification', {
        p_title: noticeTitle.trim(),
        p_message: noticeMessage.trim(),
      });

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

  if (authLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: Spacing.sm }}>Loading...</Text>
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
    <View style={styles.container}>
      <SectionTitle>My Profile</SectionTitle>

      <Card>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{profile.email}</Text>
      </Card>

      <Card>
        <Text style={styles.label}>Full name</Text>
        <Text style={styles.value}>{profile.full_name || 'Not set'}</Text>
      </Card>

      <Card>
        <Text style={styles.label}>Role</Text>
        <Text style={[styles.value, isOwner ? styles.owner : styles.staff]}>
          {profile.role.toUpperCase()}
        </Text>
      </Card>

      {isOwner && (
        <>
          <SectionTitle>Users</SectionTitle>

          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelf = item.id === profile.id;

              return (
                <Card>
                  <Text style={styles.userEmail}>{item.email}</Text>

                  {isSelf ? (
                    <Text style={styles.selfLabel}>{item.role.toUpperCase()} (You)</Text>
                  ) : (
                    <Pressable
                      onPress={() =>
                        changeUserRole(
                          item.id,
                          item.role === 'owner'
                            ? 'staff'
                            : item.role === 'staff'
                            ? 'manager'
                            : 'staff'
                        )
                      }
                    >
                      <Text style={styles.roleButton}>{item.role.toUpperCase()} → CHANGE</Text>
                    </Pressable>
                  )}
                </Card>
              );
            }}
          />

          <SectionTitle>Generate Access Code</SectionTitle>

          <Card>
            <Text style={styles.label}>Role for new user</Text>

            <View style={styles.roleRow}>
              {(['staff', 'manager'] as const).map((role) => (
                <Pressable
                  key={role}
                  onPress={() => setSelectedRole(role)}
                  style={[styles.roleOption, selectedRole === role && styles.roleOptionActive]}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      selectedRole === role && styles.roleOptionTextActive,
                    ]}
                  >
                    {role.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={createAccessCode} disabled={creatingCode} style={styles.generateButton}>
              <Text style={styles.generateButtonText}>
                {creatingCode ? 'Generating...' : 'Generate Code'}
              </Text>
            </Pressable>

            {generatedCode && (
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>Access Code</Text>
                <Text style={styles.codeValue}>{generatedCode}</Text>
              </View>
            )}
          </Card>

          <SectionTitle>Send Custom Notification</SectionTitle>

          <Card>
            <Text style={styles.label}>Title</Text>
            <TextInput
              value={noticeTitle}
              onChangeText={setNoticeTitle}
              placeholder="e.g. Meeting today"
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: Spacing.sm }]}>Message</Text>
            <TextInput
              value={noticeMessage}
              onChangeText={setNoticeMessage}
              placeholder="Write your message to all users..."
              style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
              multiline
            />

            <Pressable
              onPress={sendBroadcastNotification}
              disabled={sendingNotice}
              style={[styles.generateButton, { marginTop: Spacing.md }]}
            >
              <Text style={styles.generateButtonText}>
                {sendingNotice ? 'Sending...' : 'Send to All Users'}
              </Text>
            </Pressable>
          </Card>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 13, color: Colors.textSecondary },
  value: { fontSize: 16, fontWeight: '600', marginTop: 4, color: Colors.textPrimary },
  owner: { color: Colors.primary },
  staff: { color: Colors.textPrimary },

  userEmail: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  selfLabel: { marginTop: Spacing.xs, fontSize: 13, fontWeight: '600', color: Colors.primary },
  roleButton: { marginTop: Spacing.xs, fontSize: 13, fontWeight: '600', color: Colors.accent },

  roleRow: { flexDirection: 'row', marginTop: Spacing.sm, marginBottom: Spacing.md },
  roleOption: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.textSecondary,
    marginRight: Spacing.sm,
    alignItems: 'center',
  },
  roleOptionActive: { borderColor: Colors.primary, backgroundColor: '#fdf6e3' },
  roleOptionText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  roleOptionTextActive: { color: Colors.primary },

  generateButton: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: 10,
    alignItems: 'center',
  },
  generateButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  codeBox: { marginTop: Spacing.md, padding: Spacing.md, borderRadius: 10, backgroundColor: '#000' },
  codeLabel: { color: '#aaa', fontSize: 12 },
  codeValue: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 4, marginTop: 4 },

  input: {
    borderWidth: 1,
    borderColor: Colors.textSecondary,
    borderRadius: 10,
    padding: Spacing.md,
    fontSize: 16,
    marginTop: 6,
  },
});
