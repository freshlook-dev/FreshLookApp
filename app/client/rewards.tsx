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
  const [selectedRedemptionId, setSelectedRedemptionId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customPoints, setCustomPoints] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeRedemption = useMemo(
    () => redemptions.find((item) => item.id === selectedRedemptionId && item.status === 'pending')
      ?? redemptions.find((item) => item.status === 'pending'),
    [redemptions, selectedRedemptionId]
  );

  const qrValue = activeRedemption?.id ?? null;

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
    if (!Number.isInteger(points) || points < 10) {
      notify('Invalid points', 'Enter at least 10 Fresh Points.');
      return;
    }
    if ((profile?.points ?? 0) < points) {
      notify('Not enough points', `You need ${points} Fresh Points for this reward.`);
      return;
    }
    setCreating(points);
    let { data, error } = await supabase
      .from('point_redemptions')
      .insert({ user_id: user.id, points, status: 'pending', expires_at: null })
      .select('id, points, status, expires_at, created_at')
      .single();

    if (error) {
      const rpcResult = await supabase.rpc('create_point_redemption_qr', {
        p_points: points,
        p_expires_at: null,
      });
      data = rpcResult.data as Redemption | null;
      error = rpcResult.error;
    }

    setCreating(null);
    if (error) {
      notify('Reward unavailable', error.message);
      return;
    }
    if (data) {
      setRedemptions((prev) => [data as Redemption, ...prev]);
      setSelectedRedemptionId((data as Redemption).id);
    }
    setCustomOpen(false);
    setCustomPoints('');
    await loadRedemptions();
  };

  const deleteRedemption = async (item: Redemption) => {
    if (item.status !== 'pending' || deletingId) return;

    const remove = async () => {
      setDeletingId(item.id);
      const { error } = await supabase.rpc('delete_pending_reward_qr', {
        p_redemption_id: item.id,
      });
      setDeletingId(null);

      if (error) {
        notify('Could not delete QR', error.message);
        return;
      }

      if (selectedRedemptionId === item.id) setSelectedRedemptionId(null);
      setRedemptions((current) => current.filter((redemption) => redemption.id !== item.id));
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Delete this unused QR code?')) await remove();
      return;
    }

    Alert.alert('Delete QR code?', 'This removes the unused reward pass from your list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove() },
    ]);
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
            <Text style={[styles.qrMeta, { color: Colors.muted }]}>Show this QR to staff to redeem</Text>
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
        <Text style={[styles.sectionHint, { color: Colors.muted }]}>The QR remains active until it is used</Text>
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

      <Pressable
        style={[styles.adCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}
        onPress={() => notify('Coming soon', 'Video rewards are not active yet. In the future, watching a full ad will earn 10 Fresh Points.')}
      >
        <View style={[styles.adIcon, { backgroundColor: Colors.primarySoft }]}>
          <Ionicons name="play" size={21} color={Colors.primary} />
        </View>
        <View style={styles.adCopy}>
          <View style={styles.adTitleRow}>
            <Text style={[styles.adTitle, { color: Colors.text }]}>Watch & earn</Text>
            <View style={[styles.comingSoon, { backgroundColor: Colors.primarySoft }]}>
              <Text style={[styles.comingSoonText, { color: Colors.primary }]}>Coming soon</Text>
            </View>
          </View>
          <Text style={[styles.adSubtitle, { color: Colors.muted }]}>Watch a video and earn 10 Fresh Points</Text>
        </View>
        <Ionicons name="chevron-forward" size={19} color={Colors.muted} />
      </Pressable>

      <Text style={[styles.eyebrow, styles.historyEyebrow, { color: Colors.primary }]}>History</Text>
      <PremiumCard>
        {redemptions.length === 0 ? (
          <Text style={[styles.historyEmpty, { color: Colors.muted }]}>No reward activity yet.</Text>
        ) : (
          redemptions.map((item) => (
            <View key={item.id} style={[styles.historyRow, { borderBottomColor: Colors.border }]}>
              <Pressable
                disabled={item.status !== 'pending'}
                onPress={() => setSelectedRedemptionId(item.id)}
                style={styles.historyMain}
              >
                <Text style={[styles.historyPoints, { color: Colors.text }]}>{item.points} pts</Text>
                <Text style={{ color: item.status === 'pending' ? Colors.primary : Colors.muted }}>
                  {item.status === 'pending' ? 'Active' : 'Used'}
                </Text>
              </Pressable>
              {item.status === 'pending' && (
                <Pressable
                  onPress={() => void deleteRedemption(item)}
                  disabled={!!deletingId}
                  style={[styles.deleteButton, { backgroundColor: `${Colors.danger}12` }]}
                >
                  {deletingId === item.id
                    ? <ActivityIndicator size="small" color={Colors.danger} />
                    : <Ionicons name="trash-outline" size={18} color={Colors.danger} />}
                </Pressable>
              )}
            </View>
          ))
        )}
      </PremiumCard>

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
  adCard: { minHeight: 82, borderWidth: 1, borderRadius: 19, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  adIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  adCopy: { flex: 1 },
  adTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  adTitle: { fontSize: 15, fontWeight: '800' },
  adSubtitle: { fontSize: 12, marginTop: 5 },
  comingSoon: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  comingSoonText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  webHint: { fontSize: 12, lineHeight: 18, marginTop: 16, textAlign: 'center' },
  historyEyebrow: { marginTop: 28 },
  historyEmpty: { textAlign: 'center', paddingVertical: 8 },
  historyRow: {
    minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyMain: { flex: 1, minHeight: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 12 },
  deleteButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  historyPoints: { fontSize: 14, fontWeight: '700' },
});
