import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
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
  const displayName = profile?.full_name || 'FreshLook Client';

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.content}
    >
      <ScreenHeader
        eyebrow="Membership"
        title="Profile"
        subtitle="Your personal details and FreshLook preferences."
      />

      <PremiumCard elevated style={styles.identityCard}>
        <View style={[styles.avatarRing, { borderColor: Colors.primarySoft }]}>
          <View style={[styles.avatar, { backgroundColor: Colors.primary }]}>
            <Text style={[styles.avatarText, { color: Colors.onPrimary }]}>
              {(profile?.full_name || profile?.email || 'F').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={[styles.name, { color: Colors.text }]}>{displayName}</Text>
        <Text style={[styles.email, { color: Colors.muted }]}>{profile?.email}</Text>
        <View style={[styles.memberBadge, { backgroundColor: Colors.primarySoft }]}>
          <Ionicons name="sparkles-outline" size={14} color={Colors.primary} />
          <Text style={[styles.memberText, { color: Colors.primary }]}>FreshLook Member</Text>
        </View>
      </PremiumCard>

      <Text style={[styles.sectionLabel, { color: Colors.primary }]}>Account details</Text>
      <PremiumCard style={styles.detailsCard}>
        <ProfileRow
          icon="call-outline"
          label="Phone"
          value={profile?.phone || 'Not added'}
        />
        <Divider />
        <ProfileRow
          icon="diamond-outline"
          label="Fresh Points"
          value={String(profile?.points ?? 0)}
          accent
        />
        <Divider />
        <ProfileRow
          icon="shield-checkmark-outline"
          label="Account status"
          value={profile?.is_active === false ? 'Inactive' : 'Active'}
        />
      </PremiumCard>

      <Text style={[styles.sectionLabel, { color: Colors.primary }]}>Preferences</Text>
      <PremiumCard style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: Colors.primarySoft }]}>
            <Ionicons name={theme === 'dark' ? 'moon-outline' : 'sunny-outline'} size={20} color={Colors.primary} />
          </View>
          <View style={styles.settingCopy}>
            <Text style={[styles.settingTitle, { color: Colors.text }]}>Dark mode</Text>
            <Text style={[styles.settingSubtitle, { color: Colors.muted }]}>Adjust the app appearance</Text>
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
        style={[styles.logout, { borderColor: Colors.border, backgroundColor: Colors.card }]}
        onPress={logout}
      >
        <View style={[styles.logoutIcon, { backgroundColor: `${Colors.danger}18` }]}>
          <Ionicons name="log-out-outline" size={19} color={Colors.danger} />
        </View>
        <Text style={[styles.logoutText, { color: Colors.danger }]}>Sign out</Text>
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

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 118 },
  identityCard: { alignItems: 'center', paddingVertical: 25, marginBottom: 28 },
  avatarRing: {
    width: 92, height: 92, borderRadius: 46, borderWidth: 6,
    alignItems: 'center', justifyContent: 'center', marginBottom: 15,
  },
  avatar: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 29, fontWeight: '800' },
  name: { fontSize: 23, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  email: { fontSize: 14, marginTop: 5, textAlign: 'center' },
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
