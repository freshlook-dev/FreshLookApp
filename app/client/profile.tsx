import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  PremiumCard,
  ScreenHeader,
  useClientColors,
} from '../../components/ClientUI';

export default function ProfileScreen() {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const Colors = useClientColors();
  const displayName = profile?.full_name || 'Klient FreshLook';

  const confirmLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('A jeni të sigurt që doni të dilni?')) void logout();
      return;
    }

    Alert.alert('Dil nga llogaria', 'A jeni të sigurt që doni të dilni?', [
      { text: 'Kthehu mbrapa', style: 'cancel' },
      { text: 'Dil', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.hero, { backgroundColor: Colors.primary }]}>
        <View style={styles.heroGlow} />
        <View style={[styles.avatarRing, { borderColor: Colors.primarySoft }]}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: Colors.primary }]}>
              <Text style={[styles.avatarText, { color: Colors.onPrimary }]}>
                {(profile?.full_name || profile?.email || 'F').slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.name, { color: Colors.onPrimary }]}>{displayName}</Text>
        <Text style={[styles.email, { color: Colors.onPrimary }]}>{profile?.email}</Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={[styles.heroValue, { color: Colors.onPrimary }]}>{profile?.points ?? 0}</Text>
            <Text style={[styles.heroLabel, { color: Colors.onPrimary }]}>Fresh Points</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroValue, { color: Colors.onPrimary }]}>
              {((profile?.points ?? 0) / 10).toFixed(2)} €
            </Text>
            <Text style={[styles.heroLabel, { color: Colors.onPrimary }]}>Vlera në euro</Text>
          </View>
        </View>
      </View>

      <View style={styles.quickActions}>
        <QuickAction icon="calendar-outline" label="Rezervo" onPress={() => router.push('/client/book')} />
        <QuickAction icon="gift-outline" label="Shpërblimet" onPress={() => router.push('/client/rewards')} />
        <QuickAction icon="bag-outline" label="Produktet" onPress={() => router.push('/client/shop')} />
      </View>

      <Text style={[styles.sectionLabel, { color: Colors.primary }]}>Të dhënat e llogarisë</Text>
      <PremiumCard style={styles.detailsCard}>
        <ProfileRow
          icon="call-outline"
          label="Telefoni"
          value={profile?.phone || 'Nuk është shtuar'}
        />
        <ProfileRow
          icon="shield-checkmark-outline"
          label="Statusi i llogarisë"
          value={profile?.is_active === false ? 'Joaktive' : 'Aktive'}
        />
      </PremiumCard>

      <Text style={[styles.sectionLabel, { color: Colors.primary }]}>Preferencat</Text>
      <PremiumCard style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: Colors.primarySoft }]}>
            <Ionicons name={theme === 'dark' ? 'moon-outline' : 'sunny-outline'} size={20} color={Colors.primary} />
          </View>
          <View style={styles.settingCopy}>
            <Text style={[styles.settingTitle, { color: Colors.text }]}>Pamje e errët</Text>
            <Text style={[styles.settingSubtitle, { color: Colors.muted }]}>Përshtatni pamjen e aplikacionit</Text>
          </View>
          <Switch
            value={theme === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ false: Colors.border, true: Colors.primarySoft }}
            thumbColor={theme === 'dark' ? Colors.primary : Colors.muted}
          />
        </View>
      </PremiumCard>

      <Pressable
        style={[styles.settingsLink, { borderColor: Colors.border, backgroundColor: Colors.card }]}
        onPress={() => router.push('/client/points-history' as any)}
      >
        <Ionicons name="time-outline" size={20} color={Colors.primary} />
        <Text style={[styles.settingsLinkText, { color: Colors.text }]}>Historiku i Fresh Points</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
      </Pressable>

      <Pressable
        style={[styles.settingsLink, { borderColor: Colors.border, backgroundColor: Colors.card }]}
        onPress={() => router.push('/client/settings')}
      >
        <Ionicons name="settings-outline" size={20} color={Colors.primary} />
        <Text style={[styles.settingsLinkText, { color: Colors.text }]}>Menaxho profilin</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
      </Pressable>

      <Pressable
        style={[styles.settingsLink, { borderColor: Colors.border, backgroundColor: Colors.card }]}
        onPress={() => router.push('/client/change-password')}
      >
        <Ionicons name="lock-closed-outline" size={20} color={Colors.primary} />
        <Text style={[styles.settingsLinkText, { color: Colors.text }]}>Fjalëkalimi dhe siguria</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
      </Pressable>

      <Pressable
        style={[styles.settingsLink, { borderColor: Colors.border, backgroundColor: Colors.card }]}
        onPress={() => router.push('/client/help-center')}
      >
        <Ionicons name="help-circle-outline" size={20} color={Colors.primary} />
        <Text style={[styles.settingsLinkText, { color: Colors.text }]}>Qendra e ndihmës</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
      </Pressable>

      <Pressable
        style={[styles.settingsLink, { borderColor: Colors.border, backgroundColor: Colors.card }]}
        onPress={() => router.push('/client/about-us')}
      >
        <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
        <Text style={[styles.settingsLinkText, { color: Colors.text }]}>Rreth nesh</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
      </Pressable>

      <Pressable
        style={[styles.logout, { borderColor: Colors.border, backgroundColor: Colors.card }]}
        onPress={confirmLogout}
      >
        <View style={[styles.logoutIcon, { backgroundColor: `${Colors.danger}18` }]}>
          <Ionicons name="log-out-outline" size={19} color={Colors.danger} />
        </View>
        <Text style={[styles.logoutText, { color: Colors.danger }]}>Dil nga llogaria</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.danger} />
      </Pressable>
    </ScrollView>
  );
}

