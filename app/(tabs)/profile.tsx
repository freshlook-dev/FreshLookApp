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
import * as ImageManipulator from 'expo-image-manipulator';
import Cropper from 'react-easy-crop';

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

  /* 🟢 CROP STATES (WEB ONLY) */
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [showCropper, setShowCropper] = useState(false);

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

  const onCropComplete = (_: any, croppedPixels: any) => {
    setCroppedAreaPixels(croppedPixels);
  };

  /* ================= PICK IMAGE ================= */

  const pickAndUploadAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (result.canceled) return;

    const uri = result.assets[0].uri;

    if (Platform.OS === 'web') {
      setImageToCrop(uri);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setShowCropper(true);
    } else {
      uploadFinalImage(uri);
    }
  };

  /* ================= FINAL UPLOAD ================= */

  const uploadFinalImage = async (uri: string) => {
    try {
      setUploading(true);

      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 512, height: 512 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

     const response = await fetch(manipulated.uri);
const blob = await response.blob();

const filePath = `${user!.id}-${Date.now()}.jpg`;

const { error } = await supabase.storage
  .from('avatars')
  .upload(filePath, blob, {
    upsert: false, // 👈 important now
    contentType: 'image/jpeg',
  });

if (error) throw error;

const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl(filePath);

await supabase
  .from('profiles')
  .update({ avatar_url: data.publicUrl })
  .eq('id', user!.id);

setProfile((p) =>
  p ? { ...p, avatar_url: data.publicUrl } : p
);


      setProfile((p) =>
        p ? { ...p, avatar_url: data.publicUrl } : p
      );
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  /* ================= SAVE CROPPED IMAGE ================= */

  const saveCroppedImage = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;

    const cropped = await ImageManipulator.manipulateAsync(
      imageToCrop,
      [
        {
          crop: {
            originX: croppedAreaPixels.x,
            originY: croppedAreaPixels.y,
            width: croppedAreaPixels.width,
            height: croppedAreaPixels.height,
          },
        },
        { resize: { width: 512, height: 512 } },
      ],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );

    setShowCropper(false);
    uploadFinalImage(cropped.uri);
  };

  /* ================= LOGOUT ================= */

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) logout();
    } else {
      Alert.alert('Logout', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]);
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
    <>
      {/* 🔲 FULL DRAGGABLE CROP UI (WEB + PHONE BROWSER) */}
      {Platform.OS === 'web' && showCropper && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            touchAction: 'none',
          }}
        >
          <div
            style={{
              width: 320,
              height: 420,
              background: '#000',
              position: 'relative',
            }}
          >
            <Cropper
              image={imageToCrop!}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />

            <div
              style={{
                position: 'absolute',
                bottom: 0,
                width: '100%',
                background: '#fff',
                padding: 10,
              }}
            >
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{ width: '100%' }}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 8,
                }}
              >
                <button onClick={() => setShowCropper(false)}>Cancel</button>
                <button onClick={saveCroppedImage}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MAIN UI (UNCHANGED) ================= */}
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.pageTitle}>My Profile</Text>

        <Pressable
          onPress={pickAndUploadAvatar}
          style={{ alignItems: 'center', marginBottom: 20 }}
        >
          <Image
  key={profile.avatar_url} // 🔥 forces re-render when URL changes
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
    </>
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
