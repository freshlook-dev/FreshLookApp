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
  Modal,
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

  /* 🔹 CROP STATES (WEB ONLY) */
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
      // 👉 Open cropper on web
      setImageToCrop(uri);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setShowCropper(true);
    } else {
      // 👉 Native fallback
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

      const filePath = `${user!.id}.jpg`;

      await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          upsert: true,
          contentType: 'image/jpeg',
        });

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
    } catch (err) {
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  /* ================= SAVE CROP ================= */

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

  return (
    <>
      {/* 🔲 CROP MODAL (WEB ONLY) */}
      {Platform.OS === 'web' && showCropper && (
        <Modal transparent>
          <View style={styles.cropOverlay}>
            <View style={styles.cropContainer}>
              <Cropper
                image={imageToCrop!}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
              <View style={styles.cropControls}>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
                <View style={styles.cropButtons}>
                  <button onClick={() => setShowCropper(false)}>Cancel</button>
                  <button onClick={saveCroppedImage}>Save</button>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* MAIN UI */}
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.pageTitle}>My Profile</Text>

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
            }}
          />
          <Text style={{ fontSize: 12 }}>
            {uploading ? 'Uploading…' : 'Tap to change photo'}
          </Text>
        </Pressable>

        {/* rest unchanged */}
      </ScrollView>
    </>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#FAF8F4',
    padding: 20,
    paddingBottom: 40,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10 },
  pageTitle: { fontSize: 26, fontWeight: '800', marginBottom: 20 },

  /* CROP UI */
  cropOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropContainer: {
    width: 350,
    height: 420,
    backgroundColor: '#000',
  },
  cropControls: {
    padding: 10,
    backgroundColor: '#fff',
  },
  cropButtons: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 10,
  },
});