function ProfileRow({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent?: boolean;
}) {
  const Colors = useClientColors();
  return (
    <View style={styles.profileRow}>
      <View style={[styles.rowIcon, { backgroundColor: Colors.surface }]}>
        <Ionicons name={icon} size={19} color={Colors.primary} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowLabel, { color: Colors.muted }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: accent ? Colors.primary : Colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function Divider() {
  const Colors = useClientColors();
  return <View style={[styles.divider, { backgroundColor: Colors.border }]} />;
}

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const Colors = useClientColors();
  return (
    <Pressable style={[styles.quickAction, { backgroundColor: Colors.card, borderColor: Colors.border }]} onPress={onPress}>
      <View style={[styles.quickIcon, { backgroundColor: Colors.primarySoft }]}>
        <Ionicons name={icon} size={20} color={Colors.primary} />
      </View>
      <Text style={[styles.quickLabel, { color: Colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 118 },
  hero: { alignItems: 'center', paddingVertical: 29, paddingHorizontal: 20, borderRadius: 28, marginBottom: 16, overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -90, top: -100, backgroundColor: 'rgba(255,255,255,0.13)' },
  avatarRing: {
    width: 92, height: 92, borderRadius: 46, borderWidth: 6,
    alignItems: 'center', justifyContent: 'center', marginBottom: 15,
  },
  avatar: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 74, height: 74, borderRadius: 37 },
  avatarText: { fontSize: 29, fontWeight: '800' },
  name: { fontSize: 23, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  email: { fontSize: 14, marginTop: 5, textAlign: 'center', opacity: 0.78 },
  heroStats: { width: '100%', flexDirection: 'row', alignItems: 'center', marginTop: 24, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.35)' },
  heroStat: { flex: 1, alignItems: 'center', gap: 4 },
  heroValue: { fontSize: 23, fontWeight: '900' },
  heroLabel: { fontSize: 11, fontWeight: '700', opacity: 0.8 },
  heroDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.3)' },
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  quickAction: { flex: 1, minHeight: 92, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 8 },
  quickIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  memberBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 7, marginTop: 15,
  },
  memberText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.3,
    textTransform: 'uppercase', marginBottom: 10, marginLeft: 2,
  },
  detailsCard: { paddingVertical: 6, marginBottom: 25 },
  profileRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  rowIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, marginLeft: 13 },
  rowLabel: { fontSize: 12, fontWeight: '600', marginBottom: 3 },
  rowValue: { fontSize: 15, fontWeight: '700' },
  divider: { height: 1, marginLeft: 55 },
  settingsCard: { paddingVertical: 8, marginBottom: 14 },
  settingsLink: { minHeight: 60, borderWidth: 1, borderRadius: 18, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  settingsLinkText: { flex: 1, fontSize: 15, fontWeight: '700' },
  settingRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center' },
  settingIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  settingCopy: { flex: 1, marginLeft: 13 },
  settingTitle: { fontSize: 15, fontWeight: '700' },
  settingSubtitle: { fontSize: 12, marginTop: 3 },
  logout: {
    minHeight: 64, borderWidth: 1, borderRadius: 18, paddingHorizontal: 15,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  logoutIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoutText: { flex: 1, fontSize: 15, fontWeight: '700' },
});
