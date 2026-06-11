import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../utils/format';
import {
  EmptyState,
  PremiumCard,
  ScreenHeader,
  useClientColors,
} from '../../components/ClientUI';

type Redemption = {
  id: string;
  points: number;
  status: string;
  expires_at: string | null;
  created_at: string;
};

const REWARD_OPTIONS = [100, 500];

export default function RewardsScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const Colors = useClientColors();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customPoints, setCustomPoints] = useState('');

  const activeRedemption = useMemo(() => {
    const now = Date.now();
    return redemptions.find((item) => {
      if (item.status !== 'pending') return false;
      if (!item.expires_at) return true;
      return new Date(item.expires_at).getTime() > now;
    });
  }, [redemptions]);

  const qrValue = activeRedemption
    ? JSON.stringify({ redemption_id: activeRedemption.id })
    : null;

  const loadRedemptions = useCallback(async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('point_redemptions')
      .select('id, points, status, expires_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    setRedemptions(data ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadRedemptions();
  }, [loadRedemptions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadRedemptions(), refreshProfile()]);
    setRefreshing(false);
  };

  const notify = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const createRedemption = async (points: number) => {
    if (!user?.id || creating) return;
    if (!Number.isInteger(points) || points <= 0) {
      notify('Invalid points', 'Enter a valid Fresh Points amount.');
      return;
    }
    if ((profile?.points ?? 0) < points) {
      notify('Not enough points', `You need ${points} Fresh Points for this reward.`);
      return;
    }
    if (activeRedemption) {
      notify('QR already active', 'Use or wait for the current QR to expire before creating another one.');
      return;
    }

    setCreating(points);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    let { data, error } = await supabase
      .from('point_redemptions')
      .insert({ user_id: user.id, points, status: 'pending', expires_at: expiresAt })
      .select('id, points, status, expires_at, created_at')
      .single();

    if (error) {
      const rpcResult = await supabase.rpc('create_point_redemption_qr', {
        p_points: points,
        p_expires_at: expiresAt,
      });
      data = rpcResult.data as Redemption | null;
      error = rpcResult.error;
    }

    setCreating(null);
    if (error) {
      notify('Reward unavailable', error.message);
      return;
    }
    if (data) setRedemptions((prev) => [data as Redemption, ...prev]);
    setCustomOpen(false);
    setCustomPoints('');
    await loadRedemptions();
  };

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
    >
      <ScreenHeader
        eyebrow="Loyalty"
        title="Rewards"
        subtitle="Turn your Fresh Points into a secure reward pass for your next salon visit."
      />

      <View style={[styles.balanceCard, { backgroundColor: Colors.primary }]}>
        <View style={styles.balanceGlow} />
        <View>
          <Text style={[styles.balanceLabel, { color: Colors.onPrimary }]}>Available balance</Text>
          <View style={styles.balanceRow}>
            <Text style={[styles.balance, { color: Colors.onPrimary }]}>{profile?.points ?? 0}</Text>
            <Text style={[styles.pointsUnit, { color: Colors.onPrimary }]}>PTS</Text>
          </View>
        </View>
        <View style={[styles.balanceIcon, { borderColor: Colors.onPrimary }]}>
          <Ionicons name="diamond-outline" size={22} color={Colors.onPrimary} />
        </View>
      </View>

      <Text style={[styles.eyebrow, { color: Colors.primary }]}>Reward pass</Text>
      <PremiumCard elevated style={styles.qrCard}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : activeRedemption && qrValue ? (
          <>
            <View style={[styles.activeLabel, { backgroundColor: Colors.primarySoft }]}>
              <View style={[styles.activeDot, { backgroundColor: Colors.primary }]} />
              <Text style={[styles.activeText, { color: Colors.primary }]}>Active reward</Text>
            </View>
            <View style={[styles.qrWrap, { borderColor: Colors.border }]}>
              <QRCode value={qrValue} size={210} backgroundColor="#FFFFFF" />
            </View>
            <Text style={[styles.qrTitle, { color: Colors.text }]}>{activeRedemption.points} Fresh Points</Text>
            <Text style={[styles.qrMeta, { color: Colors.muted }]}>Expires {formatDateTime(activeRedemption.expires_at)}</Text>
          </>
        ) : (
          <EmptyState
            icon="qr-code-outline"
            title="No active reward pass"
            message="Choose an amount below when you are ready to redeem your points."
          />
        )}
      </PremiumCard>

      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, { color: Colors.text }]}>Create a reward</Text>
        <Text style={[styles.sectionHint, { color: Colors.muted }]}>Pass expires after 15 minutes</Text>
      </View>
      <View style={styles.options}>
        {REWARD_OPTIONS.map((points) => (
          <RewardButton
            key={points}
            label={`${points} pts`}
            loading={creating === points}
            disabled={!!creating}
            active
            onPress={() => createRedemption(points)}
          />
        ))}
        <RewardButton
          label="Custom"
          disabled={!!creating}
          active={!customOpen}
          onPress={() => setCustomOpen((value) => !value)}
        />
      </View>

      {customOpen && (
        <PremiumCard style={styles.customCard}>
          <Text style={[styles.customLabel, { color: Colors.text }]}>Custom Fresh Points</Text>
          <TextInput
            placeholder="Enter points"
            placeholderTextColor={Colors.muted}
            keyboardType="number-pad"
            value={customPoints}
            onChangeText={(value) => setCustomPoints(value.replace(/[^0-9]/g, ''))}
            style={[
              styles.customInput,
              { color: Colors.text, borderColor: Colors.border, backgroundColor: Colors.surface },
            ]}
          />
          <Pressable
            style={[styles.customButton, { backgroundColor: Colors.primary, opacity: creating ? 0.7 : 1 }]}
            onPress={() => createRedemption(Number(customPoints))}
            disabled={!!creating}
          >
            {creating === Number(customPoints) ? (
              <ActivityIndicator color={Colors.onPrimary} />
            ) : (
              <Text style={[styles.customButtonText, { color: Colors.onPrimary }]}>Create reward pass</Text>
            )}
          </Pressable>
        </PremiumCard>
      )}

      {Platform.OS === 'web' && (
        <Text style={[styles.webHint, { color: Colors.muted }]}>Tip: add FreshLook to your home screen for faster access to your reward pass.</Text>
      )}
    </ScrollView>
  );
}

