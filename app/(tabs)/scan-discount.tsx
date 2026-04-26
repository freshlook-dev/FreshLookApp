'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import jsQR from 'jsqr';

import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { LightColors, DarkColors } from '../../constants/colors';

declare global {
  interface Window {
    BarcodeDetector?: new (options?: {
      formats?: string[];
    }) => {
      detect: (
        image: HTMLVideoElement | HTMLCanvasElement
      ) => Promise<Array<{ rawValue: string }>>;
    };
  }
}

type Role = 'owner' | 'manager' | 'staff';

type Redemption = {
  id: string;
  user_id: string;
  points: number;
  status: string;
  expires_at: string | null;
  created_at: string;
  scanned_by?: string | null;
  scanned_at?: string | null;
};

const REDEMPTION_SELECT =
  'id, user_id, points, status, expires_at, created_at, scanned_by, scanned_at';

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const extractCode = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    const candidate =
      parsed.redemption_id ?? parsed.redemptionId ?? parsed.qr_id ?? parsed.id;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  } catch {}

  try {
    const url = new URL(trimmed);
    const candidate =
      url.searchParams.get('redemption_id') ??
      url.searchParams.get('redemptionId') ??
      url.searchParams.get('qr_id') ??
      url.searchParams.get('id') ??
      url.pathname.match(UUID_PATTERN)?.[0];
    if (candidate) return candidate;
  } catch {}

  return trimmed.match(UUID_PATTERN)?.[0] ?? trimmed;
};

