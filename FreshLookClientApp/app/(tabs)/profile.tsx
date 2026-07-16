import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { DarkColors, LightColors } from '../../constants/colors';

export default function ProfileScreen() {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: Colors.text }]}>Profile</Text>
      <Text style={[styles.subtitle, { color: Colors.muted }]}>
        Your FreshLook client account.
      </Text>

      <View style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: Colors.primary }]}>
          <Text style={styles.avatarText}>
            {(profile?.full_name || profile?.email || 'F').slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.name, { color: Colors.text }]}>
          {profile?.full_name || 'FreshLook Client'}
        </Text>
        <Text style={[styles.email, { color: Colors.muted }]}>{profile?.email}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <Row label="Phone" value={profile?.phone || 'Not added'} />
        <Row label="Fresh Points" value={String(profile?.points ?? 0)} />
        <Row label="Euro Value" value={`${((profile?.points ?? 0) / 10).toFixed(2)} €`} />
      </View>

      <View style={[styles.setting, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <View style={styles.settingLabel}>
          <Ionicons name="moon-outline" size={20} color={Colors.primary} />
          <Text style={[styles.settingText, { color: Colors.text }]}>Dark mode</Text>
        </View>
        <Switch value={theme === 'dark'} onValueChange={toggleTheme} />
      </View>

      <Pressable
        style={[styles.logout, { borderColor: Colors.border }]}
        onPress={logout}
      >
        <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        <Text style={[styles.logoutText, { color: Colors.danger }]}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: Colors.muted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: Colors.text }]}>{value}</Text>
    </View>
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
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 18,
    marginBottom: 14,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
  },
  name: {
    fontSize: 22,
    fontWeight: '900',
  },
  email: {
    fontSize: 14,
    marginTop: 4,
  },
  row: {
    paddingVertical: 10,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  rowValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  setting: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '800',
  },
  logout: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '900',
  },
});
