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
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Cropper from 'react-easy-crop';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../context/supabase';
import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

type Role = 'owner' | 'manager' | 'staff';

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  avatar_url?: string | null;
};

/* ================= WEB IMAGE PICKER ================= */
const pickImageWeb = async (): Promise<string | null> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);

      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    };

    input.click();
  });
};
/* ==================================================== */

export default function ProfileTab() {
  const { user, loading: authLoading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<{
    code: string;
    role: Role;
  } | null>(null);

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

  const generateAccessCode = async (role: Role) => {
    if (!user) return;

    const code = Math.floor(10000 + Math.random() * 90000).toString();

    const { error } = await supabase.from('access_codes').insert({
      code,
      role,
      used: false,
      created_by: user.id,
    });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setGeneratedCode({ code, role });

    Alert.alert(
      'Access Code Created',
      `Code: ${code}\nRole: ${role.toUpperCase()}`
    );
  };

  /* ================= PICK IMAGE ================= */
  const pickAndUploadAvatar = async () => {
    if (Platform.OS === 'web') {
      const dataUrl = await pickImageWeb();
      if (!dataUrl) return;

      setImageToCrop(dataUrl);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setShowCropper(true);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (result.canceled) return;

    uploadFinalImage(result.assets[0].uri);
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
          upsert: false,
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
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, { color: Colors.muted }]}>
          Loading profile…
        </Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <Text style={{ color: Colors.text }}>Profile not found</Text>
      </View>
    );
  }

  const isOwner = profile.role === 'owner';

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: Colors.background },
      ]}
    >
      <Text style={[styles.pageTitle, { color: Colors.text }]}>
        My Profile
      </Text>

      <Pressable
        onPress={pickAndUploadAvatar}
        style={{ alignItems: 'center', marginBottom: 20 }}
      >
        <Image
          key={profile.avatar_url}
          source={
            profile.avatar_url
              ? { uri: profile.avatar_url }
              : require('../../assets/images/avatar-placeholder.png')
          }
          style={styles.avatar}
        />
        <Text style={{ fontSize: 12, color: Colors.muted }}>
          {uploading ? 'Uploading…' : 'Tap to change photo'}
        </Text>
      </Pressable>

      <View style={[styles.card, { backgroundColor: Colors.card }]}>
        <Text style={[styles.label, { color: Colors.muted }]}>Email</Text>
        <Text style={[styles.value, { color: Colors.text }]}>
          {profile.email}
        </Text>

        <Text style={[styles.label, { marginTop: 12, color: Colors.muted }]}>
          Full name
        </Text>
        <Text style={[styles.value, { color: Colors.text }]}>
          {profile.full_name || 'Not set'}
        </Text>

        <Text style={[styles.label, { marginTop: 12, color: Colors.muted }]}>
          Role
        </Text>
        <Text
          style={[
            styles.value,
            { color: isOwner ? Colors.primary : Colors.text },
          ]}
        >
          {profile.role.toUpperCase()}
        </Text>

        <View style={styles.themeRow}>
          <Text style={{ color: Colors.text, fontWeight: '600' }}>
            Dark Mode
          </Text>
          <Switch
            value={theme === 'dark'}
            onValueChange={toggleTheme}
            thumbColor={theme === 'dark' ? Colors.primary : '#f4f3f4'}
            trackColor={{ false: '#ccc', true: Colors.primary }}
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: Colors.card }]}>
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

            <Pressable
              onPress={() => generateAccessCode('staff')}
              style={[styles.primaryButton, { marginTop: 12 }]}
            >
              <Text style={styles.primaryButtonText}>
                Generate Staff Code
              </Text>
            </Pressable>

            {generatedCode && (
              <View
                style={[
                  styles.card,
                  { marginTop: 12, backgroundColor: Colors.background },
                ]}
              >
                <Text style={[styles.label, { color: Colors.muted }]}>
                  Generated Access Code
                </Text>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: '800',
                    letterSpacing: 3,
                    color: Colors.text,
                  }}
                >
                  {generatedCode.code}
                </Text>
                <Text style={{ marginTop: 6, color: Colors.text }}>
                  Role: {generatedCode.role.toUpperCase()}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      <Pressable onPress={handleLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>

      {Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        window.innerWidth > 768 &&
        showCropper &&
        imageToCrop && (

        <View
          style={{
            position: 'fixed' as any,
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View style={{ width: 300, height: 300, backgroundColor: '#000' }}>
            <Cropper
              image={imageToCrop}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <Pressable onPress={() => setShowCropper(false)} style={{ padding: 12 }}>
              <Text style={{ color: '#fff' }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={saveCroppedImage} style={{ padding: 12 }}>
              <Text style={{ color: '#C9A24D', fontWeight: '800' }}>Save</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 20,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
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
  themeRow: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    marginBottom: 8,
    backgroundColor: '#EAEAEA',
  },
});
