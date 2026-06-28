import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { DarkColors, LightColors } from '../../constants/colors';
import { supabase } from '../../context/supabase';

type Recipient = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
};

type SendMode = 'direct' | 'broadcast';

const STAFF_ROLES = ['owner', 'manager', 'staff'];

function roleLabel(role: string | null) {
  if (role === 'owner') return 'Pronar';
  if (role === 'manager') return 'Menaxher';
  if (role === 'staff') return 'Staf';
  return 'Klient';
}

export default function NotificationsScreen() {
  const { profile, loading } = useAuth();
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [mode, setMode] = useState<SendMode>('direct');
  const [sending, setSending] = useState(false);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const canUseNotifications = !!profile?.role && STAFF_ROLES.includes(profile.role);
  const canBroadcast = profile?.role === 'owner';

  const filteredRecipients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return recipients;
    return recipients.filter((item) =>
      [item.full_name, item.email, roleLabel(item.role)].some((value) =>
        String(value ?? '').toLowerCase().includes(query)
      )
    );
  }, [recipients, search]);

  const loadRecipients = async () => {
    setLoadingRecipients(true);
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: { mode: 'list_recipients' },
    });
    setLoadingRecipients(false);

    if (error) {
      Alert.alert('Lista nuk u ngarkua', error.message);
      return;
    }

    setRecipients((data?.recipients ?? []) as Recipient[]);
  };

  useEffect(() => {
    if (!loading && canUseNotifications) void loadRecipients();
  }, [loading, canUseNotifications]);

  if (loading) return null;
  if (!canUseNotifications) return <Redirect href="/(tabs)/profile" />;

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecipients();
    setRefreshing(false);
  };

  const sendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Mungojnë të dhëna', 'Shtoni titullin dhe mesazhin.');
      return;
    }

    if (mode === 'direct' && !selectedRecipient) {
      Alert.alert('Zgjidhni përdoruesin', 'Zgjidhni një përdorues para se ta dërgoni njoftimin.');
      return;
    }

    if (mode === 'broadcast' && !canBroadcast) {
      Alert.alert('Nuk keni qasje', 'Vetëm pronari mund të dërgojë njoftim te të gjithë.');
      return;
    }

    setSending(true);
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body:
        mode === 'direct'
          ? {
              mode: 'direct_notification',
              recipient_id: selectedRecipient?.id,
              title: title.trim(),
              message: message.trim(),
            }
          : { title: title.trim(), message: message.trim() },
    });
    setSending(false);

    if (error) {
      Alert.alert('Njoftimi nuk u dërgua', error.message);
      return;
    }

    Alert.alert('Njoftimi u dërgua', `U dërgua në ${data?.sent ?? 0} pajisje të regjistruara.`);
    setTitle('');
    setMessage('');
    setSelectedRecipient(null);
  };

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color={Colors.text} />
        <Text style={[styles.backText, { color: Colors.text }]}>Profili</Text>
      </Pressable>

      <Text style={[styles.title, { color: Colors.text }]}>Dërgo njoftim</Text>
      <Text style={[styles.subtitle, { color: Colors.muted }]}>
        Dërgoni njoftim te një përdorues i vetëm, ose te të gjithë nëse jeni pronar.
      </Text>

      {canBroadcast && (
        <View style={[styles.segment, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
          {(['direct', 'broadcast'] as SendMode[]).map((item) => {
            const active = mode === item;
            return (
              <Pressable
                key={item}
                onPress={() => setMode(item)}
                style={[
                  styles.segmentButton,
                  { backgroundColor: active ? Colors.primary : 'transparent' },
                ]}
              >
                <Text style={[styles.segmentText, { color: active ? '#fff' : Colors.text }]}>
                  {item === 'direct' ? 'Një përdorues' : 'Të gjithë'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {mode === 'direct' && (
        <View style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>Përdoruesi</Text>
          <TextInput
            style={[styles.input, { backgroundColor: Colors.background, borderColor: Colors.border, color: Colors.text }]}
            placeholder="Kërko sipas emrit ose emailit"
            placeholderTextColor={Colors.muted}
            value={search}
            onChangeText={setSearch}
          />

          {loadingRecipients ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : filteredRecipients.length ? (
            <View style={styles.recipientList}>
              {filteredRecipients.map((item) => {
                const selected = selectedRecipient?.id === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedRecipient(item)}
                    style={[
                      styles.recipientRow,
                      {
                        backgroundColor: selected ? Colors.primary : Colors.background,
                        borderColor: selected ? Colors.primary : Colors.border,
                      },
                    ]}
                  >
                    <View style={styles.recipientCopy}>
                      <Text style={[styles.recipientName, { color: selected ? '#fff' : Colors.text }]} numberOfLines={1}>
                        {item.full_name || item.email || 'Përdorues'}
                      </Text>
                      <Text style={[styles.recipientMeta, { color: selected ? '#fff' : Colors.muted }]} numberOfLines={1}>
                        {roleLabel(item.role)} · {item.email || 'Pa email'}
                      </Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={22} color="#fff" />}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: Colors.muted }]}>Nuk u gjet asnjë përdorues.</Text>
          )}
        </View>
      )}

      <View style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
        <Text style={[styles.sectionTitle, { color: Colors.text }]}>Mesazhi</Text>
        <TextInput
          style={[styles.input, { backgroundColor: Colors.background, borderColor: Colors.border, color: Colors.text }]}
          placeholder="Titulli i njoftimit"
          placeholderTextColor={Colors.muted}
          maxLength={80}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={[
            styles.input,
            styles.message,
            { backgroundColor: Colors.background, borderColor: Colors.border, color: Colors.text },
          ]}
          placeholder="Mesazhi"
          placeholderTextColor={Colors.muted}
          maxLength={500}
          multiline
          value={message}
          onChangeText={setMessage}
        />
        <Pressable style={[styles.button, { backgroundColor: Colors.primary }]} onPress={sendNotification} disabled={sending}>
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{mode === 'direct' ? 'Dërgo njoftimin' : 'Dërgo te të gjithë'}</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22, paddingBottom: 100 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  backText: { fontSize: 15, fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 22 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, padding: 4, marginBottom: 16 },
  segmentButton: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 14, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15 },
  message: { minHeight: 132, textAlignVertical: 'top' },
  loader: { marginVertical: 16 },
  recipientList: { gap: 10 },
  recipientRow: { borderWidth: 1, borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  recipientCopy: { flex: 1 },
  recipientName: { fontSize: 15, fontWeight: '800' },
  recipientMeta: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center', paddingVertical: 12 },
  button: { minHeight: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
