'use client';

import { useEffect, useRef, useState } from 'react';
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
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
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

const WEB_CROP_SIZE = 300;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/* ================= WEB HELPERS ================= */
const pickImageWebFile = async (): Promise<File | null> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.position = 'fixed';
    input.style.left = '-1000px';
    input.style.top = '-1000px';
    input.style.opacity = '0';

    let done = false;

    const cleanup = () => {
      window.removeEventListener('focus', onFocus);
      if (input.parentNode) input.parentNode.removeChild(input);
    };

    const finish = (file: File | null) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(file);
    };

    const onFocus = () => {
      window.setTimeout(() => {
        if (!done && !input.files?.length) finish(null);
      }, 700);
    };

    input.onchange = () => {
      const file = input.files?.[0] || null;
      finish(file);
    };

    document.body.appendChild(input);
    window.setTimeout(() => window.addEventListener('focus', onFocus), 0);
    input.click();
  });
};

const webLoadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    if (!src.startsWith('blob:') && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });

const readWebFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });

const canvasToJpegBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Failed to export image'));
          resolve(blob);
        },
        'image/jpeg',
        0.85
      );
      return;
    }

    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const [header, data] = dataUrl.split(',');
      const mime = header.match(/data:(.*);base64/)?.[1] || 'image/jpeg';
      const binary = window.atob(data);
      const bytes = new Uint8Array(binary.length);

      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }

      resolve(new Blob([bytes], { type: mime }));
    } catch (error) {
      reject(error);
    }
  });

const webCropToBlob512 = async (
  imageSrc: string,
  cropPixels: { x: number; y: number; width: number; height: number }
): Promise<Blob> => {
  const img = await webLoadImage(imageSrc);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.imageSmoothingEnabled = true;

  ctx.drawImage(
    img,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    512,
    512
  );

  return canvasToJpegBlob(canvas);
};

