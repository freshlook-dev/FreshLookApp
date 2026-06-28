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
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

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

const roleLabel = (role: Role) => {
  if (role === 'owner') return 'Pronar';
  if (role === 'manager') return 'Menaxher';
  return 'Staf';
};

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
  const [codeConfirmVisible, setCodeConfirmVisible] = useState(false);

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

  useAutoRefresh(loadProfile, {
    enabled: !!user,
    tables: ['profiles'],
    channelName: 'staff-profile',
  });

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
      Alert.alert('Gabim', error.message);
      return;
    }

    setGeneratedCode({ code, role });
    setCodeConfirmVisible(false);

    Alert.alert(
      'Kodi i qasjes u krijua',
      `Kodi: ${code}\nRoli: ${role.toUpperCase()}`
    );
  };

  const confirmLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('A jeni të sigurt që doni të dilni?')) logout();
      return;
    }

    Alert.alert('Dil nga llogaria', 'A jeni të sigurt që doni të dilni?', [
      { text: 'Kthehu mbrapa', style: 'cancel' },
      { text: 'Dil', style: 'destructive', onPress: logout },
    ]);
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
        Alert.alert('Gabim', err?.message || 'Fotoja nuk u zgjodh');
      }
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Kërkohet leje', 'Ju lutemi lejoni qasjen te fotot.');
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
      Alert.alert('Gabim', err?.message || 'Fotoja nuk u ngarkua');
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
      Alert.alert('Gabim', err?.message || 'Fotoja nuk u ngarkua');
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
      Alert.alert('Gabim', err?.message || 'Fotoja nuk u pre ose nuk u ngarkua');
    }
  };

  if (authLoading || loading) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, { color: Colors.muted }]}>
          Duke ngarkuar profilin...
        </Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <Text style={{ color: Colors.text }}>Profili nuk u gjet</Text>
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
      <Text style={[styles.pageTitle, { color: Colors.text }]}>Profili im</Text>

      <View style={[styles.profileHero, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <View style={styles.avatarWrap}>
          <Pressable onPress={() => setAvatarPreviewVisible(true)}>
            <Image
              key={profile.avatar_url}
              source={
                profile.avatar_url
                  ? { uri: profile.avatar_url }
                  : require('../../assets/images/avatar-placeholder.png')
              }
              style={[styles.avatar, { borderColor: Colors.primary }]}
            />
          </Pressable>

          <Pressable
            onPress={pickAndUploadAvatar}
            disabled={uploading}
            style={[
              styles.avatarEditButton,
              {
                backgroundColor: uploading ? Colors.muted : Colors.primary,
                borderColor: Colors.card,
              },
            ]}
          >
            <Ionicons name={uploading ? 'hourglass' : 'camera'} size={16} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.heroCopy}>
          <Text style={[styles.heroEyebrow, { color: Colors.primary }]}>
            {roleLabel(profile.role)}
          </Text>
          <Text style={[styles.heroName, { color: Colors.text }]} numberOfLines={2}>
            {profile.full_name || 'Emri nuk është vendosur'}
          </Text>
          <Text style={[styles.heroEmail, { color: Colors.muted }]} numberOfLines={1}>
            {profile.email}
          </Text>
          <Pressable
            onPress={pickAndUploadAvatar}
            disabled={uploading}
            style={[styles.photoPill, { backgroundColor: Colors.background, borderColor: Colors.border }]}
          >
            <Text style={[styles.photoPillText, { color: Colors.text }]}>
              {uploading ? 'Duke ngarkuar...' : 'Ndrysho foton'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <Text style={[styles.sectionTitle, { color: Colors.muted }]}>Veprime të shpejta</Text>
        <ProfileRow
          title="Përdor shpërblim QR"
          subtitle="Skano ose shkruaj kodin e klientit."
          colors={Colors}
          onPress={() => router.push('../(tabs)/scan-discount')}
        />
        {canViewStats && (
          <ProfileRow
            title="Statistika mujore e stafit"
            subtitle="Shiko performancën dhe terminet mujore."
            colors={Colors}
            onPress={() => router.push('../(tabs)/stats')}
          />
        )}
        {canViewStats && (
          <ProfileRow
            title="Zbritjet QR"
            subtitle="Historiku i shpërblimeve të përdorura."
            colors={Colors}
            onPress={() => router.push('../(tabs)/qr-redemptions')}
          />
        )}
        <ProfileRow
          title="Dergo njoftime"
          subtitle="Dergo njoftim te nje perdorues i vetem."
          colors={Colors}
          onPress={() => router.push('../(tabs)/notifications')}
        />
      </View>

      <View style={[styles.sectionCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <Text style={[styles.sectionTitle, { color: Colors.muted }]}>Profili dhe siguria</Text>
        <ProfileRow
          title="Menaxho profilin"
          subtitle="Të dhënat e llogarisë, dalja dhe veprimet e llogarisë."
          colors={Colors}
          onPress={() => router.push('../(tabs)/manage-profile')}
        />
        <ProfileRow
          title="Fjalëkalimi dhe siguria"
          subtitle="Ndrysho fjalëkalimin dhe mbro llogarinë."
          colors={Colors}
          onPress={() => router.push('../(tabs)/change-password')}
        />
      </View>

      <View style={[styles.sectionCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <Text style={[styles.sectionTitle, { color: Colors.muted }]}>Preferencat</Text>
        <View style={styles.rowItem}>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: Colors.text }]}>Pamja e aplikacionit</Text>
            <Text style={[styles.rowSubtitle, { color: Colors.muted }]}>
              {theme === 'dark' ? 'Pamje e errët aktive' : 'Pamje e çelët aktive'}
            </Text>
          </View>
          <Switch
            value={theme === 'dark'}
            onValueChange={toggleTheme}
            thumbColor={theme === 'dark' ? Colors.primary : '#f4f3f4'}
            trackColor={{ false: '#ccc', true: Colors.primary }}
          />
        </View>
      </View>

      {isOwner && (
        <View style={[styles.sectionCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
          <Text style={[styles.sectionTitle, { color: Colors.muted }]}>Vegla për pronarin</Text>
          <ProfileRow
            title="Statistikat financiare"
            subtitle="Përmbledhje e pagesave dhe raportimit."
            colors={Colors}
            onPress={() => router.push('../owner-stats')}
          />
          <ProfileRow
            title="Menaxho përdoruesit"
            subtitle="Shto, ndrysho ose blloko qasjet e stafit."
            colors={Colors}
            onPress={() => router.push('../(tabs)/manage-users')}
          />
          <ProfileRow
            title="Menaxho terminet"
            subtitle="Kontrollo dhe përditëso terminet e ekipit."
            colors={Colors}
            onPress={() => router.push('../(tabs)/manage-appointments')}
          />
          <ProfileRow
            title="Log-et e auditimit"
            subtitle="Shiko ndryshimet e rëndësishme në sistem."
            colors={Colors}
            onPress={() => router.push('../(tabs)/audit-log')}
          />
          <ProfileRow
            title="Dërgo njoftime"
            subtitle="Njofto klientët në iOS dhe Android."
            colors={Colors}
            onPress={() => router.push('../(tabs)/notifications')}
          />
          <ProfileRow
            title="Gjenero kod për staf"
            subtitle="Krijo një kod të ri qasjeje për staf."
            colors={Colors}
            onPress={() => setCodeConfirmVisible(true)}
          />

          {generatedCode && (
            <View style={[styles.codeCard, { backgroundColor: Colors.background, borderColor: Colors.border }]}>
              <Text style={[styles.codeLabel, { color: Colors.muted }]}>Kodi i qasjes</Text>
              <Text style={[styles.codeValue, { color: Colors.text }]}>{generatedCode.code}</Text>
              <Text style={[styles.codeHint, { color: Colors.muted }]}>
                Roli: {roleLabel(generatedCode.role)}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={[styles.sectionCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <Text style={[styles.sectionTitle, { color: Colors.muted }]}>Ndihmë dhe informacion</Text>
        <ProfileRow
          title="Qendra e ndihmës"
          subtitle="Përgjigje të shpejta për punën e përditshme."
          colors={Colors}
          onPress={() => router.push('../(tabs)/help-center')}
        />
        <ProfileRow
          title="Rreth nesh"
          subtitle="Më shumë për Fresh Look dhe aplikacionin."
          colors={Colors}
          onPress={() => router.push('../(tabs)/about-us')}
        />
      </View>

      <Pressable
        onPress={confirmLogout}
        style={[styles.logoutButton, { backgroundColor: Colors.danger }]}
      >
        <Text style={styles.logoutText}>Dil nga llogaria</Text>
      </Pressable>

      <Modal
        visible={codeConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCodeConfirmVisible(false)}
      >
        <View style={styles.avatarOverlay}>
          <View style={[styles.confirmCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
            <Text style={[styles.confirmTitle, { color: Colors.text }]}>
              Gjenero kod për staf?
            </Text>
            <Text style={[styles.confirmMessage, { color: Colors.muted }]}>
              Ky kod do të krijojë qasje për një anëtar të stafit. Vazhdoni vetëm nëse ju duhet një kod i ri.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => setCodeConfirmVisible(false)}
                style={[styles.confirmButton, { backgroundColor: Colors.background }]}
              >
                <Text style={[styles.confirmCancelText, { color: Colors.text }]}>Anulo</Text>
              </Pressable>
              <Pressable
                onPress={() => generateAccessCode('staff')}
                style={[styles.confirmButton, { backgroundColor: Colors.primary }]}
              >
                <Text style={styles.confirmCreateText}>Gjenero</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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

type ProfileRowProps = {
  title: string;
  subtitle: string;
  colors: typeof LightColors;
  onPress: () => void;
};

function ProfileRow({ title, subtitle, colors, onPress }: ProfileRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowItem,
        {
          backgroundColor: pressed ? colors.background : 'transparent',
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowSubtitle, { color: colors.muted }]}>{subtitle}</Text>
      </View>
      <Text style={[styles.rowArrow, { color: colors.muted }]}>›</Text>
    </Pressable>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 120,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 22,
  },
  profileHero: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 2,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  heroName: {
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 26,
  },
  heroEmail: {
    fontSize: 13,
    marginTop: 4,
  },
  photoPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginTop: 12,
  },
  photoPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  rowItem: {
    minHeight: 66,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  rowSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  rowArrow: {
    fontSize: 25,
    fontWeight: '300',
    lineHeight: 28,
  },
  codeCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    margin: 8,
    marginTop: 10,
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  codeValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 5,
  },
  codeHint: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
  },
  confirmCard: {
    width: '88%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
  },
  confirmTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '800',
  },
  confirmCreateText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  card: {
    borderRadius: 20,
    padding: 19,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: '#C9A24D',
    minHeight: 50,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  logoutButton: {
    marginTop: 22,
    backgroundColor: '#D64545',
    minHeight: 54,
    paddingVertical: 15,
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
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#EAEAEA',
    borderWidth: 3,
    borderColor: '#C9A24D',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrap: {
    width: 104,
    height: 104,
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
    touchAction: 'none',
    userSelect: 'none',
  } as any,
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
