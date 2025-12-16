'use client';

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { router } from 'expo-router';

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator'; // ✅ added

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../context/supabase';

type Role = 'owner' | 'manager' | 'staff';

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  avatar_url?: string | null;
};

export default function ProfileTab() {
  const { user, loading: authLoading, logout } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/(auth)/login');
      return;
    }
    if (user) loadProfile();
  }, [user, authLoading]);

  const loadProfile = async () => {
    setLoading(true);

    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url')
      .eq('id', user!.id)
      .single();

    setProfile(data ?? null);
    setLoading(false);
  };

  /* ================= AVATAR UPLOAD (RESIZE + CROP SAFE) ================= */

  const pickAndUploadAvatar = async () => {
    try {
      setUploading(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // user can crop & zoom
        aspect: [1, 1],
        quality: 1,
      });

      if (result.canceled) return;

      const image = result.assets[0];

      // 🔧 Resize & normalize image
      const manipulated = await ImageManipulator.manipulateAsync(
        image.uri,
        [{ resize: { width: 512, height: 512 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      const response = await fetch(manipulated.uri);
      const blob = await response.blob();

      const filePath = `${user!.id}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          upsert: true,
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user!.id);

      setProfile((prev) =>
        prev ? { ...prev, avatar_url: publicUrl } : prev
      );
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to upload profile photo');
    } finally {
      setUploading(false);
    }
  };

  /* ================= LOGOUT ================= */

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const ok = window.confirm('Are you sure you want to logout?');
      if (ok) logout();
    } else {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: logout,
          },
        ]
      );
    }
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

      {/* PROFILE PHOTO */}
      <Pressable
        onPress={pickAndUploadAvatar}
        style={{ alignItems: 'center', marginBottom: 20 }}
      >
        <Image
          source={
            profile.avatar_url
              ? { uri: profile.avatar_url }
              : require('../../assets/images/avatar-placeholder.png')
          }
          style={{
            width: 110,
            height: 110,
            borderRadius: 55,
            marginBottom: 8,
            backgroundColor: '#EAEAEA',
          }}
        />
        <Text style={{ fontSize: 12, color: '#7A7A7A' }}>
          {uploading ? 'Uploading…' : 'Tap to change photo'}
        </Text>
      </Pressable>

      {/* BASIC INFO */}
      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{profile.email}</Text>

        <Text style={[styles.label, { marginTop: 12 }]}>Full name</Text>
        <Text style={styles.value}>{profile.full_name || 'Not set'}</Text>

        <Text style={[styles.label, { marginTop: 12 }]}>Role</Text>
        <Text style={[styles.value, isOwner ? styles.owner : styles.staff]}>
          {profile.role.toUpperCase()}
        </Text>
      </View>

      {/* ACTION BUTTONS */}
      <View style={styles.card}>
        <Pressable
          onPress={() => router.push('../(tabs)/change-password')}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Change Password</Text>
        </Pressable>

        {isOwner && (
          <>
            <Pressable
              onPress={() => router.push('../(tabs)/manage-users')}
              style={[styles.primaryButton, { marginTop: 12 }]}
            >
              <Text style={styles.primaryButtonText}>Manage Users</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('../(tabs)/audit-log')}
              style={[styles.primaryButton, { marginTop: 12 }]}
            >
              <Text style={styles.primaryButtonText}>Audit Logs</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* LOGOUT */}
      <Pressable onPress={handleLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ================= STYLES (UNCHANGED) ================= */

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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
  loadingText: {
    marginTop: 10,
    color: '#7A7A7A',
  },
});
