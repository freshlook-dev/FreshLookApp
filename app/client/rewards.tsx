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
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../../context/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { DarkColors, LightColors } from '../../constants/colors';
import { formatDateTime } from '../../utils/format';

type Redemption = {
  id: string;
  points: number;
  status: string;
  expires_at: string | null;
  created_at: string;
};

const REWARD_OPTIONS = [25, 50, 100];

export default function RewardsScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const createRedemption = async (points: number) => {
    if (!user?.id || creating) return;

    if ((profile?.points ?? 0) < points) {
      Alert.alert('Not enough points', `You need ${points} Fresh Points for this reward.`);
      return;
    }

    setCreating(points);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error } = await supabase.from('point_redemptions').insert({
      user_id: user.id,
      points,
      status: 'pending',
      expires_at: expiresAt,
    });

    setCreating(null);

    if (error) {
      Alert.alert('Reward unavailable', error.message);
      return;
    }

    await loadRedemptions();
  };

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={[styles.title, { color: Colors.text }]}>Rewards</Text>
      <Text style={[styles.subtitle, { color: Colors.muted }]}>
        Turn Fresh Points into a QR reward and show it at the salon.
      </Text>

      <View style={[styles.balanceCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <Text style={[styles.label, { color: Colors.muted }]}>Available Fresh Points</Text>
        <Text style={[styles.balance, { color: Colors.text }]}>{profile?.points ?? 0}</Text>
      </View>

      <View style={[styles.qrCard, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : activeRedemption && qrValue ? (
          <>
            <View style={styles.qrWrap}>
              <QRCode value={qrValue} size={210} backgroundColor="#FFFFFF" />
            </View>
            <Text style={[styles.qrTitle, { color: Colors.text }]}>
              {activeRedemption.points} Fresh Points
            </Text>
            <Text style={[styles.qrMeta, { color: Colors.muted }]}>
              Expires {formatDateTime(activeRedemption.expires_at)}
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.qrTitle, { color: Colors.text }]}>No active QR</Text>
            <Text style={[styles.qrMeta, { color: Colors.muted }]}>
              Create one when you are ready to redeem points.
            </Text>
          </>
        )}
      </View>

      <Text style={[styles.section, { color: Colors.text }]}>Create Reward</Text>
      <View style={styles.options}>
        {REWARD_OPTIONS.map((points) => {
          const disabled = !!creating || (profile?.points ?? 0) < points;
          return (
            <Pressable
              key={points}
              style={[
                styles.option,
                {
                  backgroundColor: disabled ? Colors.card : Colors.primary,
                  borderColor: Colors.border,
                },
              ]}
              onPress={() => createRedemption(points)}
              disabled={disabled}
            >
              {creating === points ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={[
                    styles.optionText,
                    { color: disabled ? Colors.muted : '#fff' },
                  ]}
                >
                  {points} pts
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {Platform.OS === 'web' && (
        <Text style={[styles.webHint, { color: Colors.muted }]}>
          This page also works as a web app. Add it to your phone home screen from the browser menu.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 110,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
    marginBottom: 18,
  },
  balanceCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 18,
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
  },
  balance: {
    fontSize: 42,
    fontWeight: '900',
  },
  qrCard: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 310,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  qrWrap: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  qrTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  qrMeta: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6,
  },
  section: {
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 10,
  },
  options: {
    flexDirection: 'row',
    gap: 10,
  },
  option: {
    flex: 1,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '900',
  },
  webHint: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 16,
  },
});