/* ================================================= */

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

  /* 🟢 CROP STATES (WEB) */
  const [webPreviewUrl, setWebPreviewUrl] = useState<string | null>(null);
  const [webImageSize, setWebImageSize] = useState({ width: 1, height: 1 });
  const [webCropOffset, setWebCropOffset] = useState({ x: 0, y: 0 });
  const [webCropZoom, setWebCropZoom] = useState(1);
  const [showCropper, setShowCropper] = useState(false);
  const [avatarPreviewVisible, setAvatarPreviewVisible] = useState(false);
  const webDragRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/(auth)/login');
      return;
    }

    if (user) loadProfile();
  }, [user, authLoading]);

  useEffect(() => {
    return () => {
      if (webPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(webPreviewUrl);
    };
  }, [webPreviewUrl]);

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
    if (!user || uploading) return;

    if (Platform.OS === 'web') {
      try {
        const file = await pickImageWebFile();
        if (!file) return;

        const url = await readWebFileAsDataUrl(file);

        if (webPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(webPreviewUrl);

        setWebPreviewUrl(url);
        setWebCropOffset({ x: 0, y: 0 });
        setWebCropZoom(1);
        setWebImageSize({ width: 1, height: 1 });

        const image = await webLoadImage(url);
        setWebImageSize({
          width: image.naturalWidth || 1,
          height: image.naturalHeight || 1,
        });
        setShowCropper(true);
      } catch (err: any) {
        console.error('Web image picker error:', err);
        Alert.alert('Error', err?.message || 'Failed to select photo');
      }
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow photo library access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (result.canceled || !result.assets?.length) return;

    await uploadNativeUri(result.assets[0].uri);
  };

  /* ================= NATIVE UPLOAD ================= */
  const uploadNativeUri = async (uri: string) => {
    try {
      setUploading(true);

      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 512, height: 512 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );

      const arrayBuffer = await fetch(manipulated.uri).then((res) =>
        res.arrayBuffer()
      );

      const filePath = `${user!.id}.jpg`;

      const { error } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          upsert: true,
          contentType: 'image/jpeg',
        });

      if (error) throw error;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { error: updErr } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user!.id);

      if (updErr) throw updErr;

      setProfile((p) => (p ? { ...p, avatar_url: avatarUrl } : p));
    } catch (err: any) {
      console.error('Native avatar upload error:', err);
      Alert.alert('Error', err?.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  /* ================= WEB UPLOAD ================= */
  const uploadWebBlob = async (blob: Blob) => {
    try {
      setUploading(true);

      const filePath = `${user!.id}.jpg`;

      const { error } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          upsert: true,
          contentType: 'image/jpeg',
        });

      if (error) throw error;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { error: updErr } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user!.id);

      if (updErr) throw updErr;

      setProfile((p) => (p ? { ...p, avatar_url: avatarUrl } : p));
    } catch (err: any) {
      console.error('Web avatar upload error:', err);
      Alert.alert('Error', err?.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const getWebCropMetrics = (zoomValue = webCropZoom) => {
    const scale =
      Math.max(
        WEB_CROP_SIZE / webImageSize.width,
        WEB_CROP_SIZE / webImageSize.height
      ) * zoomValue;
    const displayWidth = webImageSize.width * scale;
    const displayHeight = webImageSize.height * scale;
    const maxX = Math.max(0, (displayWidth - WEB_CROP_SIZE) / 2);
    const maxY = Math.max(0, (displayHeight - WEB_CROP_SIZE) / 2);

    return { scale, displayWidth, displayHeight, maxX, maxY };
  };

  const clampWebCropOffset = (
    offset: { x: number; y: number },
    zoomValue = webCropZoom
  ) => {
    const { maxX, maxY } = getWebCropMetrics(zoomValue);

    return {
      x: clamp(offset.x, -maxX, maxX),
      y: clamp(offset.y, -maxY, maxY),
    };
  };

  const setWebZoom = (nextZoom: number) => {
    const next = clamp(nextZoom, 1, 3);
    setWebCropZoom(next);
    setWebCropOffset((offset) => clampWebCropOffset(offset, next));
  };

  const moveWebCrop = (x: number, y: number) => {
    setWebCropOffset((offset) =>
      clampWebCropOffset({
        x: offset.x + x,
        y: offset.y + y,
      })
    );
  };

  const getWebEventPoint = (event: any) => {
    const nativeEvent = event?.nativeEvent ?? event;
    const touch =
      nativeEvent.touches?.[0] ??
      nativeEvent.changedTouches?.[0] ??
      nativeEvent;

    return {
      x: touch.clientX ?? touch.pageX ?? touch.locationX ?? 0,
      y: touch.clientY ?? touch.pageY ?? touch.locationY ?? 0,
      pointerId: nativeEvent.pointerId ?? null,
    };
  };

  const startWebCropDrag = (event: any) => {
    event?.preventDefault?.();
    const point = getWebEventPoint(event);
    webDragRef.current = {
      pointerId: point.pointerId,
      startX: point.x,
      startY: point.y,
      originX: webCropOffset.x,
      originY: webCropOffset.y,
    };
    if (point.pointerId != null) {
      event?.currentTarget?.setPointerCapture?.(point.pointerId);
    }
  };

  const moveWebCropDrag = (event: any) => {
    if (!webDragRef.current) return;

    event?.preventDefault?.();
    const point = getWebEventPoint(event);
    const next = {
      x:
        webDragRef.current.originX +
        point.x -
        webDragRef.current.startX,
      y:
        webDragRef.current.originY +
        point.y -
        webDragRef.current.startY,
    };

    setWebCropOffset(clampWebCropOffset(next));
  };

  const endWebCropDrag = () => {
    webDragRef.current = null;
  };

  /* ================= SAVE CROPPED IMAGE (WEB) ================= */
  const saveCroppedImage = async () => {
    if (!webPreviewUrl) return;

    try {
      setShowCropper(false);

      const { scale } = getWebCropMetrics();
      const cropWidth = WEB_CROP_SIZE / scale;
      const cropHeight = WEB_CROP_SIZE / scale;
      const cropPixels = {
        x: Math.round(
          clamp(
            (webImageSize.width - cropWidth) / 2 - webCropOffset.x / scale,
            0,
            webImageSize.width - cropWidth
          )
        ),
        y: Math.round(
          clamp(
            (webImageSize.height - cropHeight) / 2 - webCropOffset.y / scale,
            0,
            webImageSize.height - cropHeight
          )
        ),
        width: Math.round(cropWidth),
        height: Math.round(cropHeight),
      };

      const blob = await webCropToBlob512(webPreviewUrl, cropPixels);

      await uploadWebBlob(blob);
    } catch (err: any) {
      console.error('Crop/upload error:', err);
      Alert.alert('Error', err?.message || 'Failed to crop/upload photo');
    }
  };

  /* ================= LOGOUT ================= */
  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('A jeni të sigurt që doni të dilni?')) logout();
    } else {
      Alert.alert('Logout', 'A jeni të sigurt që doni të dilni?', [
        { text: 'Kthehu mbrapa', style: 'cancel' },
        { text: 'Dil', style: 'destructive', onPress: logout },
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
  const canViewStats = profile.role === 'owner' || profile.role === 'manager';
  const webCropMetrics = getWebCropMetrics();

  return (
    <ScrollView
      scrollEnabled={!showCropper}
      contentContainerStyle={[
        styles.container,
        { backgroundColor: Colors.background },
      ]}
    >
      <Text style={[styles.pageTitle, { color: Colors.text }]}>Profili im </Text>

      <View style={styles.avatarSection}>
        <View style={styles.avatarWrap}>
          <Pressable onPress={() => setAvatarPreviewVisible(true)}>
            <Image
              key={profile.avatar_url}
              source={
                profile.avatar_url
                  ? { uri: profile.avatar_url }
                  : require('../../assets/images/avatar-placeholder.png')
              }
              style={styles.avatar}
            />
          </Pressable>

          <Pressable
            onPress={pickAndUploadAvatar}
            disabled={uploading}
            style={[
              styles.avatarEditButton,
              {
                backgroundColor: uploading ? Colors.muted : Colors.primary,
                borderColor: Colors.background,
              },
            ]}
          >
            <Ionicons name={uploading ? 'hourglass' : 'camera'} size={16} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: Colors.card }]}>
        <Text style={[styles.label, { color: Colors.muted }]}>Email</Text>
        <Text style={[styles.value, { color: Colors.text }]}>
          {profile.email}
        </Text>

        <Text style={[styles.label, { marginTop: 12, color: Colors.muted }]}>
          Emri i përdoruesit
        </Text>
        <Text style={[styles.value, { color: Colors.text }]}>
          {profile.full_name || 'Not set'}
        </Text>

        <Text style={[styles.label, { marginTop: 12, color: Colors.muted }]}>
          Roli
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
          onPress={() => router.push('../(tabs)/scan-discount')}
          style={[styles.primaryButton, { marginTop: 12 }]}
        >
          <Text style={styles.primaryButtonText}>Skano QR Discount</Text>
        </Pressable>

        {canViewStats && (
          <Pressable
            onPress={() => router.push('../(tabs)/stats')}
            style={[styles.primaryButton, { marginTop: 12 }]}
          >
            <Text style={styles.primaryButtonText}>
              📊Statistika mujore e stafit
            </Text>
          </Pressable>
        )}

        {canViewStats && (
          <Pressable
            onPress={() => router.push('../(tabs)/qr-redemptions')}
            style={[styles.primaryButton, { marginTop: 12 }]}
          >
            <Text style={styles.primaryButtonText}>QR Discounts</Text>
          </Pressable>
        )}

        {isOwner && (
          <>
            <Pressable
              onPress={() => router.push('../owner-stats')}
              style={[styles.primaryButton, { marginTop: 12 }]}
            >
              <Text style={styles.primaryButtonText}>
                📊Statistikat financiare
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('../(tabs)/manage-users')}
              style={[styles.primaryButton, { marginTop: 12 }]}
            >
              <Text style={styles.primaryButtonText}>Menaxho Përdoruesit</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('../(tabs)/manage-appointments')}
              style={[styles.primaryButton, { marginTop: 12 }]}
            >
              <Text style={styles.primaryButtonText}>Menaxho terminet</Text>
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
              <Text style={styles.primaryButtonText}>Gjenero Staff Code</Text>
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

      <Pressable
        onPress={() => router.push('../(tabs)/change-password')}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>Ndrysho Fjalëkalimin</Text>
      </Pressable>

      <Pressable onPress={handleLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Dil</Text>
      </Pressable>

      {avatarPreviewVisible && Platform.OS === 'web' && (
        <View
          style={[
            styles.avatarOverlay,
            {
              position: 'fixed' as any,
              inset: 0,
              zIndex: 9999,
            },
          ]}
        >
          <View style={[styles.avatarPreviewCard, { backgroundColor: Colors.card }]}>
            <Image
              source={
                profile.avatar_url
                  ? { uri: profile.avatar_url }
                  : require('../../assets/images/avatar-placeholder.png')
              }
              style={styles.avatarPreview}
              resizeMode="cover"
            />

            <Pressable
              onPress={() => setAvatarPreviewVisible(false)}
              style={[styles.avatarCloseBtn, { backgroundColor: Colors.primary }]}
            >
              <Text style={styles.avatarCloseText}>Mbyll</Text>
            </Pressable>
          </View>
        </View>
      )}

      {Platform.OS !== 'web' && (
        <Modal visible={avatarPreviewVisible} transparent animationType="fade">
          <View style={styles.avatarOverlay}>
            <View style={[styles.avatarPreviewCard, { backgroundColor: Colors.card }]}>
              <Image
                source={
                  profile.avatar_url
                    ? { uri: profile.avatar_url }
                    : require('../../assets/images/avatar-placeholder.png')
                }
                style={styles.avatarPreview}
                resizeMode="cover"
              />

              <Pressable
                onPress={() => setAvatarPreviewVisible(false)}
                style={[styles.avatarCloseBtn, { backgroundColor: Colors.primary }]}
              >
                <Text style={styles.avatarCloseText}>Mbyll</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'web' && showCropper && webPreviewUrl && (
        <View
          style={[
            styles.webCropOverlay,
            {
              position: 'fixed' as any,
              inset: 0,
            },
          ]}
        >
          <View style={[styles.webCropCard, { backgroundColor: Colors.card }]}>
            <Text style={[styles.webCropTitle, { color: Colors.text }]}>
              Rregullo fotografinë
            </Text>

            <View
              style={styles.webCropBox}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={startWebCropDrag}
              onResponderMove={moveWebCropDrag}
              onResponderRelease={endWebCropDrag}
              onResponderTerminate={endWebCropDrag}
            >
              <Image
                source={{ uri: webPreviewUrl }}
                style={[
                  styles.webCropImage,
                  {
                    width: webCropMetrics.displayWidth,
                    height: webCropMetrics.displayHeight,
                    left:
                    WEB_CROP_SIZE / 2 -
                    webCropMetrics.displayWidth / 2 +
                    webCropOffset.x,
                    top:
                    WEB_CROP_SIZE / 2 -
                    webCropMetrics.displayHeight / 2 +
                    webCropOffset.y,
                  },
                ]}
                resizeMode="stretch"
              />
            </View>

            <View style={styles.webCropMovePad}>
              <Pressable
                onPress={() => moveWebCrop(0, -18)}
                style={[styles.webCropIconBtn, { backgroundColor: Colors.background }]}
              >
                <Ionicons name="chevron-up" size={20} color={Colors.text} />
              </Pressable>
              <View style={styles.webCropMoveRow}>
                <Pressable
                  onPress={() => moveWebCrop(-18, 0)}
                  style={[styles.webCropIconBtn, { backgroundColor: Colors.background }]}
                >
                  <Ionicons name="chevron-back" size={20} color={Colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    setWebCropZoom(1);
                    setWebCropOffset({ x: 0, y: 0 });
                  }}
                  style={[styles.webCropIconBtn, { backgroundColor: Colors.background }]}
                >
                  <Ionicons name="scan" size={18} color={Colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => moveWebCrop(18, 0)}
                  style={[styles.webCropIconBtn, { backgroundColor: Colors.background }]}
                >
                  <Ionicons name="chevron-forward" size={20} color={Colors.text} />
                </Pressable>
              </View>
              <Pressable
                onPress={() => moveWebCrop(0, 18)}
                style={[styles.webCropIconBtn, { backgroundColor: Colors.background }]}
              >
                <Ionicons name="chevron-down" size={20} color={Colors.text} />
              </Pressable>
            </View>

            <View style={styles.webCropControls}>
              <Pressable
                onPress={() => setWebZoom(webCropZoom - 0.1)}
                style={[styles.webCropIconBtn, { backgroundColor: Colors.background }]}
              >
                <Ionicons name="remove" size={20} color={Colors.text} />
              </Pressable>
              <Text style={[styles.webCropZoomText, { color: Colors.muted }]}>
                Zoom {Math.round(webCropZoom * 100)}%
              </Text>
              <Pressable
                onPress={() => setWebZoom(webCropZoom + 0.1)}
                style={[styles.webCropIconBtn, { backgroundColor: Colors.background }]}
              >
                <Ionicons name="add" size={20} color={Colors.text} />
              </Pressable>
            </View>

            <View style={styles.webCropActions}>
              <Pressable
                onPress={() => setShowCropper(false)}
                style={[styles.webCropButton, { backgroundColor: Colors.background }]}
              >
                <Text style={[styles.webCropCancelText, { color: Colors.text }]}>
                  Anulo
                </Text>
              </Pressable>
              <Pressable
                onPress={saveCroppedImage}
                style={[styles.webCropButton, { backgroundColor: Colors.primary }]}
              >
                <Text style={styles.webCropSaveText}>Ruaj</Text>
              </Pressable>
            </View>
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
    backgroundColor: '#EAEAEA',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrap: {
    width: 110,
    height: 110,
  },
  avatarEditButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  avatarPreviewCard: {
    width: '88%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
  },
  avatarPreview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
  },
  avatarCloseBtn: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  avatarCloseText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  webCropOverlay: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    pointerEvents: 'auto' as any,
  },
  webCropCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
  },
  webCropTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  webCropBox: {
    width: WEB_CROP_SIZE,
    height: WEB_CROP_SIZE,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#C9A24D',
    touchAction: 'none' as any,
    userSelect: 'none' as any,
  },
  webCropImage: {
    position: 'absolute',
  },
  webCropMovePad: {
    marginTop: 14,
    alignItems: 'center',
    gap: 6,
  },
  webCropMoveRow: {
    flexDirection: 'row',
    gap: 6,
  },
  webCropControls: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  webCropIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webCropZoomText: {
    minWidth: 90,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
  webCropActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  webCropButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  webCropCancelText: {
    fontSize: 14,
    fontWeight: '800',
  },
  webCropSaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