function RewardButton({
  label,
  loading = false,
  disabled,
  active,
  onPress,
}: {
  label: string;
  loading?: boolean;
  disabled: boolean;
  active: boolean;
  onPress: () => void;
}) {
  const Colors = useClientColors();
  return (
    <Pressable
      style={[
        styles.option,
        {
          backgroundColor: disabled || !active ? Colors.surface : Colors.primary,
          borderColor: !active ? Colors.primary : Colors.border,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {loading ? (
        <ActivityIndicator color={Colors.onPrimary} />
      ) : (
        <Text style={[styles.optionText, { color: disabled ? Colors.muted : active ? Colors.onPrimary : Colors.primary }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 118 },
  balanceCard: {
    minHeight: 140, borderRadius: 22, padding: 21, marginBottom: 28,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden',
  },
  balanceGlow: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    right: -55, top: -65, backgroundColor: 'rgba(255,255,255,0.14)',
  },
  balanceLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.7, opacity: 0.8 },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  balance: { fontSize: 46, lineHeight: 54, fontWeight: '800', letterSpacing: -1.2 },
  pointsUnit: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, opacity: 0.75 },
  balanceIcon: {
    width: 46, height: 46, borderRadius: 23, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', opacity: 0.85,
  },
  eyebrow: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.3,
    textTransform: 'uppercase', marginBottom: 10,
  },
  qrCard: { minHeight: 300, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  activeLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 7, marginBottom: 16,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  qrWrap: { backgroundColor: '#fff', padding: 16, borderWidth: 1, borderRadius: 18, marginBottom: 16 },
  qrTitle: { fontSize: 19, fontWeight: '800', textAlign: 'center' },
  qrMeta: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 6 },
  sectionHeading: { marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '800' },
  sectionHint: { fontSize: 12, marginTop: 4 },
  options: { flexDirection: 'row', gap: 10 },
  option: {
    flex: 1, minHeight: 54, borderWidth: 1, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  optionText: { fontSize: 14, fontWeight: '800' },
  customCard: { marginTop: 12, gap: 11 },
  customLabel: { fontSize: 15, fontWeight: '800' },
  customInput: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 13, fontSize: 16 },
  customButton: { minHeight: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  customButtonText: { fontSize: 14, fontWeight: '800' },
  webHint: { fontSize: 12, lineHeight: 18, marginTop: 16, textAlign: 'center' },
});