export default function ScanDiscountScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<number | null>(null);
  const scanningRef = useRef(false);

  const [checkingRole, setCheckingRole] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [lastRedemption, setLastRedemption] = useState<Redemption | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    checkAccess();
  }, [user?.id]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const checkAccess = async () => {
    setCheckingRole(true);

    const { data } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user!.id)
      .single();

    const role = data?.role as Role | undefined;
    const canScan =
      data?.is_active !== false &&
      (role === 'staff' || role === 'manager' || role === 'owner');

    setAllowed(canScan);
    setCheckingRole(false);

    if (!canScan) {
      router.replace('/(tabs)/profile');
    }
  };

  const stopCamera = () => {
    scanningRef.current = false;

    if (scannerRef.current) {
      window.cancelAnimationFrame(scannerRef.current);
      scannerRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const startCamera = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Kamera',
        'Skanimi me kamere eshte i aktivizuar per web/PWA.'
      );
      return;
    }

    try {
      setMessage('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      scanningRef.current = true;
      scanFrame(
        window.BarcodeDetector
          ? new window.BarcodeDetector({ formats: ['qr_code'] })
          : null
      );
    } catch (err: any) {
      setMessage(err?.message ?? 'Nuk u hap kamera.');
    }
  };

  const scanFrame = (
    detector: InstanceType<NonNullable<typeof window.BarcodeDetector>> | null
  ) => {
    const tick = async () => {
      if (!scanningRef.current || !videoRef.current || saving) return;

      let rawValue: string | null = null;

      try {
        if (detector) {
          const codes = await detector.detect(videoRef.current);
          rawValue = codes[0]?.rawValue ?? null;
        } else {
          rawValue = scanWithCanvas();
        }
      } catch {
        rawValue = scanWithCanvas();
      }

      if (rawValue) {
        scanningRef.current = false;
        await redeemScannedValue(rawValue);
        return;
      }

      scannerRef.current = window.requestAnimationFrame(tick);
    };

    scannerRef.current = window.requestAnimationFrame(tick);
  };

  const scanWithCanvas = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    if (!video.videoWidth || !video.videoHeight) return null;

    const size = Math.min(video.videoWidth, video.videoHeight);
    const sourceX = Math.floor((video.videoWidth - size) / 2);
    const sourceY = Math.floor((video.videoHeight - size) / 2);
    const targetSize = 720;

    canvas.width = targetSize;
    canvas.height = targetSize;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(
      video,
      sourceX,
      sourceY,
      size,
      size,
      0,
      0,
      targetSize,
      targetSize
    );

    const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
    const code = jsQR(imageData.data, targetSize, targetSize, {
      inversionAttempts: 'attemptBoth',
    });

    return code?.data ?? null;
  };

  const loadRedemption = async (code: string): Promise<Redemption | null> => {
    const { data: directRedemption } = await supabase
      .from('point_redemptions')
      .select(REDEMPTION_SELECT)
      .eq('id', code)
      .maybeSingle();

    if (directRedemption) return directRedemption as Redemption;

    const { data: qrCode } = await supabase
      .from('qr_codes')
      .select('id, user_id, points, created_at')
      .eq('id', code)
      .maybeSingle();

    if (!qrCode) return null;

    const { data: redemption } = await supabase
      .from('point_redemptions')
      .select(REDEMPTION_SELECT)
      .eq('user_id', qrCode.user_id)
      .eq('points', qrCode.points)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return (redemption as Redemption | null) ?? null;
  };

  const redeemScannedValue = async (value: string) => {
    const code = extractCode(value);
    if (!code || saving || !user?.id) return;

    setSaving(true);
    setMessage('Duke kontrolluar QR...');

    const redemption = await loadRedemption(code);

    if (!redemption) {
      setMessage('QR nuk u gjet ose nuk ka zbritje pending.');
      setSaving(false);
      scanningRef.current = cameraActive;
      return;
    }

    if (redemption.status !== 'pending') {
      setLastRedemption(redemption);
      setMessage(`Ky QR eshte perdorur ose nuk eshte aktiv: ${redemption.status}.`);
      setSaving(false);
      scanningRef.current = cameraActive;
      return;
    }

    if (redemption.expires_at && new Date(redemption.expires_at) < new Date()) {
      await supabase
        .from('point_redemptions')
        .update({ status: 'expired' })
        .eq('id', redemption.id)
        .eq('status', 'pending');

      setLastRedemption({ ...redemption, status: 'expired' });
      setMessage('Ky QR ka skaduar.');
      setSaving(false);
      scanningRef.current = cameraActive;
      return;
    }

    const scannedAt = new Date().toISOString();

    const { data: updatedRows, error } = await supabase
      .from('point_redemptions')
      .update({
        status: 'used',
        scanned_by: user.id,
        scanned_at: scannedAt,
      })
      .eq('id', redemption.id)
      .eq('status', 'pending')
      .select(REDEMPTION_SELECT);

    if (error || !updatedRows || updatedRows.length === 0) {
      setMessage(error?.message ?? 'QR nuk mund te perdoret me.');
      setSaving(false);
      scanningRef.current = cameraActive;
      return;
    }

    const updated = updatedRows[0] as Redemption;

    const { data: clientProfile, error: profileLoadError } = await supabase
      .from('profiles')
      .select('points')
      .eq('id', updated.user_id)
      .single();

    if (profileLoadError) {
      setMessage(
        `QR u pranua, por points nuk u perditesuan: ${profileLoadError.message}`
      );
      setLastRedemption(updated);
      setSaving(false);
      stopCamera();
      return;
    }

    const currentPoints = Number(clientProfile?.points ?? 0);
    const nextPoints = Math.max(0, currentPoints - Number(updated.points ?? 0));

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ points: nextPoints })
      .eq('id', updated.user_id);

    if (profileUpdateError) {
      setMessage(
        `QR u pranua, por points nuk u perditesuan: ${profileUpdateError.message}`
      );
      setLastRedemption(updated);
      setSaving(false);
      stopCamera();
      return;
    }

    const { data: scannerProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    const { error: auditError } = await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'REDEEM_POINTS_QR',
      target_id: updated.id,
      metadata: {
        scanner: {
          id: user.id,
          full_name: scannerProfile?.full_name ?? null,
          email: scannerProfile?.email ?? user.email ?? null,
        },
        redemption: {
          id: updated.id,
          user_id: updated.user_id,
          points: updated.points,
          status: updated.status,
        },
        profile_points: {
          old: currentPoints,
          new: nextPoints,
          deducted: Number(updated.points ?? 0),
        },
        changed: {
          status: {
            old: 'pending',
            new: updated.status,
          },
          scanned_by: {
            old: null,
            new: user.id,
          },
          scanned_at: {
            old: null,
            new: updated.scanned_at ?? scannedAt,
          },
          points: {
            old: currentPoints,
            new: nextPoints,
          },
        },
      },
    });

    if (auditError) {
      console.warn('QR scan audit log failed:', auditError.message);
    }

    setLastRedemption(updated);
    setMessage(
      `Zbritja u pranua: ${updated.points} Fresh Points. Balanca: ${nextPoints}.`
    );
    setSaving(false);
    stopCamera();
  };

  const redeemManualCode = () => {
    redeemScannedValue(manualCode);
  };

  if (checkingRole) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!allowed) return null;

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Text style={[styles.title, { color: Colors.text }]}>Skano QR Discount</Text>

      <View style={[styles.card, { backgroundColor: Colors.card }]}>
        {Platform.OS === 'web' ? (
          <>
            {React.createElement('video', {
              ref: videoRef,
              playsInline: true,
              muted: true,
              style: {
                width: '100%',
                aspectRatio: '1 / 1',
                backgroundColor: '#000',
                borderRadius: 14,
                objectFit: 'cover',
                display: cameraActive ? 'block' : 'none',
              },
            })}

            {React.createElement('canvas', {
              ref: canvasRef,
              style: { display: 'none' },
            })}

            {!cameraActive && (
              <View style={[styles.cameraPlaceholder, { borderColor: Colors.primary }]}>
                <Text style={[styles.placeholderText, { color: Colors.muted }]}>
                  Hape kameren dhe afro QR kodin e klientit.
                </Text>
              </View>
            )}

            <Pressable
              onPress={cameraActive ? stopCamera : startCamera}
              disabled={saving}
              style={[
                styles.primaryBtn,
                { backgroundColor: cameraActive ? '#D64545' : Colors.primary },
              ]}
            >
              <Text style={styles.primaryText}>
                {cameraActive ? 'Mbyll kameren' : 'Hap kameren'}
              </Text>
            </Pressable>
          </>
        ) : (
          <Text style={[styles.placeholderText, { color: Colors.muted }]}>
            Skanimi me kamere eshte i aktivizuar per web/PWA.
          </Text>
        )}

        <View style={styles.manualBox}>
          <Text style={[styles.label, { color: Colors.text }]}>Kodi manual</Text>
          <TextInput
            value={manualCode}
            onChangeText={setManualCode}
            autoCapitalize="none"
            placeholder="Vendos id ose linkun e QR"
            placeholderTextColor={Colors.muted}
            style={[
              styles.input,
              {
                backgroundColor: Colors.background,
                borderColor: Colors.primary,
                color: Colors.text,
              },
            ]}
          />

          <Pressable
            onPress={redeemManualCode}
            disabled={saving || !manualCode.trim()}
            style={[
              styles.secondaryBtn,
              {
                backgroundColor:
                  saving || !manualCode.trim() ? Colors.muted : Colors.primary,
              },
            ]}
          >
            <Text style={styles.primaryText}>
              {saving ? 'Duke kontrolluar...' : 'Prano zbritjen'}
            </Text>
          </Pressable>
        </View>
      </View>

      {!!message && (
        <View style={[styles.resultCard, { backgroundColor: Colors.card }]}>
          <Text style={[styles.resultText, { color: Colors.text }]}>{message}</Text>

          {lastRedemption && (
            <Text style={[styles.resultMeta, { color: Colors.muted }]}>
              Points: {lastRedemption.points} · Status: {lastRedemption.status}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  card: {
    borderRadius: 18,
    padding: 16,
  },
  cameraPlaceholder: {
    aspectRatio: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  manualBox: {
    marginTop: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  resultCard: {
    marginTop: 14,
    borderRadius: 18,
    padding: 16,
  },
  resultText: {
    fontSize: 16,
    fontWeight: '800',
  },
  resultMeta: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
  },
});
